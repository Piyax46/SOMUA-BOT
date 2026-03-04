const searchCommand = require('./search');
const newsCommand = require('./news');
const foodCommand = require('./food');
const helpCommand = require('./help');

const commands = new Map();
commands.set('search', searchCommand);
commands.set('news', newsCommand);
commands.set('help', helpCommand);

// Thai command aliases
commands.set('กินอะไรดี', foodCommand);
commands.set('random', foodCommand);
commands.set('สุ่มเมนู', foodCommand);
commands.set('ค้นหา', searchCommand);
commands.set('ข่าว', newsCommand);
commands.set('ช่วยเหลือ', helpCommand);

const PREFIX = '!';

/**
 * Handle a command message
 * @param {Message} message - Discord message
 * @returns {boolean} Whether a command was handled
 */
async function handleCommand(message) {
    if (!message.content.startsWith(PREFIX)) return false;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = commands.get(commandName);
    if (!command) return false;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(`Command error [${commandName}]:`, error);
        await message.reply('❌ เกิดข้อผิดพลาดในการรันคำสั่ง');
    }

    return true;
}

module.exports = { handleCommand };
