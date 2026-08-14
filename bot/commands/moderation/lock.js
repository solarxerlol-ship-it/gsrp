const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { successContainer, errorContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock a channel — prevents members from sending messages")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to lock (defaults to current)"))
    .addStringOption(o => o.setName("reason").setDescription("Reason for lock")),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    const reason  = interaction.options.getString("reason") ?? "No reason provided";

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false,
    }, { reason });

    const payload = successContainer(`${emojis.lock}  Channel Locked`, [
      `${emojis.dot}  **Channel** — ${channel}`,
      `${emojis.reason}  **Reason** — ${reason}`,
      `${emojis.dot}  **Locked by** — ${interaction.user.tag}`,
    ]);

    await interaction.reply(payload);
    const logCh = interaction.guild.channels.cache.get(channels.modLog);
    if (logCh) await logCh.send(payload);
  },
};
