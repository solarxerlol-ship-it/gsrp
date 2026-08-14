const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { infoContainer } = require("../../utils/container");
const { emojis } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("infractions")
    .setDescription("View a member's infraction history")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true)),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const target  = interaction.options.getUser("user");
    const records = db.getInfractions(target.id);

    if (!records.length) {
      return interaction.reply(
        infoContainer(
          `${emojis.history}  Infraction History`,
          [{ label: "User", value: target.tag }, { label: "Total", value: "0" }],
          [`${emojis.check}  No infractions on record.`],
          [],
          "success",
          "infractions"
        )
      );
    }

    const typeCounts = {};
    records.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] ?? 0) + 1; });

    const stats = [
      { label: "User",  value: target.tag },
      { label: "Total", value: `${records.length}` },
      ...Object.entries(typeCounts).map(([k, v]) => ({ label: k, value: `${v}` })),
    ];

    const recentLines = records.slice(-5).reverse().map(r => {
      const date = new Date(r.timestamp).toLocaleDateString();
      return `${emojis.dot}  **[#${r.caseId}] ${r.type}** — ${r.reason} *(${date})*`;
    });

    await interaction.reply(
      infoContainer(
        `${emojis.history}  Infraction History`,
        stats,
        [`**Recent (last 5)**`, ...recentLines],
        [],
        "danger",
        "infractions"
      )
    );
  },
};
