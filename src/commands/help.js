const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../utils/embed');

module.exports = {
    name: 'help',
    aliases: ['h', 'commands'],
    description: 'แสดงรายการคำสั่งทั้งหมด',
    async execute(msg) {
        const embed = new EmbedBuilder()
            .setColor(COLORS.primary)
            .setTitle('🎵🤖 Somua Bot — คำสั่งทั้งหมด')
            .setDescription('บอทเพลง + AI ครบจบในตัวเดียว!\nใช้ได้ทั้ง `/command` และ `!command`')
            .addFields(
                {
                    name: '💬 AI Chat',
                    value: [
                        '**@SoMua** หรือ reply ข้อความบอท — ถามอะไรก็ได้!',
                        '**เปิดเพลง**: พิมพ์ "เปิดเพลง XXX" บอทจะเปิดให้เอง',
                        '**ค้นหา**: พิมพ์ "ช่วยหา XXX" บอทจะ search ให้',
                        '**ข่าว**: พิมพ์ "ข่าว XXX" บอทจะหาข่าวให้',
                    ].join('\n'),
                },
                {
                    name: '🎶 เล่นเพลง',
                    value: [
                        '`/play <ชื่อ/url>` — เปิดเพลงหรือเพิ่มเข้าคิว',
                        '`/skip` — ข้ามเพลงปัจจุบัน',
                        '`/stop` — หยุดเพลงและออกจากห้อง',
                        '`/pause` / `/resume` — พัก/เล่นต่อ',
                    ].join('\n'),
                },
                {
                    name: '📋 คิวเพลง',
                    value: [
                        '`/queue [หน้า]` — แสดงคิวเพลง',
                        '`/remove <เลข>` — ลบเพลงออกจากคิว',
                        '`/clear` — ล้างคิวทั้งหมด',
                        '`/shuffle` — สับเปลี่ยนลำดับ',
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
                {
                    name: '🔍 ค้นหา & ข่าว',
                    value: [
                        '`!search <คำค้นหา>` — ค้นหา Google',
                        '`!news <หัวข้อ>` — ดูข่าวล่าสุด 7 วัน',
                        '`!กินอะไรดี` — สุ่มเมนูอาหาร 🍜',
                    ].join('\n'),
                },
            )
            .setFooter({ text: 'Somua Bot 🎶🤖 • Made with ❤️' })
            .setTimestamp();

        await msg.send({ embeds: [embed] });
    },
};
