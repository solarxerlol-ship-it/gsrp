const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { buildContainer, heading, sep, text, HeadingLevel, replyError, sendContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for ban"))
    .addIntegerOption(o => o.setName("days").setDescription("Days of messages to delete (0-7)").setMinValue(0).setMaxValue(7)),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const days   = interaction.options.getInteger("days") ?? 0;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member)          return replyError(interaction, "User Not Found", "That user is not in this server.");
    if (!member.bannable) return replyError(interaction, "Cannot Ban", "I cannot ban this user — they may have a higher role.");

    await interaction.deferReply({ ephemeral: true });
    await member.ban({ reason, deleteMessageDays: days });

    const infraction = db.addInfraction(target.id, { type: "BAN", reason, moderator: interaction.user.id, guild: interaction.guild.id });

    const payload = buildContainer([
      heading(`${emojis.lock}  Ban Issued`, HeadingLevel.Two),
      sep(false),
      text(`${emojis.user}  **User** — ${target.tag}`),
      text(`${emojis.folder}  **Case** — #${infraction.caseId}`),
      text(`${emojis.member}  **Moderator** — ${interaction.user.tag}`),
      text(`${emojis.reason}  **Reason** — ${reason}`),
    ], "danger", { noImages: true });

    const logCh = interaction.guild.channels.cache.get(channels.modLog);
    if (logCh) await logCh.send(payload);
    await interaction.editReply({ content: `${emojis.check}  **${target.tag}** has been banned.` });
  },
};
