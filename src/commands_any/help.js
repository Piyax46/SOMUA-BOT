const { createHelpEmbed } = require('../utils/embed');

async function execute(message) {
    const embed = createHelpEmbed();
    await message.reply({ embeds: [embed] });
}

module.exports = { name: 'help', execute };
