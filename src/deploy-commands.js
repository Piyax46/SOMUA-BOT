const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('🎵 เปิดเพลงจาก YouTube (ค้นหาหรือวาง URL)')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('ชื่อเพลงหรือ YouTube URL')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('⏭️ ข้ามเพลงปัจจุบัน'),

    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('⏹️ หยุดเพลงและออกจาก Voice Channel'),

    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('📋 แสดงคิวเพลง')
        .addIntegerOption(opt =>
            opt.setName('page')
                .setDescription('หน้าที่ต้องการดู')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('pause')
        .setDescription('⏸️ พักเพลง'),

    new SlashCommandBuilder()
        .setName('resume')
        .setDescription('▶️ เล่นเพลงต่อ'),

    new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('🎵 แสดงเพลงที่กำลังเล่น'),

    new SlashCommandBuilder()
        .setName('volume')
        .setDescription('🔊 ปรับระดับเสียง')
        .addIntegerOption(opt =>
            opt.setName('level')
                .setDescription('ระดับเสียง 0-100')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(100)
        ),

    new SlashCommandBuilder()
        .setName('remove')
        .setDescription('🗑️ ลบเพลงออกจากคิว')
        .addIntegerOption(opt =>
            opt.setName('position')
                .setDescription('เลขเพลงที่ต้องการลบ')
                .setRequired(true)
                .setMinValue(1)
        ),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('🧹 ล้างคิวเพลงทั้งหมด'),

    new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('🔀 สับเปลี่ยนลำดับคิวเพลง'),

    new SlashCommandBuilder()
        .setName('loop')
        .setDescription('🔁 เปิด/ปิด loop เพลงปัจจุบัน'),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('📖 แสดงรายการคำสั่งทั้งหมดของ Somua Bot'),
];

async function deployCommands() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!token) {
        console.error('❌ DISCORD_TOKEN not found in .env');
        process.exit(1);
    }
    if (!clientId) {
        console.error('❌ CLIENT_ID not found in .env');
        process.exit(1);
    }
    if (!guildId) {
        console.error('❌ GUILD_ID not found in .env — คลิกขวาที่ชื่อ server → Copy Server ID');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('🔄 กำลังลงทะเบียน slash commands...');

        // Register per-guild (instant, no delay!)
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands.map(c => c.toJSON()) },
        );

        console.log(`✅ ลงทะเบียนสำเร็จ ${data.length} commands! (ใช้งานได้ทันที)`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
}

deployCommands();
