const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { infoContainer, errorContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("demote")
    .setDescription("Demote a member to a lower role")
    .addUserOption(o => o.setName("user").setDescription("Member to demote").setRequired(true))
    .addRoleOption(o => o.setName("from").setDescription("Role they are being demoted from").setRequired(true))
    .addRoleOption(o => o.setName("to").setDescription("Role they are being demoted to").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for demotion").setRequired(true)),

  async execute(interaction) {
    if (await guard(interaction, "management")) return;

    const target = interaction.options.getUser("user");
    const from   = interaction.options.getRole("from");
    const to     = interaction.options.getRole("to");
    const reason = interaction.options.getString("reason");
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) return interaction.reply({ ...errorContainer("Not Found", "User not in server."), ephemeral: true });

    await member.roles.remove(from, reason).catch(() => {});
    await member.roles.add(to, reason).catch(() => {});

    db.logPromotion({
      userId:   target.id,
      fromRole: from.id,
      toRole:   to.id,
      reason,
      executor: interaction.user.id,
      type:     "DEMOTION",
    });

    const payload = infoContainer(
      `${emojis.demote}  Demotion Logged`,
      [
        { label: "Member",    value: target.tag },
        { label: "From",      value: from.name },
        { label: "To",        value: to.name },
        { label: "Issued by", value: interaction.user.tag },
      ],
      [`${emojis.reason}  **Reason** — ${reason}`],
      [],
      "danger",
      "promotions"
    );

    await interaction.reply(payload);
    const logCh = interaction.guild.channels.cache.get(channels.promotionLog);
    if (logCh) await logCh.send(payload);
  },
};
