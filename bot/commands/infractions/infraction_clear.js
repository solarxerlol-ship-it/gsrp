const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { successContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("infraction-clear")
    .setDescription("Clear all infractions from a member's record")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for clearing")),

  async execute(interaction) {
    if (await guard(interaction, "admin")) return;

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const before = db.getInfractions(target.id).length;

    db.clearInfractions(target.id);

    const payload = successContainer(`${emojis.check}  Record Cleared`, [
      `${emojis.user}   **User** — ${target.tag}`,
      `${emojis.infraction}  **Removed** — ${before} infraction(s)`,
      `${emojis.reason}  **Reason** — ${reason}`,
      `${emojis.dot}  **Cleared by** — ${interaction.user.tag}`,
    ]);

    const logCh = interaction.guild.channels.cache.get(channels.infractionLog)
      ?? await interaction.guild.channels.fetch(channels.infractionLog).catch(() => null);
    if (logCh) await logCh.send(payload);

    await interaction.reply({
      content: `${emojis.check}  Cleared **${before}** infraction(s) for **${target.tag}**.`,
      flags: require("discord.js").MessageFlags.Ephemeral,
    });
  },
};
