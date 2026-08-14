const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require("discord.js");
const fs   = require("fs");
const path = require("path");
const { token } = require("./config");

// ── Client ────────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

client.commands = new Collection();

// ── Load commands (recursive) ─────────────────────────────────────────────────
function loadCommands(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(full);
    } else if (entry.name.endsWith(".js")) {
      const cmd = require(full);
      if (cmd?.data?.name) {
        client.commands.set(cmd.data.name, cmd);
      }
    }
  }
}

loadCommands(path.join(__dirname, "commands"));

// ── Load events ───────────────────────────────────────────────────────────────
const eventsDir = path.join(__dirname, "events");
for (const file of fs.readdirSync(eventsDir).filter(f => f.endsWith(".js"))) {
  const event = require(path.join(eventsDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// ── Interaction handler ───────────────────────────────────────────────────────
const { Events } = require("discord.js");
const { errorContainer } = require("./utils/container");

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[CMD ERROR] ${interaction.commandName}:`, err);
    const errPayload = errorContainer("Command Error", "Something went wrong. Please try again.");
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ ...errPayload, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ ...errPayload, ephemeral: true }).catch(() => {});
    }
  }
});

// ── HTTP server — keep-alive + internal portal webhook ───────────────────────
const http = require("http");

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === "GET") {
    res.writeHead(200);
    return res.end("OK");
  }

  // ── POST /internal/infraction — triggered by web portal ──────────────────
  // Recreates the same output as /infraction-add slash command.
  if (req.method === "POST" && req.url === "/internal/infraction") {
    // Validate shared secret
    const secret = req.headers["x-portal-secret"];
    if (!secret || secret !== process.env.PORTAL_INTERNAL_SECRET) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }

    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { caseId, userId, type, reason, description, moderatorId, moderatorName } = JSON.parse(body);
        const { buildContainer, heading, sep, text, HeadingLevel } = require("./utils/container");
        const { emojis, channels } = require("./config");

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
          res.writeHead(503);
          return res.end(JSON.stringify({ error: "Guild not cached yet" }));
        }

        const payload = buildContainer(
          [
            heading(`${emojis.info}  Information`, HeadingLevel.Two),
            sep(false),
            text(`${emojis.user}  **User:** <@${userId}> ( ${userId} )`),
            text(`${emojis.member}  **Executor:** ${moderatorId ? `<@${moderatorId}>` : moderatorName} (Web Portal)`),
            sep(true),
            heading(`${emojis.folder}  Details`, HeadingLevel.Two),
            sep(false),
            text(`${emojis.promote}  **Punishment:** ${type}`),
            text(`${emojis.note}  **Reason:** ${reason}`),
            ...(description ? [text(`${emojis.note}  **Description:** ${description}`)] : []),
            text(`${emojis.member}  **Case ID:** #${caseId}`),
            text(`${emojis.globe}  **Source:** 🌐 Web Portal`),
          ],
          "danger",
          { category: "infractions" }
        );

        const logCh = guild.channels.cache.get(channels.infractionLog)
          ?? await guild.channels.fetch(channels.infractionLog).catch(() => null);

        if (logCh) {
          await logCh.send(payload);
          console.log(`[PORTAL] Infraction #${caseId} posted to Discord for user ${userId}`);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error("[PORTAL] Internal infraction error:", err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`[HTTP] Listening on port ${process.env.PORT || 3000}`);
});

// ── Session auto-updater (every 30s) ─────────────────────────────────────────
// Uses ERLC API v2 for live player/queue counts when key is configured.
// Falls back to VC name parsing if key is not set.
const Session = require("./utils/sessionDb");
const erlc    = require("./utils/erlc");

// VC channel IDs — fallback when ERLC key not set
const VC_PLAYERS_ID = process.env.VC_PLAYERS_ID || "1535755833953095741";
const VC_QUEUE_ID   = process.env.VC_QUEUE_ID   || "1535755878744064062";

function parseVcNumber(name = "") {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

async function sessionAutoUpdate() {
  try {
    const sessions = await Session.find({ online: true });
    for (const session of sessions) {
      const guild = client.guilds.cache.get(session.guildId);
      if (!guild) continue;

      let players    = session.players;
      let maxPlayers = session.maxPlayers ?? 50;
      let queue      = session.queue;

      const erlcKey = process.env.ERLC_SERVER_KEY;
      const hasKey  = erlcKey && erlcKey !== "YOUR_ERLC_SERVER_KEY";

      if (hasKey) {
        // ── ERLC API ───────────────────────────────────────────────────────
        const [server, playerList] = await Promise.all([
          erlc.getServer().catch(() => null),
          erlc.getPlayers().catch(() => null),
        ]);

        if (server) {
          players    = server.CurrentPlayers ?? players;
          maxPlayers = server.MaxPlayers     ?? maxPlayers;
          queue      = server.Queue          ?? queue;
        }
      } else {
        // ── VC name fallback ───────────────────────────────────────────────
        const vcPlayers = guild.channels.cache.get(VC_PLAYERS_ID)
          ?? await guild.channels.fetch(VC_PLAYERS_ID).catch(() => null);
        const vcQueue = guild.channels.cache.get(VC_QUEUE_ID)
          ?? await guild.channels.fetch(VC_QUEUE_ID).catch(() => null);

        if (vcPlayers) players = parseVcNumber(vcPlayers.name);
        if (vcQueue)   queue   = parseVcNumber(vcQueue.name);
      }

      const isFull = players >= maxPlayers;
      session.players    = players;
      session.maxPlayers = maxPlayers;
      session.queue      = queue;
      if (isFull !== session.full) session.full = isFull;
      await session.save();

      const ch = guild.channels.cache.get(session.channelId)
        ?? await guild.channels.fetch(session.channelId).catch(() => null);
      if (!ch) continue;

      const msg = await ch.messages.fetch(session.messageId).catch(() => null);
      if (!msg) continue;

      const { buildSessionEmbed } = require("./commands/sessions/ssu");
      await msg.edit(buildSessionEmbed({
        players:    session.players,
        maxPlayers: session.maxPlayers,
        queue:      session.queue,
        staff:      session.staff ?? 0,
        link:       session.link,
        online:     session.online,
        votes:      session.votes,
        full:       session.full,
      })).catch(() => {});
    }
  } catch (err) {
    console.error("[SESSION AUTO-UPDATE]", err.message);
  }
}

// ── Keep-alive (Render free tier) ────────────────────────────────────────────
const https = require("https");
setInterval(() => {
  https.get("https://gsrp-52zn.onrender.com/", (res) => {
    console.log(`[KEEP-ALIVE] Pinged render — status ${res.statusCode}`);
  }).on("error", (err) => {
    console.warn(`[KEEP-ALIVE] Ping failed: ${err.message}`);
  });
}, 5 * 60 * 1000); // every 5 minutes

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, () => {
  console.log(`[READY] Logged in as ${client.user.tag}`);
  console.log(`[READY] Loaded ${client.commands.size} commands`);
  setInterval(sessionAutoUpdate, 30 * 1000);
  console.log("[SESSION] Auto-updater started (30s interval)");
});

client.login(token);
