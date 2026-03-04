const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { deleteQueue } = require('./queue');
const { createNowPlayingEmbed } = require('./embed');

// Get yt-dlp binary path (cross-platform)
let ytdlpPath = 'yt-dlp'; // Default to PATH

if (process.platform === 'win32') {
    const pkgBin = path.join(
        path.dirname(require.resolve('youtube-dl-exec')),
        '..', 'bin', 'yt-dlp.exe'
    );
    if (fs.existsSync(pkgBin)) {
        ytdlpPath = pkgBin;
    }
} else {
    // On Linux (Railway), prefer the one installed to /usr/local/bin in Dockerfile
    if (fs.existsSync('/usr/local/bin/yt-dlp')) {
        ytdlpPath = '/usr/local/bin/yt-dlp';
    } else {
        const pkgBin = path.join(
            path.dirname(require.resolve('youtube-dl-exec')),
            '..', 'bin', 'yt-dlp'
        );
        if (fs.existsSync(pkgBin)) {
            ytdlpPath = pkgBin;
        }
    }
}

const ffmpegPath = require('ffmpeg-static');
const tmpDir = path.join(os.tmpdir(), 'somua-bot');

// Ensure temp directory exists
if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
}

const cookiesPath = path.join(process.cwd(), 'cookies.txt');

async function downloadAudio(url, outputPath) {
    return new Promise((resolve, reject) => {
        // Use 'ba*' to find ANY available audio stream to prevent "format not available" errors
        const ytdlpArgs = [
            url,
            '--format', 'ba*',
            '--quiet',
            '--no-warnings',
            '--no-check-certificates',
            '--no-playlist',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '--ffmpeg-location', path.dirname(ffmpegPath),
            '-o', outputPath,
        ];

        if (fs.existsSync(cookiesPath)) {
            console.log('[Player] Using cookies.txt for authentication');
            ytdlpArgs.push('--cookies', cookiesPath);
        }

        console.log(`[Player] Using yt-dlp at: ${ytdlpPath}`);
        const ytdlp = spawn(ytdlpPath, ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

        ytdlp.stderr.on('data', (d) => {
            const msg = d.toString().trim();
            if (msg) console.log('[yt-dlp]', msg);
        });

        ytdlp.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`yt-dlp exited with code ${code}`));
            }
        });

        ytdlp.on('error', reject);
    });
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

        // Download audio to temp file
        const tempFile = path.join(tmpDir, `${guildId}_${Date.now()}.mp3`);
        console.log(`[Player] Downloading to: ${tempFile}`);
        await downloadAudio(song.url, tempFile);
        console.log(`[Player] Download complete! Size: ${fs.statSync(tempFile).size} bytes`);

        // Let @discordjs/voice handle EVERYTHING (format detection, ffmpeg, opus encoding)
        const resource = createAudioResource(tempFile, {
            inlineVolume: true,
        });

        resource.volume.setVolume(queue.volume / 100);
        queue.resource = resource;
        queue._tempFile = tempFile;

        // Create player if needed
        if (!queue.player) {
            queue.player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                },
            });

            queue.player.on('error', (error) => {
                console.error('Audio player error:', error.message);
                cleanupFile(tempFile);
                if (queue.textChannel) {
                    queue.textChannel.send(`❌ เกิดข้อผิดพลาดในการเล่นเพลง: ${song.title}`);
                }
                queue.songs.shift();
                setTimeout(() => playSong(client, guildId), 1000);
            });

            queue.player.on(AudioPlayerStatus.Idle, () => {
                console.log('[Player] Song finished (idle)');
                cleanupFile(tempFile);
                if (queue.loop) {
                    playSong(client, guildId);
                } else {
                    queue.songs.shift();
                    playSong(client, guildId);
                }
            });

            queue.connection.subscribe(queue.player);
            console.log('[Player] Player subscribed to connection');
        }

        queue.player.play(resource);
        queue.playing = true;
        console.log('[Player] Now playing!');

        queue.player.on('stateChange', (oldState, newState) => {
            console.log(`[Player] State: ${oldState.status} → ${newState.status}`);
        });

        if (queue.textChannel) {
            const embed = createNowPlayingEmbed(song);
            queue.textChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error playing song:', error.message);
        if (queue.textChannel) {
            queue.textChannel.send(`❌ ไม่สามารถเล่นเพลง **${song.title}** ได้ — ข้ามไปเพลงถัดไป`);
        }
        queue.songs.shift();
        setTimeout(() => playSong(client, guildId), 1000);
    }
}

function cleanupFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) { }
}

module.exports = { playSong };
