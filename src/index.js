require('dotenv').config();

// Pre-load sodium before anything else to ensure voice encryption works
const sodium = require('libsodium-wrappers');

async function main() {
  // Wait for sodium to be ready BEFORE creating the Discord client
  await sodium.ready;
  console.log('[Boot] Sodium encryption ready ✅');

  const { Client, GatewayIntentBits, Collection } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  const { MessageAdapter } = require('./utils/adapter');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
    ],
  });

  const PREFIX = process.env.BOT_PREFIX || '!';

  // Load commands
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.name, command);
    if (command.aliases) {
      for (const alias of command.aliases) {
        client.commands.set(alias, command);
      }
    }
  }

  // Per-guild music queues
  client.queues = new Map();

  client.once('ready', () => {
    console.log(`🎵 Somua Bot is online as ${client.user.tag}!`);
    client.user.setActivity('!play | /play', { type: 2 });
  });

  // Handle prefix commands
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      const adapter = new MessageAdapter(message);
      await command.execute(adapter, args);
    } catch (error) {
      console.error(`Error executing ${commandName}:`, error);
      message.reply('❌ เกิดข้อผิดพลาดในการรันคำสั่ง!');
    }
  });

  // Handle slash commands
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const args = [];
    const options = interaction.options;

    if (options.getString('query')) args.push(options.getString('query'));
    if (options.getInteger('page')) args.push(String(options.getInteger('page')));
    if (options.getInteger('level') !== null && options.getInteger('level') !== undefined) args.push(String(options.getInteger('level')));
    if (options.getInteger('position')) args.push(String(options.getInteger('position')));

    try {
      const adapter = new MessageAdapter(interaction);
      await adapter.deferIfNeeded();
      await command.execute(adapter, args);
    } catch (error) {
      console.error(`Error executing /${interaction.commandName}:`, error);
      try {
        const content = '❌ เกิดข้อผิดพลาดในการรันคำสั่ง!';
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(content);
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      } catch (e) { /* ignore */ }
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

main().catch(console.error);
