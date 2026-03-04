const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const play = require('play-dl');
const { getQueue } = require('../utils/queue');
const { playSong } = require('../utils/player');
const { createAddedToQueueEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'play',
    aliases: ['p'],
    description: 'เปิดเพลงจาก YouTube URL หรือค้นหา',
    async execute(msg, args) {
        const voiceChannel = msg.member.voice.channel;
        if (!voiceChannel) {
            return msg.reply({ embeds: [createErrorEmbed('คุณต้องอยู่ใน Voice Channel ก่อนนะ!')] });
        }

        // Check bot permissions
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return msg.reply({ embeds: [createErrorEmbed('บอทไม่มีสิทธิ์ Connect หรือ Speak ในห้องนี้!')] });
        }

        if (!args.length) {
            return msg.reply({ embeds: [createErrorEmbed('กรุณาใส่ชื่อเพลงหรือ URL!')] });
        }

        const query = args.join(' ');
        const queue = getQueue(msg.client, msg.guild.id);
        queue.textChannel = msg.channel;

        try {
            let songInfo;

            // Use play-dl for EVERYTHING (Search and URL validation)
            const videoType = play.yt_validate(query);

            if (videoType && videoType !== 'search') {
                // It's a URL
                const info = await play.video_basic_info(query);
                songInfo = {
                    title: info.video_details.title,
                    url: info.video_details.url,
                    duration: info.video_details.durationInSec,
                    thumbnail: info.video_details.thumbnails[0]?.url || null,
                    requestedBy: msg.author,
                };
            } else {
                // It's a search query
                const results = await play.search(query, { limit: 1, source: { youtube: 'video' } });
                if (!results.length) {
                    return msg.reply({ embeds: [createErrorEmbed(`ไม่พบผลลัพธ์สำหรับ: **${query}**`)] });
                }
                const video = results[0];
                songInfo = {
                    title: video.title,
                    url: video.url,
                    duration: video.durationInSec,
                    thumbnail: video.thumbnails[0]?.url || null,
                    requestedBy: msg.author,
                };
            }

            // Safety check
            if (!songInfo.url) {
                return msg.reply({ embeds: [createErrorEmbed('ไม่สามารถดึง URL ของเพลงได้ ลองใหม่อีกครั้ง!')] });
            }

            console.log(`[Play] Adding: ${songInfo.title} | URL: ${songInfo.url}`);
            queue.addSong(songInfo);

            if (!queue.connection) {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: msg.guild.id,
                    adapterCreator: msg.guild.voiceAdapterCreator,
                });
                queue.connection = connection;

                // Log connection state changes
                connection.on('stateChange', (oldState, newState) => {
                    console.log(`[Voice] Connection: ${oldState.status} → ${newState.status}`);
                });

                connection.on('error', (error) => {
                    console.error('Voice connection error:', error);
                });

                // Handle disconnection recovery
                connection.on(VoiceConnectionStatus.Disconnected, async () => {
                    try {
                        await Promise.race([
                            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                        // Reconnecting...
                    } catch (error) {
                        connection.destroy();
                    }
                });

                // Wait for connection to be ready
                try {
                    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
                    console.log('[Voice] Connection is Ready! ✅');
                } catch (err) {
                    console.error('[Voice] Connection failed:', err.message);
                    connection.destroy();
                    queue.connection = null;
                    return msg.reply({ embeds: [createErrorEmbed('ไม่สามารถเชื่อมต่อ Voice Channel ได้! ลอง kick bot ออกจากห้องแล้วลองใหม่')] });
                }

                await msg.reply({ embeds: [createAddedToQueueEmbed(songInfo, 0)] });
                playSong(msg.client, msg.guild.id);
            } else {
                const embed = createAddedToQueueEmbed(songInfo, queue.queueLength);
                await msg.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Play command error:', error);
            msg.reply({ embeds: [createErrorEmbed('ไม่สามารถเล่นเพลงนี้ได้ ลองใหม่อีกครั้ง!')] });
        }
    },
};
