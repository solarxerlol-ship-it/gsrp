const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { successContainer, errorContainer } = require("../../utils/container");
const { emojis } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode on a channel")
    .addIntegerOption(o => o.setName("seconds").setDescription("Seconds between messages (0 to disable)").setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption(o => o.setName("channel").setDescription("Channel (defaults to current)")),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const seconds = interaction.options.getInteger("seconds");
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    await channel.setRateLimitPerUser(seconds);

    const label = seconds === 0 ? "Disabled" : `${seconds}s`;

    await interaction.reply(
      successContainer(`${emojis.slowmode}  Slowmode Updated`, [
        `${emojis.dot}  **Channel** — ${channel}`,
        `${emojis.dot}  **Slowmode** — ${label}`,
        `${emojis.dot}  **Set by** — ${interaction.user.tag}`,
      ])
    );
  },
};
