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

// Determine yt-dlp path (Docker: pip install, Local: youtube-dl-exec bundled)
let ytDlpPath = 'yt-dlp'; // Default: assume it's in PATH (Docker)
if (process.platform === 'win32') {
    // Windows local dev — use bundled yt-dlp from youtube-dl-exec
    const localBin = path.join(process.cwd(), 'yt-dlp.exe');
    if (fs.existsSync(localBin)) {
        ytDlpPath = localBin;
    } else {
        try {
            ytDlpPath = require('youtube-dl-exec/src/util').getBinPath();
        } catch {
            ytDlpPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
        }
    }
}
console.log(`[Player] yt-dlp path: ${ytDlpPath}`);

// Cookies file for age-restricted content
const cookiesFile = path.join(process.cwd(), 'cookies.txt');
const hasCookies = fs.existsSync(cookiesFile);
if (hasCookies) console.log('[Player] cookies.txt found ✅');

// ffmpeg path — use ffmpeg-static if available, otherwise system ffmpeg
let ffmpegPath = 'ffmpeg';
try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        ffmpegPath = ffmpegStatic;
    }
} catch { /* use system ffmpeg */ }
console.log(`[Player] ffmpeg path: ${ffmpegPath}`);

/**
 * Get the best audio stream URL using yt-dlp
 */
async function getAudioUrl(url, useCookies = hasCookies) {
    return new Promise((resolve, reject) => {
        const args = [
            '--no-playlist',
            '-f', 'bestaudio/best', // The most robust format selection
            '--extractor-args', 'youtube:player_client=android', // Bypass YouTube bot checks
            '-g', // Print URL only, don't download
            '--no-warnings',
            '--no-check-certificates',
        ];

        if (useCookies) {
            args.push('--cookies', cookiesFile);
        }

        args.push(url);

        console.log(`[yt-dlp] Getting audio URL for: ${url} (Cookies: ${useCookies})`);
        const proc = spawn(ytDlpPath, args, { windowsHide: true });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                const errMsg = stderr.split('\n')[0] || 'Unknown error';
                console.error(`[yt-dlp] Exit code ${code}: ${errMsg}`);
                
                // Fallback: If we used cookies and it failed (e.g., expired cookies), try again without cookies
                if (useCookies) {
                    console.log(`[yt-dlp] Retrying without cookies...`);
                    resolve(getAudioUrl(url, false));
                } else {
                    reject(new Error(`yt-dlp failed: ${errMsg}`));
                }
                return;
            }
            const audioUrl = stdout.trim().split('\n')[0];
            if (!audioUrl) {
                reject(new Error('yt-dlp returned empty URL'));
                return;
            }
            console.log(`[yt-dlp] Got audio URL ✅ (${audioUrl.substring(0, 80)}...)`);
            resolve(audioUrl);
        });

        proc.on('error', (err) => {
            reject(new Error(`yt-dlp not found: ${err.message}`));
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            proc.kill('SIGTERM');
            reject(new Error('yt-dlp timed out (30s)'));
        }, 30000);
    });
}

/**
 * Stream audio through ffmpeg and create Discord audio resource
 */
function createFfmpegStream(audioUrl) {
    const args = [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', audioUrl,
        '-vn',                  // No video
        '-ac', '2',             // Stereo
        '-ar', '48000',         // 48kHz (Discord standard)
        '-f', 'opus',           // Opus output
        '-acodec', 'libopus',   // Opus codec
        '-b:a', '128k',         // 128kbps bitrate
        'pipe:1',               // Output to stdout
    ];

    const ffmpeg = spawn(ffmpegPath, args, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString();
        // Only log errors, not progress
        if (msg.includes('Error') || msg.includes('error')) {
            console.error('[ffmpeg]', msg.trim());
        }
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

        // Step 1: Get the direct audio URL via yt-dlp
        const audioUrl = await getAudioUrl(song.url);

        // Step 2: Stream through ffmpeg
        const ffmpegProcess = createFfmpegStream(audioUrl);
        queue.ffmpegProcess = ffmpegProcess;

        // Step 3: Create Discord audio resource from ffmpeg stdout
        const resource = createAudioResource(ffmpegProcess.stdout, {
            inputType: StreamType.OggOpus,
            inlineVolume: true,
        });

        resource.volume.setVolume(queue.volume / 100);
        queue.resource = resource;

        // Handle ffmpeg errors
        ffmpegProcess.on('error', (err) => {
            console.error('[ffmpeg] Process error:', err.message);
        });

        ffmpegProcess.on('close', (code) => {
            if (code !== 0 && code !== null) {
                console.warn(`[ffmpeg] Exited with code ${code}`);
            }
        });

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
