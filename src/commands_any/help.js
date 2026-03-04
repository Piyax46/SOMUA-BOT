const { createHelpEmbed } = require('../utils_any/embed');

async function execute(message) {
    const embed = createHelpEmbed();
    await message.reply({ embeds: [embed] });
}

module.exports = { name: 'help', execute };
