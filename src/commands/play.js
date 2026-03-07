const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const play = require('play-dl');
const { getQueue } = require('../utils/queue');
const { playSong } = require('../utils/player');
const { createAddedToQueueEmbed, createErrorEmbed } = require('../utils/embed');

function isYouTubeURL(str) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(str);
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
            return msg.reply({ embeds: [createErrorEmbed('กรุณาใส่ชื่อเพลงหรือ URL! เช่น `/play ชื่อเพลง`')] });
        }

        const query = args.join(' ');
        const queue = getQueue(msg.client, msg.guild.id);
        queue.textChannel = msg.channel;

        try {
            let songInfo;

            if (isYouTubeURL(query)) {
                // Use play-dl to get video info from URL

                let info;
                try {
                    info = await play.video_info(query);
                } catch (err) {
                    console.error('[Play] Failed to get YouTube info:', err.message);
                    return msg.reply({ embeds: [createErrorEmbed('ไม่สามารถดึงข้อมูลวิดีโอนี้ได้ (อาจถูก YouTube บล็อกหรือจำกัดอายุ)')] });
                }

                if (!info || !info.video_details) {
                    return msg.reply({ embeds: [createErrorEmbed('ไม่พบข้อมูลเพลงจากลิงก์นี้')] });
                }

                songInfo = {
                    title: info.video_details.title,
                    url: info.video_details.url,
                    duration: info.video_details.durationInSec * 1000,
                    thumbnail: info.video_details.thumbnails[0]?.url || null,
                    requestedBy: msg.author,
                };
            } else {
                // Search SoundCloud using play-dl (Since YouTube blocks Railway datacenter IP)
                console.log(`[Play] Searching SoundCloud for: ${query}`);
                msg.channel.send(`🔍 *กำลังค้นหาเพลงจาก SoundCloud... (ใช้ฐานข้อมูล SoundCloud แทน YouTube เพื่อหลีกเลี่ยงการโดนบล็อค)*`).then(m => {
                    setTimeout(() => m.delete().catch(() => { }), 5000);
                });

                try {
                    // Search SoundCloud
                    const results = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });

                    if (!results || !results.length) {
                        return msg.reply({ embeds: [createErrorEmbed('❌ ไม่พบเพลงนี้บน SoundCloud ลองหาเพลงอื่นดูนะ')] });
                    }

                    const track = results[0];
                    songInfo = {
                        title: track.name || track.title,
                        url: track.url,
                        duration: track.durationInSec * 1000,
                        thumbnail: track.thumbnail || null,
                        requestedBy: msg.author,
                        source: 'soundcloud',
                    };
                } catch (err) {
                    console.error('[Play] SoundCloud search error:', err.message);
                    return msg.reply({ embeds: [createErrorEmbed('❌ เกิดข้อผิดพลาดในการค้นหาจาก SoundCloud')] });
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
