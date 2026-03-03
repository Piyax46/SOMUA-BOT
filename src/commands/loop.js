const { createSuccessEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'loop',
    aliases: ['lp', 'repeat'],
    description: 'เปิด/ปิด loop เพลงปัจจุบัน',
    async execute(msg) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || !queue.songs.length) {
            return msg.reply({ embeds: [createErrorEmbed('ไม่มีเพลงที่กำลังเล่นอยู่!')] });
        }

        queue.loop = !queue.loop;
        const status = queue.loop ? 'เปิด 🔁' : 'ปิด ➡️';
        await msg.send({ embeds: [createSuccessEmbed(`Loop: **${status}**`)] });
    },
};
