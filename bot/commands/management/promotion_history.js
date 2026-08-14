const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { infoContainer } = require("../../utils/container");
const { emojis } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("promotion-history")
    .setDescription("View promotion/demotion/transfer history for a member")
    .addUserOption(o => o.setName("user").setDescription("Target member").setRequired(true)),

  async execute(interaction) {
    if (await guard(interaction, "staff")) return;

    const target  = interaction.options.getUser("user");
    const history = db.getPromotionHistory(target.id);

    if (!history.length) {
      return interaction.reply(
        infoContainer(
          `${emojis.history}  Rank History`,
          [{ label: "Member", value: target.tag }, { label: "Total Events", value: "0" }],
          [`${emojis.check}  No rank events on record.`],
          [],
          "neutral",
          "promotions"
        )
      );
    }

    const promotions = history.filter(h => h.type === "PROMOTION").length;
    const demotions  = history.filter(h => h.type === "DEMOTION").length;
    const transfers  = history.filter(h => h.type === "TRANSFER").length;

    const recent = history.slice(-5).reverse().map(h => {
      const date = new Date(h.timestamp).toLocaleDateString();
      if (h.type === "TRANSFER") {
        return `${emojis.dot}  **${h.type}** — ${h.fromDept} → ${h.toDept} *(${date})*`;
      }
      return `${emojis.dot}  **${h.type}** — <@&${h.fromRole}> → <@&${h.toRole}> *(${date})*`;
    });

    await interaction.reply(
      infoContainer(
        `${emojis.history}  Rank History`,
        [
          { label: "Member",     value: target.tag },
          { label: "Promotions", value: `${promotions}` },
          { label: "Demotions",  value: `${demotions}` },
          { label: "Transfers",  value: `${transfers}` },
        ],
        [`**Recent (last 5)**`, ...recent],
        [],
        "primary",
        "promotions"
      )
    );
  },
};
