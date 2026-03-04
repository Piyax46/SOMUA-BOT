const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType,
} = require('@discordjs/voice');
const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const path = require('path');
const fs = require('fs');
const { deleteQueue } = require('./queue');
const { createNowPlayingEmbed } = require('./embed');

const cookiesPath = path.join(process.cwd(), 'cookies.txt');

// Global flag to track if play-dl is initialized
let playDlInitialized = false;
let cookieHeader = '';

function parseNetscapeCookies(content) {
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            const parts = line.split('\t');
            if (parts.length >= 7) {
                const name = parts[5];
                const value = parts[6];
                return `${name}=${value}`;
            }
            return null;
        })
        .filter(item => item !== null)
        .join('; ');
}

async function initPlayDl() {
    if (playDlInitialized) return;
    try {
        if (fs.existsSync(cookiesPath)) {
            console.log('[Player] Parsing cookies.txt (Netscape format)');
            const rawContent = fs.readFileSync(cookiesPath, 'utf8');
            cookieHeader = parseNetscapeCookies(rawContent);

            if (cookieHeader) {
                console.log('[Player] Loading parsed cookies into play-dl');
                await play.setToken({
                    youtube: {
                        cookie: cookieHeader
                    }
                });
            }
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
    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    try {
        await initPlayDl();
        console.log(`[Player] Streaming: ${song.title} | URL: ${song.url}`);

        if (!song.url || song.url === 'undefined') {
            throw new Error('Invalid song URL');
        }

        let stream;
        let inputType;

        try {
            // Attempt 1: play-dl (Fastest)
            console.log('[Player] Attempting play-dl stream...');
            const playStream = await play.stream(song.url, {
                quality: 2,
                seek: 0,
                userAgent: USER_AGENT
            });
            stream = playStream.stream;
            inputType = playStream.type;
        } catch (err) {
            console.warn(`[Player] play-dl failed (${err.message}). Falling back to ytdl-core...`);

            // Attempt 2: ytdl-core
            stream = ytdl(song.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
                requestOptions: {
                    headers: {
                        'Cookie': cookieHeader,
                        'User-Agent': USER_AGENT
                    }
                }
            });
            inputType = StreamType.Arbitrary;
        }

        const resource = createAudioResource(stream, {
            inputType: inputType,
            inlineVolume: true,
        });

        resource.volume.setVolume(queue.volume / 100);
        queue.resource = resource;

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
