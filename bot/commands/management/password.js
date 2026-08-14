/**
 * password.js — Generate a portal password login for a staff member.
 *
 * Usage:
 *   /password gen user:<@user> access_level:<level>
 *   /password reset username:<string>
 *
 * Calls the staff portal's internal API to create/reset the password.
 * The generated password is shown ONLY to the command invoker (ephemeral).
 *
 * Requires: management
 */

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const https = require("https");
const http  = require("http");
const { guard } = require("../../utils/permissions");
const { replyError } = require("../../utils/container");

// ── Portal API call ───────────────────────────────────────────────────────────
// Calls POST /api/staff/generate-password on the web portal with a shared
// internal secret so the portal knows the request came from the trusted bot.

function callPortalAPI(username, accessLevel) {
  return new Promise((resolve, reject) => {
    const portalUrl  = process.env.PORTAL_URL || "https://staff.gssrp.xyz";
    const secret     = process.env.PORTAL_INTERNAL_SECRET || "";

    const body = JSON.stringify({ username, accessLevel, _botSecret: secret });

    const url  = new URL("/api/staff/generate-password-bot", portalUrl);
    const lib  = url.protocol === "https:" ? https : http;

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === "https:" ? 443 : 80),
      path:     url.pathname,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
        "x-bot-secret":   secret,
      },
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          }
        } catch {
          reject(new Error("Invalid response from portal"));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Portal request timed out")); });
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName("password")
    .setDescription("Manage staff portal password logins")

    // /password gen
    .addSubcommand(sub => sub
      .setName("gen")
      .setDescription("Generate a portal password for a staff member")
      .addUserOption(o => o
        .setName("user")
        .setDescription("The Discord user to generate credentials for")
        .setRequired(true)
      )
      .addStringOption(o => o
        .setName("access_level")
        .setDescription("Portal access level to assign")
        .setRequired(true)
        .addChoices(
          { name: "Staff",      value: "staff"      },
          { name: "Moderator",  value: "moderator"  },
          { name: "Admin",      value: "admin"      },
          { name: "Management", value: "management" },
        )
      )
    )

    // /password reset
    .addSubcommand(sub => sub
      .setName("reset")
      .setDescription("Reset the portal password for an existing account")
      .addStringOption(o => o
        .setName("username")
        .setDescription("Portal username to reset (lowercase)")
        .setRequired(true)
      )
      .addStringOption(o => o
        .setName("access_level")
        .setDescription("Optional: update their access level too")
        .addChoices(
          { name: "Staff",      value: "staff"      },
          { name: "Moderator",  value: "moderator"  },
          { name: "Admin",      value: "admin"      },
          { name: "Management", value: "management" },
        )
      )
    ),

  async execute(interaction) {
    // Management+ only
    if (await guard(interaction, "management")) return;

    const sub = interaction.options.getSubcommand();

    // ── /password gen ─────────────────────────────────────────────────────────
    if (sub === "gen") {
      const target      = interaction.options.getUser("user");
      const accessLevel = interaction.options.getString("access_level");

      // Use Discord username as portal username (lowercase, no spaces)
      const username = target.username.toLowerCase().replace(/[^a-z0-9._-]/g, "");

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const result = await callPortalAPI(username, accessLevel);

        await interaction.editReply({
          content: [
            `✅  **Portal credentials generated for <@${target.id}>**`,
            ``,
            `> **Portal URL:** https://staff.gssrp.xyz`,
            `> **Username:** \`${result.username}\``,
            `> **Password:** \`${result.password}\``,
            `> **Access Level:** ${capitalize(result.accessLevel)}`,
            ``,
            `⚠️  **Share this privately — this message is ephemeral but the password will NOT be shown again.**`,
          ].join("\n"),
          flags: MessageFlags.Ephemeral,
        });

      } catch (err) {
        console.error("[/password gen]", err.message);
        await interaction.editReply({
          content: `❌  Failed to generate portal password: \`${err.message}\`\n\nMake sure \`PORTAL_URL\` and \`PORTAL_INTERNAL_SECRET\` are set in the bot's \`.env\`.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ── /password reset ───────────────────────────────────────────────────────
    if (sub === "reset") {
      const username    = interaction.options.getString("username").toLowerCase().trim();
      const accessLevel = interaction.options.getString("access_level") || null;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const result = await callPortalAPI(username, accessLevel || "staff");

        await interaction.editReply({
          content: [
            `✅  **Portal password reset for \`${username}\`**`,
            ``,
            `> **Portal URL:** https://staff.gssrp.xyz`,
            `> **Username:** \`${result.username}\``,
            `> **New Password:** \`${result.password}\``,
            ...(accessLevel ? [`> **Access Level:** ${capitalize(result.accessLevel)}`] : []),
            ``,
            `⚠️  **Share this privately — this password will NOT be shown again.**`,
          ].join("\n"),
          flags: MessageFlags.Ephemeral,
        });

      } catch (err) {
        console.error("[/password reset]", err.message);
        await interaction.editReply({
          content: `❌  Failed to reset password: \`${err.message}\``,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
