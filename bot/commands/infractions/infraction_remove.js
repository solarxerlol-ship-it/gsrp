const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { successContainer, errorContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("infraction-remove")
    .setDescription("Remove an infraction by Case ID")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addIntegerOption(o => o.setName("caseid").setDescription("Case ID to remove").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for removal")),

  async execute(interaction) {
    if (await guard(interaction, "admin")) return;

    const target = interaction.options.getUser("user");
    const caseId = interaction.options.getInteger("caseid");
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const removed = db.removeInfraction(target.id, caseId);

    if (!removed) {
      return interaction.reply({
        ...errorContainer("Not Found", `Case #${caseId} not found for ${target.tag}.`),
        ephemeral: true,
      });
    }

    const payload = successContainer(`${emojis.check}  Infraction Removed`, [
      `${emojis.user}  **User** — ${target.tag}`,
      `${emojis.case}  **Case** — #${caseId}`,
      `${emojis.reason}  **Reason** — ${reason}`,
      `${emojis.dot}  **Removed by** — ${interaction.user.tag}`,
    ]);

    const logCh = interaction.guild.channels.cache.get(channels.infractionLog)
      ?? await interaction.guild.channels.fetch(channels.infractionLog).catch(() => null);
    if (logCh) await logCh.send(payload);

    await interaction.reply({
      content: `${emojis.check}  Case **#${caseId}** removed for **${target.tag}**.`,
      flags: require("discord.js").MessageFlags.Ephemeral,
    });
  },
};
