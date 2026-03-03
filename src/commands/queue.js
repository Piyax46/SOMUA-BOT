const { createQueueEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'queue',
    aliases: ['q'],
    description: 'แสดงคิวเพลง',
    async execute(msg, args) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || !queue.songs.length) {
            return msg.reply({ embeds: [createErrorEmbed('คิวเพลงว่างอยู่!')] });
        }

        const page = args[0] ? parseInt(args[0]) - 1 : 0;
        const totalPages = Math.ceil(Math.max(1, queue.songs.length - 1) / 10);

        if (page < 0 || page >= totalPages) {
            return msg.reply({ embeds: [createErrorEmbed(`กรุณาใส่หน้าที่ 1-${totalPages}`)] });
        }

        const embed = createQueueEmbed(queue, page);
        await msg.send({ embeds: [embed] });
    },
};
