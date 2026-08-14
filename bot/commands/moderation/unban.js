const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { buildContainer, heading, sep, text, HeadingLevel, replyError } = require("../../utils/container");
const { emojis, channels } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by their ID")
    .addStringOption(o => o.setName("userid").setDescription("User ID to unban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for unban")),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const userId = interaction.options.getString("userid");
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const bans   = await interaction.guild.bans.fetch();
    const ban    = bans.get(userId);

    if (!ban) return replyError(interaction, "Not Banned", "That user does not have an active ban.");

    await interaction.deferReply({ ephemeral: true });
    await interaction.guild.bans.remove(userId, reason);

    const payload = buildContainer([
      heading(`${emojis.ulock}  Ban Removed`, HeadingLevel.Two),
      sep(false),
      text(`${emojis.user}  **User** — ${ban.user.tag}`),
      text(`${emojis.info}  **ID** — ${userId}`),
      text(`${emojis.member}  **Moderator** — ${interaction.user.tag}`),
      text(`${emojis.reason}  **Reason** — ${reason}`),
    ], "success", { noImages: true });

    const logCh = interaction.guild.channels.cache.get(channels.modLog);
    if (logCh) await logCh.send(payload);
    await interaction.editReply({ content: `${emojis.check}  **${ban.user.tag}** has been unbanned.` });
  },
};
