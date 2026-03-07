require('dotenv').config();

// Pre-load sodium before anything else to ensure voice encryption works
const sodium = require('libsodium-wrappers');
const express = require('express');

async function main() {
  // --- Express Health Check (for Railway/Render) ---
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
  const { searchGoogle, searchNews } = require('./services/search');
  const { createSearchEmbed, createNewsEmbed, createErrorEmbed: createErrorEmbedAny } = require('./utils_any/embed');

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
    console.log(`📌 Chat channel: ${CHAT_CHANNEL_ID || 'All channels (via @mention)'}`);
    client.user.setActivity('!play | @ฉัน ถามอะไรก็ได้!', { type: 2 });
  });

  // --- Unified Message Handler (Music + AI Chat + Bridge) ---
  client.on(Events.MessageCreate, async (message) => {
    // Ignore all bots
    if (message.author.bot) return;

    // 1. Handle Music/AI Commands (Prefix: !play, !np, !search, etc.)
    if (message.content.startsWith(PREFIX)) {
      const args = message.content.slice(PREFIX.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = client.commands.get(commandName);

      if (command) {
        try {
          if (command.isAnyBot) {
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

    // 2. Handle AI Chat
    // Responds if: (a) in CHAT_CHANNEL_ID, or (b) @mention the bot, or (c) reply to the bot
    const isMentioned = message.mentions.has(client.user);
    const isReplyToBot = message.reference && (await message.channel.messages.fetch(message.reference.messageId).catch(() => null))?.author?.id === client.user.id;
    const isChatChannel = CHAT_CHANNEL_ID && message.channel.id === CHAT_CHANNEL_ID;
    const isCommand = message.content.startsWith(PREFIX);

    if (!isCommand && (isChatChannel || isMentioned || isReplyToBot)) {
      try {
        await message.channel.sendTyping();

        // Clean the message (remove bot mention)
        let userMessage = message.content.replace(/<@!?\d+>/g, '').trim();
        if (!userMessage) userMessage = 'สวัสดี';

        let response = await chat(message.author.id, userMessage);

        // --- Bridge: Detect [[PLAY]], [[SEARCH]], [[NEWS]] commands ---
        const playRegex = /\[\[PLAY\]\]\s*(.+)/i;
        const searchRegex = /\[\[SEARCH\]\]\s*(.+)/i;
        const newsRegex = /\[\[NEWS\]\]\s*(.+)/i;

        const playMatch = response.match(playRegex);
        const searchMatch = response.match(searchRegex);
        const newsMatch = response.match(newsRegex);

        if (playMatch) {
          const songQuery = playMatch[1].trim();
          // Remove command tag from AI response
          response = response.replace(playRegex, '').trim();
          if (response) await message.reply(response);

          // Execute play command using the user's message context
          const playCmd = client.commands.get('play');
          if (playCmd) {
            const adapter = new MessageAdapter(message);
            await playCmd.execute(adapter, songQuery.split(/ +/));
          }
        } else if (searchMatch) {
          const searchQuery = searchMatch[1].trim();
          response = response.replace(searchRegex, '').trim();
          if (response) await message.reply(response);

          // Execute search directly
          try {
            const results = await searchGoogle(searchQuery);
            const embed = createSearchEmbed(searchQuery, results);
            await message.channel.send({ embeds: [embed] });
          } catch (err) {
            await message.channel.send({ embeds: [createErrorEmbedAny('ค้นหาไม่สำเร็จ ลองใหม่อีกทีนะ')] });
          }
        } else if (newsMatch) {
          const newsQuery = newsMatch[1].trim();
          response = response.replace(newsRegex, '').trim();
          if (response) await message.reply(response);

          // Execute news search directly
          try {
            const results = await searchNews(newsQuery);
            const embed = createNewsEmbed(newsQuery, results);
            await message.channel.send({ embeds: [embed] });
          } catch (err) {
            await message.channel.send({ embeds: [createErrorEmbedAny('ค้นหาข่าวไม่สำเร็จ ลองใหม่อีกที')] });
          }
        } else {
          // Normal AI response
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
