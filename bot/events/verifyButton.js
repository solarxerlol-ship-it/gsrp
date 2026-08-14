/**
 * verifyButton.js
 * Flow:
 *   1. User clicks Verify button
 *   2. Bot calls Bloxlink API to get their linked Roblox ID
 *   3. Bot calls Roblox API to get their username
 *   4. Give verified role, remove unverified, set nickname to Roblox username
 *   5. Log to verifyLog channel
 */

const { Events, MessageFlags } = require("discord.js");
const https = require("https");
const { roles, channels, emojis, guildId } = require("../config");
const { successContainer, errorContainer, infoContainer } = require("../utils/container");
const db = require("../utils/db");

// ── API helpers ───────────────────────────────────────────────────────────────

function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "GET", headers }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { reject(new Error("Invalid JSON")); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function getRobloxId(discordId, gId) {
  const key = process.env.BLOXLINK_API_KEY;
  if (!key || key === "YOUR_BLOXLINK_API_KEY") throw new Error("Bloxlink API key not configured.");

  const res = await httpsGet(
    "api.blox.link",
    `/v4/public/guilds/${gId}/discord-to-roblox/${discordId}`,
    { "api-key": key }
  );

  if (res.status === 404 || !res.body?.robloxID) {
    throw new Error("NOT_VERIFIED");
  }
  if (res.status !== 200) {
    throw new Error(`Bloxlink error ${res.status}`);
  }

  return res.body.robloxID;
}

async function getRobloxUsername(robloxId) {
  const res = await httpsGet(
    "users.roblox.com",
    `/v1/users/${robloxId}`
  );
  if (res.status !== 200) throw new Error("Roblox user not found.");
  return res.body.name; // username
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "verify_click") return;

    const member = interaction.member;

    // Already verified?
    const verifiedRole = interaction.guild.roles.cache.get(roles.verified);
    if (verifiedRole && member.roles.cache.has(verifiedRole.id)) {
      return interaction.reply({
        ...errorContainer("Already Verified", "You are already verified."),
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // 1. Get Roblox ID from Bloxlink
      const robloxId = await getRobloxId(interaction.user.id, interaction.guild.id);

      // 2. Get Roblox username
      const robloxUsername = await getRobloxUsername(robloxId);

      // 3. Give role, remove unverified, set nickname
      if (verifiedRole) await member.roles.add(verifiedRole, "Verified via Bloxlink").catch(() => {});
      const unverifiedRole = interaction.guild.roles.cache.get(roles.unverified);
      if (unverifiedRole) await member.roles.remove(unverifiedRole).catch(() => {});
      await member.setNickname(robloxUsername, "Roblox username set on verify").catch(() => {});

      // 4. Save to db
      await db.setVerification(interaction.user.id, {
        robloxId,
        robloxUsername,
        verifiedAt: Date.now(),
        method: "BLOXLINK",
      });

      // 5. Reply
      await interaction.editReply({
        content: `${emojis.check}  Verified as **${robloxUsername}**. Welcome to Georgia State Roleplay!`,
      });

      // 6. Log
      const logCh = interaction.guild.channels.cache.get(channels.verifyLog)
        ?? await interaction.guild.channels.fetch(channels.verifyLog).catch(() => null);
      if (logCh) {
        await logCh.send(
          infoContainer(
            `${emojis.verify}  New Verification`,
            [
              { label: "Discord",  value: interaction.user.tag },
              { label: "Roblox",   value: robloxUsername },
              { label: "Roblox ID",value: robloxId },
              { label: "Method",   value: "Bloxlink" },
            ],
            [],
            [],
            "success",
            "verification"
          )
        );
      }

    } catch (err) {
      if (err.message === "NOT_VERIFIED") {
        return interaction.editReply({
          content: `❌  You don't have a Roblox account linked on Bloxlink. Go to <https://blox.link> and verify your account first, then try again.`,
        });
      }

      console.error("[VERIFY]", err.message);
      return interaction.editReply({
        content: `❌  Something went wrong during verification. Please try again or contact staff.`,
      });
    }
  },
};
