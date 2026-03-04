const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType,
} = require('@discordjs/voice');
const play = require('play-dl');
const path = require('path');
const fs = require('fs');
const { deleteQueue } = require('./queue');
const { createNowPlayingEmbed } = require('./embed');

const cookiesPath = path.join(process.cwd(), 'cookies.txt');

// Global flag to track if play-dl is initialized
let playDlInitialized = false;

async function initPlayDl() {
    if (playDlInitialized) return;
    try {
        if (fs.existsSync(cookiesPath)) {
            console.log('[Player] Loading cookies.txt into play-dl');
            await play.setToken({
                youtube: {
                    cookie: fs.readFileSync(cookiesPath, 'utf8')
                }
            });
        }
        playDlInitialized = true;
    } catch (err) {
        console.error('[Player] Failed to initialize play-dl with cookies:', err.message);
    }
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
        await initPlayDl();
        console.log(`[Player] Streaming: ${song.title} | URL: ${song.url}`);

        if (!song.url || song.url === 'undefined') {
            throw new Error('Invalid song URL');
        }

        // Get stream from play-dl
        const stream = await play.stream(song.url, {
            quality: 2, // High quality audio
            seek: 0
        });

        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true,
        });

        resource.volume.setVolume(queue.volume / 100);
        queue.resource = resource;

        // Create player if needed
        if (!queue.player) {
            queue.player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                },
            });

            queue.player.on('error', (error) => {
                console.error('Audio player error:', error.message);
                if (queue.textChannel) {
                    queue.textChannel.send(`❌ เกิดข้อผิดพลาดในการเล่นเพลง: ${song.title}`);
                }
                queue.songs.shift();
                setTimeout(() => playSong(client, guildId), 1000);
            });

            queue.player.on(AudioPlayerStatus.Idle, () => {
                console.log('[Player] Song finished (idle)');
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

        if (queue.textChannel) {
            const embed = createNowPlayingEmbed(song);
            queue.textChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error playing song:', error.message);
        if (queue.textChannel) {
            queue.textChannel.send(`❌ ไม่สามารถเล่นเพลง **${song.title}** ได้ — ข้ามไปเพลงถัดไป\n*(Error: ${error.message})*`);
        }
        queue.songs.shift();
        setTimeout(() => playSong(client, guildId), 1000);
    }
}

module.exports = { playSong };
