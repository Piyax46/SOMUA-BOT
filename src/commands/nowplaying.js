const { EmbedBuilder } = require('discord.js');
const { COLORS, formatDuration, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'nowplaying',
    aliases: ['np', 'current'],
    description: 'แสดงเพลงที่กำลังเล่น',
    async execute(msg) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || !queue.songs.length) {
            return msg.reply({ embeds: [createErrorEmbed('ไม่มีเพลงที่กำลังเล่นอยู่!')] });
        }

        const song = queue.songs[0];
        const embed = new EmbedBuilder()
            .setColor(COLORS.primary)
            .setTitle('🎵 กำลังเล่นตอนนี้')
            .setDescription(`**[${song.title}](${song.url})**`)
            .setThumbnail(song.thumbnail)
            .addFields(
                { name: '⏱️ ความยาว', value: formatDuration(song.duration), inline: true },
                { name: '👤 ขอเพลงโดย', value: `${song.requestedBy}`, inline: true },
                { name: '🔊 Volume', value: `${queue.volume}%`, inline: true },
                { name: '🔁 Loop', value: queue.loop ? 'เปิด' : 'ปิด', inline: true },
                { name: '📋 เพลงในคิว', value: `${queue.queueLength} เพลง`, inline: true },
            )
            .setFooter({ text: 'Somua Bot 🎶' })
            .setTimestamp();

        await msg.send({ embeds: [embed] });
    },
};
