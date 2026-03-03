const { createSuccessEmbed, createErrorEmbed } = require('../utils/embed');

module.exports = {
    name: 'remove',
    aliases: ['rm'],
    description: 'ลบเพลงออกจากคิว',
    async execute(msg, args) {
        const queue = msg.client.queues.get(msg.guild.id);
        if (!queue || queue.songs.length <= 1) {
            return msg.reply({ embeds: [createErrorEmbed('ไม่มีเพลงในคิวที่จะลบ!')] });
        }

        if (!args.length) {
            return msg.reply({ embeds: [createErrorEmbed('กรุณาใส่เลขเพลงที่ต้องการลบ! เช่น `/remove 2`')] });
        }

        const index = parseInt(args[0]);
        if (isNaN(index) || index < 1 || index >= queue.songs.length) {
            return msg.reply({ embeds: [createErrorEmbed(`กรุณาใส่เลข 1-${queue.songs.length - 1}`)] });
        }

        const removed = queue.removeSong(index);
        if (removed) {
            await msg.send({ embeds: [createSuccessEmbed(`ลบ **${removed.title}** ออกจากคิวแล้ว 🗑️`)] });
        }
    },
};
