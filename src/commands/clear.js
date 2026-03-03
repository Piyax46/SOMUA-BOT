const { createSuccessEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'clear',
    aliases: ['cl'],
    description: 'ล้างคิวเพลงทั้งหมด (ยกเว้นเพลงที่เล่นอยู่)',
    async execute(msg) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || queue.songs.length <= 1) {
            return msg.reply({ embeds: [createErrorEmbed('ไม่มีเพลงในคิว!')] });
        }

        const count = queue.songs.length - 1;
        queue.clear();
        await msg.send({ embeds: [createSuccessEmbed(`ล้างคิวเพลง ${count} เพลงแล้ว 🧹`)] });
    },
};
