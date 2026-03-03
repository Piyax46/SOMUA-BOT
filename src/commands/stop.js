const { deleteQueue } = require('../utils/queue');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'stop',
    aliases: ['leave', 'dc', 'disconnect'],
    description: 'หยุดเพลงและออกจาก Voice Channel',
    async execute(msg) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || !queue.connection) {
            return msg.reply({ embeds: [createErrorEmbed('บอทไม่ได้อยู่ใน Voice Channel!')] });
        }

        await msg.send({ embeds: [createSuccessEmbed('หยุดเล่นเพลงและออกจากห้องแล้ว 👋')] });
        deleteQueue(msg.client, msg.guild.id);
    },
};
