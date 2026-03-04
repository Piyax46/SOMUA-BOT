const { searchNews } = require('../services/search');
const { createNewsEmbed, createErrorEmbed } = require('../utils/embed');

async function execute(message, args) {
    const topic = args.join(' ');

    if (!topic) {
        return message.reply('📰 กรุณาใส่หัวข้อข่าวด้วยนะครับ เช่น `!news เศรษฐกิจไทย`');
    }

    await message.channel.sendTyping();

    try {
        const results = await searchNews(topic);
        const embed = createNewsEmbed(topic, results);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        if (error.message === 'RATE_LIMIT') {
            await message.reply({ embeds: [createErrorEmbed('⏳ ใช้ Google Search เกินโควต้าวันนี้แล้ว ลองใหม่พรุ่งนี้นะครับ')] });
        } else {
            await message.reply({ embeds: [createErrorEmbed('ค้นหาข่าวไม่สำเร็จ ลองใหม่อีกทีนะครับ')] });
        }
    }
}

module.exports = { name: 'news', execute };
