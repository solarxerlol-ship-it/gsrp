const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { infoContainer, errorContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transfer")
    .setDescription("Transfer a member to a different department/division")
    .addUserOption(o => o.setName("user").setDescription("Member to transfer").setRequired(true))
    .addStringOption(o => o.setName("from").setDescription("Department transferring from").setRequired(true))
    .addStringOption(o => o.setName("to").setDescription("Department transferring to").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for transfer")),

  async execute(interaction) {
    if (await guard(interaction, "management")) return;

    const target = interaction.options.getUser("user");
    const from   = interaction.options.getString("from");
    const to     = interaction.options.getString("to");
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    db.logPromotion({
      userId:   target.id,
      fromDept: from,
      toDept:   to,
      reason,
      executor: interaction.user.id,
      type:     "TRANSFER",
    });

    const payload = infoContainer(
      `${emojis.transfer}  Transfer Logged`,
      [
        { label: "Member",    value: target.tag },
        { label: "From Dept", value: from },
        { label: "To Dept",   value: to },
        { label: "Issued by", value: interaction.user.tag },
      ],
      [`${emojis.reason}  **Reason** — ${reason}`],
      [],
      "primary",
      "promotions"
    );

    await interaction.reply(payload);
    const logCh = interaction.guild.channels.cache.get(channels.promotionLog);
    if (logCh) await logCh.send(payload);
  },
};
