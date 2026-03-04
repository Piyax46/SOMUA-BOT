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

  // Load AnyBot Commands (!search, !news, !food)
  const anyCommandsPath = path.join(__dirname, 'commands_any');
  if (fs.existsSync(anyCommandsPath)) {
    const anyCommandFiles = fs.readdirSync(anyCommandsPath).filter(f => f.endsWith('.js') && f !== 'handler.js');
    for (const file of anyCommandFiles) {
      const command = require(path.join(anyCommandsPath, file));
      if (command.name) {
        // AnyBot commands use raw message, so we'll wrap them or handle them separately
        // For simplicity, we'll store them in a separate collection if they don't match our adapter style
        if (!client.commands.has(command.name)) {
          client.commands.set(command.name, { ...command, isAnyBot: true });
        }
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
    // 1. Ignore own messages (EXCEPT for the internal bridge /play command)
    const isBotSelf = message.author.id === client.user.id;
    const isBridgeCmd = message.content.startsWith('/play');

    if (isBotSelf && !isBridgeCmd) return;
    if (message.author.bot && !isBotSelf) return; // Ignore other bots

    // 2. Handle Music/AI Commands (Prefix: !play, !np, !search, etc.)
    if (message.content.startsWith(PREFIX)) {
      const args = message.content.slice(PREFIX.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = client.commands.get(commandName);

      if (command) {
        try {
          if (command.isAnyBot) {
            // These commands expect raw message
            await command.execute(message, args);
          } else {
            const adapter = new MessageAdapter(message);
            await command.execute(adapter, args);
          }
          return;
        } catch (error) {
          console.error(`Error executing ${commandName}:`, error);
          message.reply('❌ เกิดข้อผิดพลาดในการรันคำสั่ง!');
        }
      }
    }

    // 3. Handle Special Bridge Command (/play) - Triggered by the bot's own AI reply
    if (isBridgeCmd) {
      const args = message.content.slice(5).trim().split(/ +/);
      const command = client.commands.get('play');
      if (command) {
        try {
          // IMPORTANT: If the bot is sending this, we need to handle "who" the command is for.
          // In the case of the AI bridge, the bot sends '/play song' AFTER replying to a user.
          // But since it's the bot's own message, it has no 'member' (voice channel).
          // We solve this by making the AI handler call the command directly using the ORIGINAL user's message context.
          // So this block is mostly for users typing /play manually.
          const adapter = new MessageAdapter(message);
          await command.execute(adapter, args);
          return;
        } catch (e) { console.error('Bridge play error:', e); }
      }
    }

    // 4. Handle AI Chat (If in designated channel and NOT a command)
    if (!isBotSelf && CHAT_CHANNEL_ID && message.channel.id === CHAT_CHANNEL_ID) {
      try {
        await message.channel.sendTyping();
        let response = await chat(message.author.id, message.content);

        // Bridge logic: Detect [[COMMAND]] /play ...
        const commandRegex = /\[\[COMMAND\]\]\s*(\/\w+.*)/i;
        const match = response.match(commandRegex);

        if (match) {
          const botCommand = match[1].trim(); // "/play song name"
          const query = botCommand.replace(/^\/play\s+/, '').split(/ +/);

          // Remove the command tag from the assistant's response
          response = response.replace(commandRegex, '').trim();

          // Send the ai reply
          if (response) await message.reply(response);

          // DIRECT EXECUTION: Don't just send message, execute it using the USER's message context
          // This ensures the bot knows which voice channel to join (the user's)
          const playCmd = client.commands.get('play');
          if (playCmd) {
            const adapter = new MessageAdapter(message); // Wrap original user message
            await playCmd.execute(adapter, query);
          }
        } else {
          await message.reply(response);
        }
      } catch (error) {
        console.error('Chat error:', error);
      }
    }
  });

  // Handle slash commands
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const adapter = new MessageAdapter(interaction);

    try {
      // 1. ALWAYS defer immediately to prevent "Unknown Interaction"
      // This gives the bot up to 15 minutes to process
      await adapter.deferIfNeeded();

      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return await adapter.reply('❌ ไม่พบคำสั่งนี้!');
      }

      const args = [];
      const options = interaction.options;

      if (options.getString('query')) args.push(options.getString('query'));
      if (options.getInteger('page')) args.push(String(options.getInteger('page')));
      if (options.getInteger('level') !== null && options.getInteger('level') !== undefined) args.push(String(options.getInteger('level')));
      if (options.getInteger('position')) args.push(String(options.getInteger('position')));

      // 2. Execute command
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
