const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { infoContainer, successContainer } = require("../../utils/container");
const { emojis } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configure AutoMod settings")
    .addSubcommand(sub =>
      sub.setName("view")
        .setDescription("View current AutoMod settings")
    )
    .addSubcommand(sub =>
      sub.setName("toggle")
        .setDescription("Toggle an AutoMod module")
        .addStringOption(o =>
          o.setName("module").setDescription("Module to toggle").setRequired(true)
           .addChoices(
             { name: "All AutoMod",    value: "enabled" },
             { name: "Anti-Spam",      value: "antiSpam" },
             { name: "Anti-Links",     value: "antiLinks" },
             { name: "Anti-Invites",   value: "antiInvites" },
             { name: "Anti-Caps",      value: "antiCaps" },
             { name: "Anti-Mention",   value: "antiMassMention" },
             { name: "Anti-Duplicate", value: "antiDuplicates" },
             { name: "Word Filter",    value: "wordFilter" },
           )
        )
    ),

  async execute(interaction) {
    if (await guard(interaction, "admin")) return;

    const sub = interaction.options.getSubcommand();

    if (sub === "view") {
      const s = db.getAutomodSettings();
      const bool = v => v ? `${emojis.check} On` : `${emojis.cross} Off`;

      return interaction.reply(
        infoContainer(
          `${emojis.automod}  AutoMod Configuration`,
          [
            { label: "AutoMod",         value: bool(s.enabled) },
            { label: "Anti-Spam",       value: bool(s.antiSpam) },
            { label: "Anti-Links",      value: bool(s.antiLinks) },
            { label: "Anti-Invites",    value: bool(s.antiInvites) },
            { label: "Anti-Caps",       value: bool(s.antiCaps) },
            { label: "Anti-Mention",    value: bool(s.antiMassMention) },
            { label: "Anti-Duplicate",  value: bool(s.antiDuplicates) },
            { label: "Word Filter",     value: bool(s.wordFilter) },
          ],
          [],
          [],
          "primary"
        )
      );
    }

    if (sub === "toggle") {
      const module = interaction.options.getString("module");
      const s      = db.getAutomodSettings();
      s[module]    = !s[module];
      db.setAutomodSettings(s);

      return interaction.reply(
        successContainer(`${emojis.automod}  AutoMod Updated`, [
          `${emojis.dot}  **Module** — ${module}`,
          `${emojis.dot}  **Status** — ${s[module] ? `${emojis.check} Enabled` : `${emojis.cross} Disabled`}`,
        ])
      );
    }
  },
};
