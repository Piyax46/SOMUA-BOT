const { createSuccessEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'volume',
    aliases: ['vol', 'v'],
    description: 'ปรับระดับเสียง (0-100)',
    async execute(msg, args) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || !queue.songs.length) {
            return msg.reply({ embeds: [createErrorEmbed('ไม่มีเพลงที่กำลังเล่นอยู่!')] });
        }

        if (!args.length) {
            return msg.reply({ embeds: [createSuccessEmbed(`🔊 ระดับเสียงตอนนี้: **${queue.volume}%**`)] });
        }

        const volume = parseInt(args[0]);
        if (isNaN(volume) || volume < 0 || volume > 100) {
            return msg.reply({ embeds: [createErrorEmbed('กรุณาใส่ตัวเลข 0-100!')] });
        }

        queue.volume = volume;
        if (queue.resource && queue.resource.volume) {
            queue.resource.volume.setVolume(volume / 100);
        }

        const icon = volume === 0 ? '🔇' : volume < 30 ? '🔈' : volume < 70 ? '🔉' : '🔊';
        await msg.send({ embeds: [createSuccessEmbed(`${icon} ปรับระดับเสียงเป็น **${volume}%**`)] });
    },
};
