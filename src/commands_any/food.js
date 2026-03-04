const { getRandomMenu } = require('../data/menus');
const { createFoodEmbed } = require('../utils_any/embed');

async function execute(message) {
    const menu = getRandomMenu();
    const embed = createFoodEmbed(menu);
    await message.reply({ embeds: [embed] });
}

module.exports = { name: 'food', execute };
