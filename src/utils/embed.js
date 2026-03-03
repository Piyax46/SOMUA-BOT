const { EmbedBuilder } = require('discord.js');

const COLORS = {
    primary: 0x7C3AED,   // Purple
    success: 0x10B981,   // Green
    warning: 0xF59E0B,   // Amber
    error: 0xEF4444,     // Red
    info: 0x3B82F6,      // Blue
};

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return 'Live 🔴';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function createProgressBar(current, total, length = 15) {
    if (!total) return '▬'.repeat(length);
    const progress = Math.round((current / total) * length);
    return '▬'.repeat(Math.max(0, progress)) + '🔘' + '▬'.repeat(Math.max(0, length - progress - 1));
}

function createNowPlayingEmbed(song) {
    return new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle('🎵 กำลังเล่น')
        .setDescription(`**[${song.title}](${song.url})**`)
        .setThumbnail(song.thumbnail)
        .addFields(
            { name: '⏱️ ความยาว', value: formatDuration(song.duration), inline: true },
            { name: '👤 ขอเพลงโดย', value: `${song.requestedBy}`, inline: true },
        )
        .setFooter({ text: 'Somua Bot 🎶' })
        .setTimestamp();
}

function createAddedToQueueEmbed(song, position) {
    return new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle('✅ เพิ่มเข้าคิวแล้ว')
        .setDescription(`**[${song.title}](${song.url})**`)
        .setThumbnail(song.thumbnail)
        .addFields(
            { name: '⏱️ ความยาว', value: formatDuration(song.duration), inline: true },
            { name: '📋 ตำแหน่งในคิว', value: `#${position}`, inline: true },
        )
        .setFooter({ text: 'Somua Bot 🎶' })
        .setTimestamp();
}

function createQueueEmbed(queue, page = 0) {
    const songsPerPage = 10;
    const start = page * songsPerPage + 1;
    const end = Math.min(start + songsPerPage, queue.songs.length);
    const current = queue.songs[0];

    let description = `**🎵 กำลังเล่น:**\n[${current.title}](${current.url}) — \`${formatDuration(current.duration)}\`\n\n`;

    if (queue.songs.length > 1) {
        description += '**📋 คิวเพลง:**\n';
        for (let i = start; i < end; i++) {
            const song = queue.songs[i];
            description += `\`${i}.\` [${song.title}](${song.url}) — \`${formatDuration(song.duration)}\`\n`;
        }
    } else {
        description += '*ไม่มีเพลงในคิว*';
    }

    const totalPages = Math.ceil(Math.max(1, queue.songs.length - 1) / songsPerPage);

    return new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle(`📋 คิวเพลง — ${queue.songs.length - 1} เพลง`)
        .setDescription(description)
        .addFields(
            { name: '🔁 Loop', value: queue.loop ? 'เปิด' : 'ปิด', inline: true },
            { name: '🔊 Volume', value: `${queue.volume}%`, inline: true },
        )
        .setFooter({ text: `หน้า ${page + 1}/${totalPages} • Somua Bot 🎶` })
        .setTimestamp();
}

function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setColor(COLORS.error)
        .setDescription(`❌ ${message}`)
        .setFooter({ text: 'Somua Bot' });
}

function createSuccessEmbed(message) {
    return new EmbedBuilder()
        .setColor(COLORS.success)
        .setDescription(`✅ ${message}`)
        .setFooter({ text: 'Somua Bot' });
}

function createInfoEmbed(message) {
    return new EmbedBuilder()
        .setColor(COLORS.info)
        .setDescription(`ℹ️ ${message}`)
        .setFooter({ text: 'Somua Bot' });
}

module.exports = {
    COLORS,
    formatDuration,
    createProgressBar,
    createNowPlayingEmbed,
    createAddedToQueueEmbed,
    createQueueEmbed,
    createErrorEmbed,
    createSuccessEmbed,
    createInfoEmbed,
};
