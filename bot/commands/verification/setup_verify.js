const { SlashCommandBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { buildContainer, heading, text, sep, actionButton, row, HeadingLevel } = require("../../utils/container");
const { emojis, channels } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-verify")
    .setDescription("Post the verification panel in a channel")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Channel to post in (defaults to configured verify channel)")
    ),

  async execute(interaction) {
    if (await guard(interaction, "admin")) return;

    const target = interaction.options.getChannel("channel")
      ?? interaction.guild.channels.cache.get(channels.verifyChannel)
      ?? interaction.channel;

    const verifyBtn = actionButton("Verify", "verify_click", ButtonStyle.Primary);

    // verification category → gets banner + footer from config.images.verification
    const panel = buildContainer(
      [
        heading(`${emojis.shield}  Verification`, HeadingLevel.One),
        sep(true),
        text("Click the button below to verify your membership and gain access to the server."),
        sep(false),
        row(verifyBtn),
      ],
      "primary",
      { category: "verification" }
    );

    await target.send(panel);
    await interaction.reply({ content: "Verification panel posted.", flags: MessageFlags.Ephemeral });
  },
};
