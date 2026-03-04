const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType,
} = require('@discordjs/voice');
const play = require('play-dl');
const { deleteQueue } = require('./queue');
const { createNowPlayingEmbed } = require('./embed');

async function playSong(client, guildId) {
    const queue = client.queues.get(guildId);
    if (!queue) return;

    if (queue.songs.length === 0) {
        deleteQueue(client, guildId);
        return;
    }

    const song = queue.songs[0];

    try {
        console.log(`[Player] Playing: ${song.title} | URL: ${song.url}`);

        if (!song.url || song.url === 'undefined') {
            throw new Error('Invalid song URL');
        }

        // Get stream from play-dl (Very stable, handles auth/cookies internally)
        const stream = await play.stream(song.url, {
            discordPlayerCompatibility: true,
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
            queue.textChannel.send(`❌ ไม่สามารถเล่นเพลง **${song.title}** ได้ — ข้ามไปเพลงถัดไป`);
        }
        queue.songs.shift();
        playSong(client, guildId);
    }
}

module.exports = {
    playSong,
};
