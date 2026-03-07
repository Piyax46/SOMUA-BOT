const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const path = require('path');
const { deleteQueue } = require('./queue');
const { createNowPlayingEmbed } = require('./embed');

// Find yt-dlp binary from youtube-dl-exec
let ytDlpPath;
try {
    ytDlpPath = require('youtube-dl-exec/src/util').getBinPath();
} catch {
    // Fallback: try to find it in node_modules
    ytDlpPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
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

        // Use yt-dlp to pipe audio directly (most reliable method)
        const cookiesFile = path.join(process.cwd(), 'cookies.txt');
        const ytdlpArgs = [
            song.url,
            '-f', 'bestaudio[ext=webm][acodec=opus]/bestaudio/best',
            '-o', '-',           // Output to stdout
            '--no-warnings',
            '--no-check-certificates',
            '--prefer-free-formats',
            '--no-playlist',
            '--quiet',
        ];

        // Add cookies if file exists
        const fs = require('fs');
        if (fs.existsSync(cookiesFile)) {
            ytdlpArgs.push('--cookies', cookiesFile);
            console.log('[Player] Using cookies.txt for YouTube auth');
        }

        const ytdlpProcess = spawn(ytDlpPath, ytdlpArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        // Log stderr for debugging (but don't crash)
        ytdlpProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) console.warn('[yt-dlp stderr]', msg);
        });

        ytdlpProcess.on('error', (err) => {
            console.error('[yt-dlp process error]', err.message);
        });

        const stream = ytdlpProcess.stdout;

        const resource = createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
        });

        resource.volume.setVolume(queue.volume / 100);
        queue.resource = resource;

        // Store the yt-dlp process so we can kill it on skip/stop
        queue.ytdlpProcess = ytdlpProcess;

        if (!queue.player) {
            queue.player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                },
            });

            queue.player.on('error', (error) => {
                console.error('Audio player error:', error.message);
                // Kill the yt-dlp process
                if (queue.ytdlpProcess) {
                    queue.ytdlpProcess.kill('SIGTERM');
                    queue.ytdlpProcess = null;
                }
                if (queue.textChannel) {
                    queue.textChannel.send(`❌ เกิดข้อผิดพลาดในการเล่นเพลง: ${song.title}`);
                }
                queue.songs.shift();
                setTimeout(() => playSong(client, guildId), 1000);
            });

            queue.player.on(AudioPlayerStatus.Idle, () => {
                console.log('[Player] Song finished (idle)');
                // Clean up yt-dlp process
                if (queue.ytdlpProcess) {
                    queue.ytdlpProcess.kill('SIGTERM');
                    queue.ytdlpProcess = null;
                }
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
        if (queue.textChannel) {
            queue.textChannel.send(`❌ ไม่สามารถเล่นเพลง **${song.title}** ได้ — ข้ามไปเพลงถัดไป\n*(Error: ${error.message})*`);
        }
        queue.songs.shift();
        setTimeout(() => playSong(client, guildId), 1000);
    }
}

module.exports = { playSong };
