const { AudioPlayerStatus } = require('@discordjs/voice');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'resume',
    aliases: ['r', 'unpause'],
    description: 'เล่นเพลงต่อ',
    async execute(msg) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || !queue.player) {
            return msg.reply({ embeds: [createErrorEmbed('ไม่มีเพลงที่กำลังเล่นอยู่!')] });
        }

        if (queue.player.state.status !== AudioPlayerStatus.Paused) {
            return msg.reply({ embeds: [createErrorEmbed('เพลงไม่ได้พักอยู่!')] });
        }

        queue.player.unpause();
        await msg.send({ embeds: [createSuccessEmbed('เล่นเพลงต่อแล้ว ▶️')] });
    },
};
