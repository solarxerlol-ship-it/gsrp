const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { successContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock a locked channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to unlock (defaults to current)"))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    const reason  = interaction.options.getString("reason") ?? "No reason provided";

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null,
    }, { reason });

    const payload = successContainer(`${emojis.unlock}  Channel Unlocked`, [
      `${emojis.dot}  **Channel** — ${channel}`,
      `${emojis.reason}  **Reason** — ${reason}`,
    ]);

    await interaction.reply(payload);
    const logCh = interaction.guild.channels.cache.get(channels.modLog);
    if (logCh) await logCh.send(payload);
  },
};
