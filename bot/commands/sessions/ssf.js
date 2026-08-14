const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { hasPermission } = require("../../utils/permissions");
const { emojis, roles } = require("../../config");
const Session = require("../../utils/sessionDb");
const { buildSessionEmbed } = require("./ssu");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ssf")
    .setDescription("Mark the session as full"),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!hasPermission(interaction.member, "management")) {
      return interaction.editReply({ content: "❌  You do not have permission to use this command." });
    }

    const session = await Session.findOne({ guildId: interaction.guild.id });
    if (!session || !session.online) return interaction.editReply({ content: "❌  No active session found." });
    if (session.full) return interaction.editReply({ content: "❌  Session is already marked as full." });

    session.full = true;
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
        full:       true,
      }));

      const pingRole = roles.sessionPing;
      if (pingRole) await statusCh.send({ content: `<@&${pingRole}> — The session is now **full**!` });
    }

    await interaction.editReply({ content: `${emojis.check}  Session marked as full.` });
  },
};
