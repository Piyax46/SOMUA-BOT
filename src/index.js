require('dotenv').config();

// Pre-load sodium before anything else to ensure voice encryption works
const sodium = require('libsodium-wrappers');
const express = require('express');

async function main() {
  // Keep-alive server for Render
  const app = express();
  const port = process.env.PORT || 3000;
  app.get('/', (req, res) => res.send('Somua Bot is alive! 🎵'));
  app.listen(port, () => console.log(`[Keep-Alive] Listening on port ${port}`));

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

  // Error & Debug logging
  client.on('error', (err) => console.error('[Client Error]', err));
  client.on('warn', (info) => console.warn('[Client Warn]', info));
  client.on('shardReady', (id) => console.log(`[Shard ${id}] Shard is ready!`));
  client.on('shardDisconnect', (event, id) => console.warn(`[Shard ${id}] Disconnected:`, event));
  client.on('shardReconnecting', (id) => console.log(`[Shard ${id}] Reconnecting...`));

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception] thrown:', err);
    process.exit(1);
  });

  // Verify token
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('❌ DISCORD_TOKEN is missing in environment variables!');
    process.exit(1);
  }

  // Token format check (Basic validation)
  if (token.length < 50) {
    console.warn(`⚠️ Token seems unusually short (${token.length} chars). Please double check it!`);
  }

  console.log('[Login] Attempting to connect to Discord...');
  client.login(token).then(() => {
    console.log('[Login] Login successful (Promise resolved)');
  }).catch(err => {
    console.error('❌ Failed to login to Discord:', err.message);
    process.exit(1);
  });
}

main().catch(err => {
  console.error('❌ Main loop error:', err);
  process.exit(1);
});
