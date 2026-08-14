const { SlashCommandBuilder } = require("discord.js");
const { infoContainer } = require("../../utils/container");
const { emojis } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's latency and API ping"),

  async execute(interaction) {
    const sent = await interaction.reply({ content: "…", fetchReply: true });
    const rtt  = sent.createdTimestamp - interaction.createdTimestamp;
    const api  = Math.round(interaction.client.ws.ping);

    await interaction.editReply(
      infoContainer(
        `${emojis.ping}  Latency`,
        [
          { label: "Roundtrip", value: `${rtt}ms` },
          { label: "API Ping",  value: `${api}ms` },
          { label: "Status",    value: api < 100 ? `${emojis.online} Good` : api < 250 ? `${emojis.idle} Average` : `${emojis.offline} High` },
        ],
        [],
        [],
        "primary"
      )
    );
  },
};
