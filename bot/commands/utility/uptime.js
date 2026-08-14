const { SlashCommandBuilder } = require("discord.js");
const { infoContainer } = require("../../utils/container");
const { emojis } = require("../../config");

function formatUptime(ms) {
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s / 60);
  const h  = Math.floor(m / 60);
  const d  = Math.floor(h / 24);
  return `${d}d ${h % 24}h ${m % 60}m ${s % 60}s`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("uptime")
    .setDescription("Check how long the bot has been running"),

  async execute(interaction) {
    const uptime = interaction.client.uptime ?? 0;

    await interaction.reply(
      infoContainer(
        `${emojis.uptime}  Bot Uptime`,
        [
          { label: "Uptime",   value: formatUptime(uptime) },
          { label: "Started",  value: `<t:${Math.floor((Date.now() - uptime) / 1000)}:R>` },
          { label: "Status",   value: `${emojis.online} Online` },
        ],
        [],
        [],
        "success"
      )
    );
  },
};
