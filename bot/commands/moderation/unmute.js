const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { buildContainer, heading, sep, text, HeadingLevel, replyError } = require("../../utils/container");
const { emojis, channels, roles } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute a muted member")
    .addUserOption(o => o.setName("user").setDescription("User to unmute").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for unmute")),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) return replyError(interaction, "Not Found", "User not in server.");

    const muteRole = interaction.guild.roles.cache.get(roles.muted);
    if (!muteRole || !member.roles.cache.has(muteRole.id))
      return replyError(interaction, "Not Muted", "That user is not muted.");

    await interaction.deferReply({ ephemeral: true });
    await member.roles.remove(muteRole, reason);
    db.removeMute(target.id);

    const payload = buildContainer([
      heading(`${emojis.ulock}  Member Unmuted`, HeadingLevel.Two),
      sep(false),
      text(`${emojis.user}  **User** — ${target.tag}`),
      text(`${emojis.member}  **Moderator** — ${interaction.user.tag}`),
      text(`${emojis.reason}  **Reason** — ${reason}`),
    ], "success", { noImages: true });

    const logCh = interaction.guild.channels.cache.get(channels.modLog);
    if (logCh) await logCh.send(payload);
    await interaction.editReply({ content: `${emojis.check}  **${target.tag}** has been unmuted.` });
  },
};
