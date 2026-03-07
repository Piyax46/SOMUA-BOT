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

const cookiesFile = path.join(process.cwd(), 'cookies.txt');

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
 * Parse cookies.txt into a cookie header string
 */
function getCookieHeader() {
    try {
        if (!fs.existsSync(cookiesFile)) return '';
        const content = fs.readFileSync(cookiesFile, 'utf8');
        return content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const parts = line.split('\t');
                if (parts.length >= 7) return `${parts[5]}=${parts[6]}`;
                return null;
            })
            .filter(Boolean)
            .join('; ');
    } catch { return ''; }
}

const cookieHeader = getCookieHeader();
if (cookieHeader) console.log('[Player] Cookies loaded ✅');

/**
 * Method 1: YouTube Innertube API (direct — most reliable)
 * Uses the TV embedded player client which is less restricted
 */
async function getStreamUrlFromInnertube(videoId) {
    // Try multiple client configurations
    const clients = [
        {
            name: 'TV_EMBEDDED',
            body: {
                videoId,
                context: {
                    client: {
                        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
                        clientVersion: '2.0',
                        hl: 'th',
                        gl: 'TH',
                    },
                    thirdParty: {
                        embedUrl: 'https://www.google.com',
                    },
                },
            },
            key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
        },
        {
            name: 'ANDROID',
            body: {
                videoId,
                context: {
                    client: {
                        clientName: 'ANDROID',
                        clientVersion: '19.09.37',
                        androidSdkVersion: 30,
                        hl: 'th',
                        gl: 'TH',
                    },
                },
            },
            key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
        },
        {
            name: 'IOS',
            body: {
                videoId,
                context: {
                    client: {
                        clientName: 'IOS',
                        clientVersion: '19.09.3',
                        deviceModel: 'iPhone14,3',
                        hl: 'th',
                        gl: 'TH',
                    },
                },
            },
            key: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
        },
    ];

    for (const client of clients) {
        try {
            console.log(`[Player] Trying Innertube ${client.name}...`);

            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': client.name === 'IOS'
                    ? 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)'
                    : client.name === 'ANDROID'
                        ? 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
                        : 'Mozilla/5.0',
            };

            // Add cookies if available
            if (cookieHeader) {
                headers['Cookie'] = cookieHeader;
            }

            const response = await axios.post(
                `https://www.youtube.com/youtubei/v1/player?key=${client.key}&prettyPrint=false`,
                client.body,
                { headers, timeout: 15000 }
            );

            const data = response.data;

            // Check for playability
            if (data.playabilityStatus?.status !== 'OK') {
                console.warn(`[Player] ${client.name}: ${data.playabilityStatus?.status} - ${data.playabilityStatus?.reason || 'unknown'}`);
                continue;
            }

            // Get audio formats from adaptive formats
            const formats = data.streamingData?.adaptiveFormats || [];
            const audioFormats = formats.filter(f => f.mimeType && f.mimeType.startsWith('audio/'));

            if (audioFormats.length === 0) {
                console.warn(`[Player] ${client.name}: No audio formats found`);
                continue;
            }

            // Sort by bitrate (highest first), prefer opus
            audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            const opusFormat = audioFormats.find(f => f.mimeType.includes('opus'));
            const bestFormat = opusFormat || audioFormats[0];

            const streamUrl = bestFormat.url || null;
            if (!streamUrl) {
                // Some formats use signatureCipher instead of direct URL
                console.warn(`[Player] ${client.name}: Format has no direct URL (cipher protected)`);
                continue;
            }

            console.log(`[Player] Innertube ${client.name} OK: ${bestFormat.mimeType} ${Math.round(bestFormat.bitrate / 1000)}kbps ✅`);
            return streamUrl;
        } catch (err) {
            console.warn(`[Player] Innertube ${client.name} failed:`, err.response?.status || err.message);
        }
    }

    return null;
}

/**
 * Method 2: Piped API instances (public YouTube proxy)
 */
async function getStreamUrlFromPiped(videoId) {
    const instances = [
        'https://pipedapi.kavin.rocks',
        'https://pipedapi.leptons.xyz',
        'https://pipedapi.reallyaweso.me',
        'https://pipedapi.drgns.space',
    ];

    for (const instance of instances) {
        try {
            const response = await axios.get(`${instance}/streams/${videoId}`, { timeout: 8000 });
            const audioStreams = response.data.audioStreams || [];
            if (audioStreams.length === 0) continue;

            audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            const best = audioStreams.find(s => s.codec === 'opus') || audioStreams[0];
            console.log(`[Player] Piped ${instance} OK ✅`);
            return best.url;
        } catch (err) {
            // Silent fail, move to next
        }
    }
    return null;
}

/**
 * Get the best available stream URL
 */
async function getStreamUrl(songUrl) {
    const videoId = extractVideoId(songUrl);
    if (!videoId) throw new Error('Cannot extract video ID from URL');

    // 1. YouTube Innertube API (direct, most reliable)
    const innertubeUrl = await getStreamUrlFromInnertube(videoId);
    if (innertubeUrl) return innertubeUrl;

    // 2. Piped API (proxy)
    const pipedUrl = await getStreamUrlFromPiped(videoId);
    if (pipedUrl) return pipedUrl;

    throw new Error('ไม่สามารถดึง URL เพลงได้จากทุกวิธี — YouTube อาจบล็อคเพลงนี้');
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
}

module.exports = { playSong };
