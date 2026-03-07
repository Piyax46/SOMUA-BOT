const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { deleteQueue } = require('./queue');
const { createNowPlayingEmbed } = require('./embed');

// Piped API instances (public YouTube proxy)
const PIPED_INSTANCES = [
    'https://pipedapi.leptons.xyz',
    'https://pipedapi.reallyaweso.me',
    'https://pipedapi.drgns.space',
    'https://pipedapi.ducks.party',
    'https://pipedapi.codespace.cz',
    'https://watchapi.whatever.social',
    'https://pipedapi.r4fo.com',
];

// Cobalt API (popular YouTube audio extraction service)
const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
];

// yt-dlp path (last fallback)
let ytDlpPath = '/usr/local/bin/yt-dlp';
if (!fs.existsSync(ytDlpPath)) {
    try {
        ytDlpPath = require('youtube-dl-exec/src/util').getBinPath();
    } catch {
        ytDlpPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
    }
}
console.log(`[Player] yt-dlp path: ${ytDlpPath}`);

const cookiesFile = path.join(process.cwd(), 'cookies.txt');
const hasCookies = fs.existsSync(cookiesFile);

/**
 * Extract YouTube video ID from URL
 */
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
        const match = url.match(p);
        if (match) return match[1];
    }
    return null;
}

/**
 * Method 1: Cobalt API
 */
async function getStreamUrlFromCobalt(videoUrl) {
    for (const instance of COBALT_INSTANCES) {
        try {
            console.log(`[Player] Trying Cobalt: ${instance}...`);
            const response = await axios.post(`${instance}/`, {
                url: videoUrl,
                downloadMode: 'audio',
                audioFormat: 'opus',
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            });

            if (response.data?.url) {
                console.log('[Player] Cobalt OK ✅');
                return response.data.url;
            }
        } catch (err) {
            console.warn(`[Player] Cobalt ${instance} failed:`, err.response?.status || err.message);
        }
    }
    return null;
}

/**
 * Method 2: Piped API
 */
async function getStreamUrlFromPiped(videoId) {
    for (const instance of PIPED_INSTANCES) {
        try {
            console.log(`[Player] Trying Piped: ${instance}...`);
            const response = await axios.get(`${instance}/streams/${videoId}`, {
                timeout: 10000,
            });

            const audioStreams = response.data.audioStreams || [];
            if (audioStreams.length === 0) continue;

            // Sort by bitrate, prefer opus
            audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            const opusStream = audioStreams.find(s => s.codec === 'opus');
            const bestStream = opusStream || audioStreams[0];

            console.log(`[Player] Piped OK: ${bestStream.quality || 'audio'} ✅`);
            return bestStream.url;
        } catch (err) {
            console.warn(`[Player] Piped ${instance} failed:`, err.response?.status || err.message);
        }
    }
    return null;
}

/**
 * Method 3: yt-dlp (last resort)
 */
function getStreamUrlFromYtdlp(songUrl) {
    return new Promise((resolve, reject) => {
        const args = [
            '--get-url',
            '-f', 'ba',
            songUrl,
            '--no-warnings',
            '--no-check-certificates',
            '--no-playlist',
            '--force-ipv4',
            '--extractor-args', 'youtube:player_client=mweb,android',
        ];
        if (hasCookies) args.push('--cookies', cookiesFile);

        const proc = spawn(ytDlpPath, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            if (code === 0 && stdout.trim()) {
                const urls = stdout.trim().split('\n').filter(u => u.startsWith('http'));
                resolve(urls[urls.length - 1]);
            } else {
                reject(new Error(stderr.trim().substring(0, 200) || `yt-dlp code ${code}`));
            }
        });

        proc.on('error', (err) => reject(err));
    });
}

/**
 * Try all methods to get a stream URL
 */
async function getStreamUrl(songUrl) {
    const videoId = extractVideoId(songUrl);

    // 1. Cobalt API
    const cobaltUrl = await getStreamUrlFromCobalt(songUrl);
    if (cobaltUrl) return cobaltUrl;

    // 2. Piped API
    if (videoId) {
        const pipedUrl = await getStreamUrlFromPiped(videoId);
        if (pipedUrl) return pipedUrl;
    }

    // 3. yt-dlp
    console.log('[Player] All APIs failed, trying yt-dlp...');
    return await getStreamUrlFromYtdlp(songUrl);
}

/**
 * Stream audio through ffmpeg
 */
function createFfmpegStream(directUrl) {
    const ffmpeg = spawn('ffmpeg', [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', directUrl,
        '-vn',
        '-acodec', 'libopus',
        '-f', 'opus',
        '-ar', '48000',
        '-ac', '2',
        '-loglevel', 'error',
        'pipe:1',
    ], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.warn('[ffmpeg stderr]', msg);
    });

    return ffmpeg;
}

async function playSong(client, guildId) {
    const queue = client.queues.get(guildId);
    if (!queue) return;

    if (queue.songs.length === 0) {
        deleteQueue(client, guildId);
        return;
    }

    const song = queue.songs[0];

    try {
        console.log(`[Player] Streaming: ${song.title} | URL: ${song.url}`);

        if (!song.url || song.url === 'undefined') {
            throw new Error('Invalid song URL');
        }

        // Step 1: Get direct stream URL
        console.log('[Player] Step 1: Getting direct URL...');
        const directUrl = await getStreamUrl(song.url);
        console.log('[Player] Step 1 OK ✅');

        // Step 2: Stream through ffmpeg
        console.log('[Player] Step 2: Streaming through ffmpeg...');
        const ffmpegProcess = createFfmpegStream(directUrl);

        const resource = createAudioResource(ffmpegProcess.stdout, {
            inputType: StreamType.OggOpus,
            inlineVolume: true,
        });

        resource.volume.setVolume(queue.volume / 100);
        queue.resource = resource;
        queue.ffmpegProcess = ffmpegProcess;

        if (!queue.player) {
            queue.player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                },
            });

            queue.player.on('error', (error) => {
                console.error('Audio player error:', error.message);
                cleanupProcess(queue);
                if (queue.textChannel) {
                    queue.textChannel.send(`❌ เกิดข้อผิดพลาดในการเล่นเพลง: ${song.title}`);
                }
                queue.songs.shift();
                setTimeout(() => playSong(client, guildId), 1000);
            });

            queue.player.on(AudioPlayerStatus.Idle, () => {
                console.log('[Player] Song finished (idle)');
                cleanupProcess(queue);
                if (queue.loop) {
                    playSong(client, guildId);
                } else {
                    queue.songs.shift();
                    playSong(client, guildId);
                }
            });

            queue.connection.subscribe(queue.player);
        }

        queue.player.play(resource);
        queue.playing = true;

        if (queue.textChannel) {
            const embed = createNowPlayingEmbed(song);
            queue.textChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Final playback error:', error.message);
        cleanupProcess(queue);
        if (queue.textChannel) {
            queue.textChannel.send(`❌ ไม่สามารถเล่นเพลง **${song.title}** ได้ — ข้ามไปเพลงถัดไป\n*(Error: ${error.message})*`);
        }
        queue.songs.shift();
        setTimeout(() => playSong(client, guildId), 1000);
    }
}

function cleanupProcess(queue) {
    if (queue.ffmpegProcess) {
        queue.ffmpegProcess.kill('SIGTERM');
        queue.ffmpegProcess = null;
    }
    if (queue.ytdlpProcess) {
        queue.ytdlpProcess.kill('SIGTERM');
        queue.ytdlpProcess = null;
    }
}

module.exports = { playSong };
