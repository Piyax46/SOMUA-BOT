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

        // Use play-dl to get audio stream
        const play = require('play-dl');

        // Pass cookies to play-dl if playing YouTube
        let stream;
        try {
            if (song.source === 'soundcloud' || !song.url.includes('youtube')) {
                stream = await play.stream(song.url);
            } else {
                // Try playing YouTube
                stream = await play.stream(song.url, {
                    discordPlayerCompatibility: true
                });
            }
        } catch (err) {
            console.error('[Player] Error getting stream:', err.message);
            throw new Error('ไม่สามารถเล่นเพลงนี้ได้ (YouTube อาจบล็อค หรือวิดีโอถูกจำกัด)');
        }

        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true,
        });

        resource.volume.setVolume(queue.volume / 100);
        queue.resource = resource;
        queue.ffmpegProcess = null; // No ffmpeg process when using play-dl directly

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
