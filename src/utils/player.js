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

// yt-dlp path
let ytDlpPath = '/usr/local/bin/yt-dlp';
if (!fs.existsSync(ytDlpPath)) {
    try {
        ytDlpPath = require('youtube-dl-exec/src/util').getBinPath();
    } catch {
        ytDlpPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
    }
}
console.log(`[Player] yt-dlp: ${ytDlpPath}`);

const cookiesFile = path.join(process.cwd(), 'cookies.txt');
const hasCookies = fs.existsSync(cookiesFile);
if (hasCookies) console.log('[Player] cookies.txt found ✅');

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

        // yt-dlp downloads audio and pipes to stdout → ffmpeg converts to opus → Discord
        const ytdlpArgs = [
            song.url,
            '-o', '-',                    // pipe to stdout
            '-f', 'ba/b',                 // best audio, fallback to best anything
            '--no-check-formats',         // don't verify formats before downloading
            '--no-playlist',
            '--no-warnings',
            '--force-ipv4',
            '--extractor-args', 'youtube:player_client=web',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        ];

        if (hasCookies) {
            ytdlpArgs.push('--cookies', cookiesFile);
        }

        console.log('[Player] Starting yt-dlp → ffmpeg pipeline...');

        // Spawn yt-dlp: downloads and pipes raw audio/video to stdout
        const ytdlp = spawn(ytDlpPath, ytdlpArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        // Spawn ffmpeg: takes yt-dlp output, extracts audio, encodes to opus
        const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0',              // read from stdin (yt-dlp output)
            '-vn',                        // no video
            '-acodec', 'libopus',
            '-f', 'opus',
            '-ar', '48000',
            '-ac', '2',
            '-b:a', '128k',
            '-loglevel', 'error',
            'pipe:1',                     // output to stdout
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Pipe: yt-dlp stdout → ffmpeg stdin
        ytdlp.stdout.pipe(ffmpeg.stdin);

        // Handle yt-dlp errors
        ytdlp.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg && !msg.includes('[download]')) {
                console.warn('[yt-dlp]', msg);
            }
        });

        ytdlp.on('error', (err) => {
            console.error('[yt-dlp process error]', err.message);
        });

        ytdlp.on('close', (code) => {
            if (code && code !== 0) {
                console.warn(`[yt-dlp] exited with code ${code}`);
            }
            // Close ffmpeg stdin when yt-dlp finishes
            ffmpeg.stdin.end();
        });

        // Handle ffmpeg errors
        ffmpeg.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) console.warn('[ffmpeg]', msg);
        });

        ffmpeg.on('error', (err) => {
            console.error('[ffmpeg process error]', err.message);
        });

        // Create audio resource from ffmpeg output
        const resource = createAudioResource(ffmpeg.stdout, {
            inputType: StreamType.OggOpus,
            inlineVolume: true,
        });

        resource.volume.setVolume(queue.volume / 100);
        queue.resource = resource;
        queue.ytdlpProcess = ytdlp;
        queue.ffmpegProcess = ffmpeg;

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
    if (queue.ytdlpProcess) {
        queue.ytdlpProcess.kill('SIGTERM');
        queue.ytdlpProcess = null;
    }
    if (queue.ffmpegProcess) {
        queue.ffmpegProcess.kill('SIGTERM');
        queue.ffmpegProcess = null;
    }
}

module.exports = { playSong };
