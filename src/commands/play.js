const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const YouTube = require('youtube-sr').default;
const { getQueue } = require('../utils/queue');
const { playSong } = require('../utils/player');
const { createAddedToQueueEmbed, createErrorEmbed } = require('../utils/embed');

function isYouTubeURL(str) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/.+/.test(str);
}

module.exports = {
    name: 'play',
    aliases: ['p'],
    description: 'เปิดเพลงจาก YouTube URL หรือค้นหา',
    async execute(msg, args) {
        const voiceChannel = msg.member.voice.channel;
        if (!voiceChannel) {
            return msg.reply({ embeds: [createErrorEmbed('คุณต้องอยู่ใน Voice Channel ก่อนนะ!')] });
        }

        // Check bot permissions in the voice channel
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has('Connect')) {
            return msg.reply({ embeds: [createErrorEmbed('บอทไม่มีสิทธิ์ **Connect** ใน Voice Channel นี้!')] });
        }
        if (!permissions.has('Speak')) {
            return msg.reply({ embeds: [createErrorEmbed('บอทไม่มีสิทธิ์ **Speak** ใน Voice Channel นี้! ไปเพิ่ม permission ให้บอทก่อนนะ')] });
        }

        if (!args.length) {
            return msg.reply({ embeds: [createErrorEmbed('กรุณาใส่ชื่อเพลงหรือ URL! เช่น `!play ชื่อเพลง`')] });
        }

        const query = args.join(' ');
        const queue = getQueue(msg.client, msg.guild.id);
        queue.textChannel = msg.channel;

        try {
            let songInfo;

            if (isYouTubeURL(query)) {
                // Direct YouTube URL — get video info
                console.log(`[Play] Getting info for URL: ${query}`);
                const statusMsg = await msg.channel.send('🔍 *กำลังดึงข้อมูลวิดีโอ...*');
                setTimeout(() => statusMsg.delete().catch(() => {}), 5000);

                try {
                    const video = await YouTube.getVideo(query);
                    if (!video) {
                        return msg.reply({ embeds: [createErrorEmbed('ไม่พบข้อมูลเพลงจากลิงก์นี้')] });
                    }

                    songInfo = {
                        title: video.title,
                        url: video.url,
                        duration: video.duration, // Already in ms
                        thumbnail: video.thumbnail?.url || null,
                        requestedBy: msg.author,
                    };
                } catch (err) {
                    console.error('[Play] Failed to get YouTube info:', err.message);
                    // Fallback: use the URL directly with basic info
                    songInfo = {
                        title: query,
                        url: query,
                        duration: 0,
                        thumbnail: null,
                        requestedBy: msg.author,
                    };
                }
            } else {
                // Search YouTube using youtube-sr
                console.log(`[Play] Searching YouTube for: ${query}`);
                const statusMsg = await msg.channel.send('🔍 *กำลังค้นหาเพลงจาก YouTube...*');
                setTimeout(() => statusMsg.delete().catch(() => {}), 5000);

                try {
                    const results = await YouTube.search(query, { limit: 5, type: 'video' });

                    if (!results || !results.length) {
                        return msg.reply({ embeds: [createErrorEmbed('❌ ไม่พบเพลงนี้บน YouTube ลองค้นหาใหม่ดูนะ')] });
                    }

                    // Pick the first result
                    const video = results[0];
                    songInfo = {
                        title: video.title,
                        url: video.url,
                        duration: video.duration, // Already in ms
                        thumbnail: video.thumbnail?.url || null,
                        requestedBy: msg.author,
                    };
                } catch (err) {
                    console.error('[Play] YouTube search error:', err.message);
                    return msg.reply({ embeds: [createErrorEmbed('❌ เกิดข้อผิดพลาดในการค้นหาเพลง ลองใหม่อีกครั้ง')] });
                }
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
