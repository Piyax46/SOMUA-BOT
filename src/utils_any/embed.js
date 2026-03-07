const { EmbedBuilder } = require('discord.js');

// Color palette
const COLORS = {
    PRIMARY: 0x5865F2,   // Discord blurple
    SUCCESS: 0x57F287,   // Green
    WARNING: 0xFEE75C,   // Yellow
    ERROR: 0xED4245,     // Red
    INFO: 0x5BC0EB,      // Light blue
    SEARCH: 0x4285F4,    // Google blue
    NEWS: 0xEA4335,      // Google red
    FOOD: 0xFF6B35,      // Orange
    AI: 0x8B5CF6,        // Purple
};

/**
 * Create a search result embed
 */
function createSearchEmbed(query, results) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.SEARCH)
        .setTitle(`🔍 ผลค้นหา: "${query}"`)
        .setTimestamp()
        .setFooter({ text: 'Powered by Google Search' });

    if (results.length === 0) {
        embed.setDescription('ไม่พบผลลัพธ์ 😢');
        return embed;
    }

    const description = results
        .map((r, i) => `**${i + 1}.** [${r.title}](${r.link})\n${r.snippet}`)
        .join('\n\n');

    embed.setDescription(description);
    return embed;
}

/**
 * Create a news result embed
 */
function createNewsEmbed(topic, results) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.NEWS)
        .setTitle(`📰 ข่าวล่าสุด: "${topic}"`)
        .setDescription(
            results.length === 0
                ? 'ไม่พบข่าวที่เกี่ยวข้อง 😢'
                : results
                    .map((r, i) => `**${i + 1}.** [${r.title}](${r.link})\n${r.snippet}`)
                    .join('\n\n')
        )
        .setTimestamp()
        .setFooter({ text: '📅 ข่าวภายใน 7 วันล่าสุด • Powered by Google Search' });

    return embed;
}

/**
 * Create a food suggestion embed
 */
function createFoodEmbed(menu) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.FOOD)
        .setTitle('🍽️ วันนี้กินอะไรดี?')
        .setDescription(`## ${menu.emoji} ${menu.name}`)
        .addFields(
            { name: '📂 หมวดหมู่', value: menu.category, inline: true },
            { name: '💡 หมายเหตุ', value: menu.note || 'อร่อยแน่นอน!', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: '🎲 สุ่มใหม่ได้เรื่อยๆ นะ!' });

    return embed;
}

/**
 * Create a help embed
 */
function createHelpEmbed() {
    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('📖 Somua Bot — คำสั่งทั้งหมด')
        .setDescription('สวัสดี! ฉันคือ Somua Bot 🤖 ช่วยเหลือได้หลายอย่าง!')
        .addFields(
            {
                name: '💬 AI Chat',
                value: '@mention บอท หรือ reply ข้อความบอท — ถามอะไรก็ตอบ!\nเช่น: `@SoMua สวัสดี`, `เปิดเพลงให้หน่อย`',
            },
            {
                name: '🔍 !search <คำค้นหา>',
                value: 'ค้นหา Google\nเช่น: `!search วิธีทำข้าวผัด`',
            },
            {
                name: '📰 !news <หัวข้อ>',
                value: 'ดูข่าวล่าสุด 7 วัน\nเช่น: `!news เศรษฐกิจไทย`',
            },
            {
                name: '🍜 !กินอะไรดี / !random',
                value: 'สุ่มเมนูอาหาร ไม่รู้จะกินอะไรก็สั่งเลย!',
            },
            {
                name: '📖 !help',
                value: 'แสดงข้อความนี้',
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Somua Bot v2.0 — Powered by Groq AI & Google Search' });

    return embed;
}

/**
 * Create an error embed
 */
function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('❌ เกิดข้อผิดพลาด')
        .setDescription(message)
        .setTimestamp();
}

module.exports = {
    COLORS,
    createSearchEmbed,
    createNewsEmbed,
    createFoodEmbed,
    createHelpEmbed,
    createErrorEmbed,
};
