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
const { deleteQueue } = require('./queue');
const { createNowPlayingEmbed } = require('./embed');

// Prefer system yt-dlp (installed via pip in Dockerfile — always latest)
let ytDlpPath = '/usr/local/bin/yt-dlp';
if (!fs.existsSync(ytDlpPath)) {
    try {
        ytDlpPath = require('youtube-dl-exec/src/util').getBinPath();
    } catch {
        ytDlpPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
    }
}
console.log(`[Player] Using yt-dlp: ${ytDlpPath}`);

const cookiesFile = path.join(process.cwd(), 'cookies.txt');
const hasCookies = fs.existsSync(cookiesFile);
if (hasCookies) console.log('[Player] cookies.txt found ✅');

/**
 * Step 1: Use yt-dlp to get direct stream URL(s)
 */
function getStreamUrl(songUrl) {
    return new Promise((resolve, reject) => {
        const args = [
            '--get-url',
            songUrl,
            '--no-warnings',
            '--no-check-certificates',
            '--no-playlist',
        ];
        if (hasCookies) args.push('--cookies', cookiesFile);

        const proc = spawn(ytDlpPath, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            if (code === 0 && stdout.trim()) {
                // yt-dlp may return 2 URLs (video + audio), take the last one
                const urls = stdout.trim().split('\n').filter(u => u.startsWith('http'));
                resolve(urls[urls.length - 1]);
            } else {
                reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
            }
        });

        proc.on('error', (err) => reject(err));
    });
}

/**
 * Step 2: Stream audio through ffmpeg from the direct URL
 */
function createFfmpegStream(directUrl) {
    const ffmpeg = spawn('ffmpeg', [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', directUrl,
        '-vn',                    // No video
        '-acodec', 'libopus',     // Encode to opus (Discord's native format)
        '-f', 'opus',
        '-ar', '48000',           // 48kHz (Discord standard)
        '-ac', '2',               // Stereo
        '-loglevel', 'error',
        'pipe:1',                 // Output to stdout
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

        // Step 1: Get direct stream URL from yt-dlp
        console.log('[Player] Step 1: Getting direct URL via yt-dlp...');
        const directUrl = await getStreamUrl(song.url);
        console.log('[Player] Step 1 OK: Got direct URL ✅');

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
