/**
 * automod.js
 * Handles: anti-spam, anti-links, anti-invites, anti-caps,
 *          anti-mass-mention, anti-duplicate, word filter
 */

const { Events, PermissionFlagsBits } = require("discord.js");
const { automod: cfg, emojis, channels } = require("../config");
const { infoContainer, warningContainer } = require("../utils/container");
const db = require("../utils/db");

// Per-user message tracking for spam detection
const spamMap = new Map(); // userId => [timestamps]
const dupMap  = new Map(); // userId => [lastContent x N]

async function punish(message, reason, settings) {
  try {
    await message.delete();
  } catch {}

  // Warn in channel (ephemeral-style: auto-delete after 5s)
  const warning = await message.channel.send({
    ...warningContainer(`${emojis.automod}  AutoMod`, reason),
  }).catch(() => null);

  if (warning) setTimeout(() => warning.delete().catch(() => {}), 5000);

  // Log
  const logCh = message.guild.channels.cache.get(channels.automodLog);
  if (logCh) {
    await logCh.send(
      infoContainer(
        `${emojis.automod}  AutoMod Action`,
        [
          { label: "User",    value: message.author.tag },
          { label: "Channel", value: `#${message.channel.name}` },
          { label: "Reason",  value: reason },
        ],
        [`${emojis.note}  **Content** — ${message.content.slice(0, 200)}`],
        [],
        "warning"
      )
    ).catch(() => {});
  }
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const settings = db.getAutomodSettings();
    if (!settings.enabled) return;

    // Check ignored roles
    if (message.member?.roles.cache.some(r => settings.ignoredRoles.includes(r.id))) return;
    // Check ignored channels
    if (settings.ignoredChannels.includes(message.channel.id)) return;
    // Admins bypass
    if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

    const content = message.content;

    // ── Anti-Spam ─────────────────────────────────────────────────────────────
    if (settings.antiSpam) {
      const now       = Date.now();
      const userTimes = spamMap.get(message.author.id) ?? [];
      const filtered  = userTimes.filter(t => now - t < cfg.spamInterval);
      filtered.push(now);
      spamMap.set(message.author.id, filtered);

      if (filtered.length >= cfg.spamLimit) {
        spamMap.delete(message.author.id);
        return punish(message, "Sending messages too quickly.", settings);
      }
    }

    // ── Anti-Duplicate ────────────────────────────────────────────────────────
    if (settings.antiDuplicates) {
      const history = dupMap.get(message.author.id) ?? [];
      const dupes   = history.filter(c => c === content.toLowerCase());
      history.push(content.toLowerCase());
      if (history.length > 10) history.shift();
      dupMap.set(message.author.id, history);

      if (dupes.length >= cfg.maxDuplicates) {
        dupMap.delete(message.author.id);
        return punish(message, "Sending duplicate messages.", settings);
      }
    }

    // ── Anti-Invites ──────────────────────────────────────────────────────────
    if (settings.antiInvites && cfg.invitePattern.test(content)) {
      cfg.invitePattern.lastIndex = 0;
      return punish(message, "Discord invite links are not allowed.", settings);
    }
    cfg.invitePattern.lastIndex = 0;

    // ── Anti-Links ────────────────────────────────────────────────────────────
    if (settings.antiLinks && cfg.linkPattern.test(content)) {
      cfg.linkPattern.lastIndex = 0;
      return punish(message, "External links are not allowed here.", settings);
    }
    cfg.linkPattern.lastIndex = 0;

    // ── Anti-Caps ─────────────────────────────────────────────────────────────
    if (settings.antiCaps && content.length > 10) {
      const uppers = content.replace(/[^a-zA-Z]/g, "");
      if (uppers.length > 5) {
        const ratio = (content.match(/[A-Z]/g) ?? []).length / uppers.length;
        if (ratio >= cfg.capsThreshold) {
          return punish(message, "Excessive use of capital letters.", settings);
        }
      }
    }

    // ── Anti-Mass-Mention ─────────────────────────────────────────────────────
    if (settings.antiMassMention) {
      const mentions = (message.mentions.users.size + message.mentions.roles.size);
      if (mentions >= cfg.maxMentions) {
        return punish(message, `Mass mentioning is not allowed (${mentions} mentions).`, settings);
      }
    }

    // ── Word Filter ───────────────────────────────────────────────────────────
    if (settings.wordFilter) {
      const lower = content.toLowerCase();
      for (const word of cfg.bannedWords) {
        if (lower.includes(word.toLowerCase())) {
          return punish(message, "Your message contained a prohibited word.", settings);
        }
      }
    }
  },
};
