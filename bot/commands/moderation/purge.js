const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { replyError } = require("../../utils/container");
const { emojis } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk delete messages from a channel")
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages to delete (1–100)").setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName("user").setDescription("Only delete messages from this user")),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const amount = interaction.options.getInteger("amount");
    const filter = interaction.options.getUser("user");

    await interaction.deferReply({ ephemeral: true });

    let messages = await interaction.channel.messages.fetch({ limit: 100 });
    if (filter) messages = messages.filter(m => m.author.id === filter.id);

    const toDelete = [...messages.values()].slice(0, amount);
    if (!toDelete.length) return replyError(interaction, "Nothing to Delete", "No messages found matching the criteria.");

    const deleted = await interaction.channel.bulkDelete(toDelete, true);
    await interaction.editReply({
      content: `${emojis.check}  Deleted **${deleted.size}** message(s)${filter ? ` from **${filter.tag}**` : ""}.`,
    });
  },
};
