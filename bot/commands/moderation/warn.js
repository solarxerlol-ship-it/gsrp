const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { infoContainer, errorContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a warning to a member")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for warning").setRequired(true)),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    const infraction = db.addInfraction(target.id, {
      type:      "WARN",
      reason,
      moderator: interaction.user.id,
      guild:     interaction.guild.id,
    });

    const history = db.getInfractions(target.id);

    const payload = infoContainer(
      `${emojis.warn}  Warning Issued`,
      [
        { label: "User",        value: target.tag },
        { label: "Case",        value: `#${infraction.caseId}` },
        { label: "Total Warns", value: `${history.filter(i => i.type === "WARN").length}` },
        { label: "Moderator",   value: interaction.user.tag },
      ],
      [`${emojis.reason}  **Reason** — ${reason}`],
      [],
      "warning",
      "moderation"
    );

    await interaction.reply(payload);

    // Attempt DM
    await target.send(payload).catch(() => {});

    const logCh = interaction.guild.channels.cache.get(channels.modLog);
    if (logCh) await logCh.send(payload);
  },
};
