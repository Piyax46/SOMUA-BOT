const { AudioPlayerStatus } = require('@discordjs/voice');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'pause',
    aliases: [],
    description: 'พักเพลง',
    async execute(msg) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || !queue.player) {
            return msg.reply({ embeds: [createErrorEmbed('ไม่มีเพลงที่กำลังเล่นอยู่!')] });
        }

        if (queue.player.state.status === AudioPlayerStatus.Paused) {
            return msg.reply({ embeds: [createErrorEmbed('เพลงพักอยู่แล้ว! ใช้ `/resume` เพื่อเล่นต่อ')] });
        }

        queue.player.pause();
        await msg.send({ embeds: [createSuccessEmbed('พักเพลงแล้ว ⏸️')] });
    },
};
