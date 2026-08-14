const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { buildContainer, heading, sep, text, HeadingLevel, replyError } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for kick")),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member)         return replyError(interaction, "Not Found", "User not in server.");
    if (!member.kickable) return replyError(interaction, "Cannot Kick", "I cannot kick this user.");

    await interaction.deferReply({ ephemeral: true });
    await member.kick(reason);

    const infraction = db.addInfraction(target.id, { type: "KICK", reason, moderator: interaction.user.id, guild: interaction.guild.id });

    const payload = buildContainer([
      heading(`${emojis.exclamation}  Member Kicked`, HeadingLevel.Two),
      sep(false),
      text(`${emojis.user}  **User** — ${target.tag}`),
      text(`${emojis.folder}  **Case** — #${infraction.caseId}`),
      text(`${emojis.member}  **Moderator** — ${interaction.user.tag}`),
      text(`${emojis.reason}  **Reason** — ${reason}`),
    ], "warning", { noImages: true });

    const logCh = interaction.guild.channels.cache.get(channels.modLog);
    if (logCh) await logCh.send(payload);
    await interaction.editReply({ content: `${emojis.check}  **${target.tag}** has been kicked.` });
  },
};
