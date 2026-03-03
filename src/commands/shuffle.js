const { createSuccessEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'shuffle',
    aliases: ['sh', 'mix'],
    description: 'สับเปลี่ยนลำดับคิวเพลง',
    async execute(msg) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || queue.songs.length <= 2) {
            return msg.reply({ embeds: [createErrorEmbed('ต้องมีเพลงในคิวอย่างน้อย 2 เพลงถึงจะ shuffle ได้!')] });
        }

        queue.shuffle();
        await msg.send({ embeds: [createSuccessEmbed(`สับเปลี่ยนลำดับ ${queue.queueLength} เพลงในคิวแล้ว 🔀`)] });
    },
};
