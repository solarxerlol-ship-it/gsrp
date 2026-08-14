const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { buildContainer, heading, sep, text, HeadingLevel, replyError } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("promote")
    .setDescription("Log a promotion movement for a member")
    .addUserOption(o => o.setName("user").setDescription("Member being promoted").setRequired(true))
    .addRoleOption(o => o.setName("from").setDescription("Role they are coming from").setRequired(true))
    .addRoleOption(o => o.setName("to").setDescription("Role they are moving to").setRequired(true))
    .addStringOption(o => o.setName("notes").setDescription("Notes for this promotion"))
    .addUserOption(o => o.setName("approval").setDescription("Staff member who approved this")),

  async execute(interaction) {
    if (await guard(interaction, "management")) return;

    const target   = interaction.options.getUser("user");
    const from     = interaction.options.getRole("from");
    const to       = interaction.options.getRole("to");
    const notes    = interaction.options.getString("notes") ?? "No notes provided";
    const approval = interaction.options.getUser("approval") ?? interaction.user;
    const member   = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) return replyError(interaction, "Not Found", "User not in server.");

    await interaction.deferReply({ ephemeral: true });
    await member.roles.remove(from).catch(() => {});
    await member.roles.add(to).catch(() => {});

    db.logPromotion({
      userId: target.id,
      fromRole: from.id,
      toRole: to.id,
      notes,
      approvedBy: approval.id,
      executor: interaction.user.id,
      type: "PROMOTION",
    });

    const payload = buildContainer(
      [
        // ── Information ──────────────────────────────────────────────────────
        heading(`${emojis.info}  Information`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.user}  **User:** <@${target.id}> ( ${target.id} )`),
        text(`${emojis.member}  **Signee:** <@${interaction.user.id}> ( ${interaction.user.id} )`),
        sep(true),
        // ── Details ──────────────────────────────────────────────────────────
        heading(`${emojis.folder}  Details`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.promote}  **Promotion:** <@&${from.id}> → <@&${to.id}>`),
        text(`${emojis.note}  **Notes:** ${notes}`),
        text(`${emojis.member}  **Approvals:** <@${approval.id}>`),
      ],
      "success",
      { category: "promotions" }
    );

    const logCh = interaction.guild.channels.cache.get(channels.promotionLog)
      ?? await interaction.guild.channels.fetch(channels.promotionLog).catch(() => null);
    if (logCh) await logCh.send({ ...payload, allowedMentions: { parse: [] } });

    await interaction.editReply({
      content: `${emojis.check}  **${target.tag}** has been promoted from **${from.name}** to **${to.name}**.`,
    });
  },
};
