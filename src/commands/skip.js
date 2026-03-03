const { createSuccessEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'skip',
    aliases: ['s', 'next'],
    description: 'ข้ามเพลงปัจจุบัน',
    async execute(msg) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || !queue.songs.length) {
            return msg.reply({ embeds: [createErrorEmbed('ไม่มีเพลงที่กำลังเล่นอยู่!')] });
        }

        const skipped = queue.songs[0];
        await msg.send({ embeds: [createSuccessEmbed(`ข้ามเพลง **${skipped.title}** ⏭️`)] });

        queue.loop = false;
        if (queue.player) {
            queue.player.stop();
        }
    },
};
