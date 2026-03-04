require('dotenv').config();

// Pre-load sodium before anything else to ensure voice encryption works
const sodium = require('libsodium-wrappers');
const express = require('express');

async function main() {
  // --- Express Health Check (for Platforms like Railway/Render) ---
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.get('/', (req, res) => res.send('Somua Bot (Music + AI) is alive! 🎵🤖'));
  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
  app.listen(PORT, () => console.log(`[HTTP] Health check listening on port ${PORT}`));

  console.log(`[System] Platform: ${process.platform} | Node: ${process.version}`);

  // Wait for sodium to be ready BEFORE creating the Discord client
  await sodium.ready;
  console.log('[Boot] Sodium encryption ready ✅');

  const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  const { MessageAdapter } = require('./utils/adapter');
  const { chat } = require('./services/gemini');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
    ],
    rest: {
      retries: 3,
      timeout: 30_000,
    },
  });

  const PREFIX = process.env.BOT_PREFIX || '!';
  const CHAT_CHANNEL_ID = process.env.CHAT_CHANNEL_ID;

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

  client.once(Events.ClientReady, (c) => {
    console.log(`🎵🤖 Somua Bot is online as ${c.user.tag}!`);
    console.log(`📌 Chat listening in channel: ${CHAT_CHANNEL_ID || 'Not set'}`);
    client.user.setActivity('!play | Ask me anything!', { type: 2 });
  });

  // --- Unified Message Handler (Music + AI Chat) ---
  client.on(Events.MessageCreate, async (message) => {
    // 1. Ignore own messages (unless it's the bridge - but here we handle it internally)
    if (message.author.id === client.user.id) return;
    if (message.author.bot && message.author.id !== client.user.id) {
      // Only listen to other bots if they use the special /bridge format?
      // For now, let's keep it simple.
    }

    // 2. Handle Music Commands (Prefix: !play, !np, etc.)
    if (message.content.startsWith(PREFIX)) {
      const args = message.content.slice(PREFIX.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = client.commands.get(commandName);

      if (command) {
        try {
          const adapter = new MessageAdapter(message);
          await command.execute(adapter, args);
          return; // Exit after command handled
        } catch (error) {
          console.error(`Error executing ${commandName}:`, error);
          message.reply('❌ เกิดข้อผิดพลาดในการรันคำสั่ง!');
        }
      }
    }

    // 3. Handle Special Bridge Command (/play) - Can be triggered by AI or Users
    if (message.content.startsWith('/play')) {
      const args = message.content.slice(5).trim().split(/ +/);
      const command = client.commands.get('play');
      if (command) {
        try {
          const adapter = new MessageAdapter(message);
          await command.execute(adapter, args);
          return;
        } catch (e) { console.error('Bridge play error:', e); }
      }
    }

    // 4. Handle AI Chat (If in designated channel)
    if (CHAT_CHANNEL_ID && message.channel.id === CHAT_CHANNEL_ID) {
      try {
        await message.channel.sendTyping();
        let response = await chat(message.author.id, message.content);

        // Bridge logic: Detect [[COMMAND]] /play ...
        const commandRegex = /\[\[COMMAND\]\]\s*(\/\w+.*)/i;
        const match = response.match(commandRegex);

        if (match) {
          const botCommand = match[1].trim();
          // Remove the command tag from the visible AI response
          response = response.replace(commandRegex, '').trim();

          // Send the ai reply
          if (response) await message.reply(response);

          // Trigger the music command by sending it as the bot (the bridge)
          // Since we listen for '/play' above, sending it to the channel will trigger step 3
          await message.channel.send(botCommand);
        } else {
          await message.reply(response);
        }
      } catch (error) {
        console.error('Chat error:', error);
        // Silent error to avoid spamming chat if AI fails
      }
    }
  });

  // Handle slash commands
  client.on(Events.InteractionCreate, async (interaction) => {
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

  // Error logging
  client.on('error', (err) => console.error('[Client Error]', err));
  client.on('warn', (info) => console.warn('[Client Warn]', info));
  client.on('shardReady', (id) => console.log(`[Shard ${id}] Ready!`));

  process.on('unhandledRejection', (reason) => {
    console.error('[Unhandled Rejection]', reason);
  });

  // Token management
  let token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('❌ DISCORD_TOKEN is missing!');
    process.exit(1);
  }
  token = token.trim();

  // Login
  console.log('[Login] Connecting to Discord...');
  try {
    await client.login(token);
    console.log('[Login] ✅ Connected!');
  } catch (err) {
    console.error('[Login] ❌ Failed:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Main error:', err);
  process.exit(1);
});
