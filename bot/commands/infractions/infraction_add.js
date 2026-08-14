const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { buildContainer, heading, sep, text, HeadingLevel } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

const TYPES = ["WARN", "STRIKE", "SUSPENSION", "DEMOTION", "NOTE"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("infraction-add")
    .setDescription("Add an infraction to a member's record")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption(o =>
      o.setName("type").setDescription("Infraction type").setRequired(true)
       .addChoices(...TYPES.map(t => ({ name: t, value: t })))
    )
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Additional description")),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const target = interaction.options.getUser("user");
    const type   = interaction.options.getString("type");
    const reason = interaction.options.getString("reason");
    const desc   = interaction.options.getString("description") ?? "";

    const infraction = await db.addInfraction(target.id, {
      type, reason, description: desc,
      moderator: interaction.user.id,
      guild: interaction.guild.id,
    });

    const payload = buildContainer(
      [
        // ── Information ──────────────────────────────────────────────────────
        heading(`${emojis.info}  Information`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.user}  **User:** <@${target.id}> ( ${target.id} )`),
        text(`${emojis.member}  **Executor:** <@${interaction.user.id}> ( ${interaction.user.id} )`),
        sep(true),
        // ── Details ──────────────────────────────────────────────────────────
        heading(`${emojis.folder}  Details`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.promote}  **Punishment:** ${type}`),
        text(`${emojis.note}  **Reason:** ${reason}`),
        ...(desc ? [text(`${emojis.note}  **Description:** ${desc}`)] : []),
        text(`${emojis.member}  **Case ID:** #${infraction.caseId}`),
      ],
      "danger",
      { category: "infractions" }
    );

    const logCh = interaction.guild.channels.cache.get(channels.infractionLog)
      ?? await interaction.guild.channels.fetch(channels.infractionLog).catch(() => null);
    if (logCh) await logCh.send(payload);

    await interaction.reply({
      content: `${emojis.check}  Infraction **#${infraction.caseId}** added for <@${target.id}>.`,
      flags: require("discord.js").MessageFlags.Ephemeral,
    });
  },
};
