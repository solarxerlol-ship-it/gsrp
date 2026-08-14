const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { hasPermission } = require("../../utils/permissions");
const { emojis } = require("../../config");
const Session = require("../../utils/sessionDb");
const { buildSessionEmbed } = require("./ssu");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ssu-update")
    .setDescription("Manually update the live session stats")
    .addIntegerOption(o => o.setName("queue").setDescription("Queue count"))
    .addStringOption(o => o.setName("link").setDescription("New join link")),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!hasPermission(interaction.member, "staff")) {
      return interaction.editReply({ content: "❌  You do not have permission to use this command." });
    }

    const session = await Session.findOne({ guildId: interaction.guild.id });
    if (!session) return interaction.editReply({ content: "❌  No active session found." });

    if (interaction.options.getInteger("queue") !== null) session.queue = interaction.options.getInteger("queue");
    if (interaction.options.getString("link"))            session.link  = interaction.options.getString("link");
    await session.save();

    const statusCh = interaction.guild.channels.cache.get(session.channelId)
      ?? await interaction.guild.channels.fetch(session.channelId).catch(() => null);

    if (statusCh) {
      const msg = await statusCh.messages.fetch(session.messageId).catch(() => null);
      if (msg) await msg.edit(buildSessionEmbed({
        players:    session.players,
        maxPlayers: session.maxPlayers,
        queue:      session.queue,
        staff:      session.staff ?? 0,
        link:       session.link,
        online:     session.online,
        votes:      session.votes,
        full:       session.full,
      }));
    }

    await interaction.editReply({ content: `${emojis.check}  Session updated.` });
  },
};
