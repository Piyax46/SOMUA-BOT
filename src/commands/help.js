const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../utils/embed');

module.exports = {
    name: 'help',
    aliases: ['h', 'commands'],
    description: 'แสดงรายการคำสั่งทั้งหมด',
    async execute(msg) {
        const embed = new EmbedBuilder()
            .setColor(COLORS.primary)
            .setTitle('🎵 Somua Bot — คำสั่งทั้งหมด')
            .setDescription('บอทเปิดเพลงจาก YouTube พร้อมระบบคิว!\nใช้ได้ทั้ง `/command` และ `!command`')
            .addFields(
                {
                    name: '🎶 เล่นเพลง',
                    value: [
                        '`/play <ชื่อ/url>` — เปิดเพลงหรือเพิ่มเข้าคิว',
                        '`/skip` — ข้ามเพลงปัจจุบัน',
                        '`/stop` — หยุดเพลงและออกจากห้อง',
                        '`/pause` — พักเพลง',
                        '`/resume` — เล่นเพลงต่อ',
                    ].join('\n'),
                },
                {
                    name: '📋 คิวเพลง',
                    value: [
                        '`/queue [หน้า]` — แสดงคิวเพลง',
                        '`/remove <เลข>` — ลบเพลงออกจากคิว',
                        '`/clear` — ล้างคิวทั้งหมด',
                        '`/shuffle` — สับเปลี่ยนลำดับคิว',
                    ].join('\n'),
                },
                {
                    name: '⚙️ ตั้งค่า',
                    value: [
                        '`/nowplaying` — แสดงเพลงที่เล่นอยู่',
                        '`/volume <0-100>` — ปรับระดับเสียง',
                        '`/loop` — เปิด/ปิด loop เพลง',
                    ].join('\n'),
                },
            )
            .setFooter({ text: 'Somua Bot 🎶 • Made with ❤️' })
            .setTimestamp();

        await msg.send({ embeds: [embed] });
    },
};
