const { searchGoogle } = require('../services/search');
const { createSearchEmbed, createErrorEmbed } = require('../utils/embed');

async function execute(message, args) {
    const query = args.join(' ');

    if (!query) {
        return message.reply('🔍 กรุณาใส่คำค้นหาด้วยนะครับ เช่น `!search วิธีทำข้าวผัด`');
    }

    // Show typing indicator
    await message.channel.sendTyping();

    try {
        const results = await searchGoogle(query);
        const embed = createSearchEmbed(query, results);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        if (error.message === 'RATE_LIMIT') {
            await message.reply({ embeds: [createErrorEmbed('⏳ ใช้ Google Search เกินโควต้าวันนี้แล้ว ลองใหม่พรุ่งนี้นะครับ')] });
        } else {
            await message.reply({ embeds: [createErrorEmbed('ค้นหาไม่สำเร็จ ลองใหม่อีกทีนะครับ')] });
        }
    }
}

module.exports = { name: 'search', execute };
