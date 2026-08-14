/**
 * sessionButtons.js
 * Handles the Vote button on /ssv vote messages.
 */

const { Events, MessageFlags } = require("discord.js");
const { emojis, roles, channels } = require("../config");
const Session = require("../utils/sessionDb");
const { buildVoteEmbed } = require("../commands/sessions/ssv");
const { buildSessionEmbed } = require("../commands/sessions/ssu");

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "session_vote_btn") return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const session = await Session.findOne({ guildId: interaction.guild.id });
    if (!session) return interaction.editReply({ content: "❌  No active vote found." });
    if (session.online) return interaction.editReply({ content: "❌  The session is already online." });

    if (session.votes.includes(interaction.user.id)) {
      return interaction.editReply({ content: "❌  You've already voted." });
    }

    session.votes.push(interaction.user.id);
    const reached = session.votes.length >= 5;

    if (reached) session.online = true;
    await session.save();

    // Update the vote message
    const voteCh = interaction.guild.channels.cache.get(session.voteChId)
      ?? await interaction.guild.channels.fetch(session.voteChId).catch(() => null);

    if (voteCh && session.voteMsgId) {
      const voteMsg = await voteCh.messages.fetch(session.voteMsgId).catch(() => null);
      if (voteMsg) {
        const { embed, row } = buildVoteEmbed({ id: session.votes[0] ?? interaction.user.id }, session.votes);

        if (reached) {
          // Disable the button when done
          row.components[0].setDisabled(true).setLabel("Vote (5/5)");
        }

        await voteMsg.edit({ embeds: [embed], components: [row] }).catch(() => {});
      }
    }

    // If 5 votes reached — post/update the status embed and ping
    if (reached) {
      const statusCh = interaction.guild.channels.cache.get(session.channelId)
        ?? await interaction.guild.channels.fetch(session.channelId).catch(() => null);

      if (statusCh) {
        const payload = buildSessionEmbed({
          players:    session.players,
          maxPlayers: session.maxPlayers,
          queue:      session.queue,
          staff:      session.staff ?? 0,
          link:       session.link,
          online:     true,
          votes:      session.votes,
          full:       false,
        });

        // Edit existing status msg or post new one
        let statusMsg = session.messageId
          ? await statusCh.messages.fetch(session.messageId).catch(() => null)
          : null;

        if (statusMsg) {
          await statusMsg.edit(payload).catch(() => {});
        } else {
          statusMsg = await statusCh.send(payload);
          session.messageId = statusMsg.id;
          await session.save();
        }

        const pingRole = roles.sessionPing;
        if (pingRole) {
          await statusCh.send({ content: `<@&${pingRole}> — 5 votes reached — the session is now **online**!` });
        }
      }
    }

    const remaining = Math.max(0, 5 - session.votes.length);
    await interaction.editReply({
      content: reached
        ? `${emojis.check}  5/5 votes — session is now online!`
        : `${emojis.check}  Vote recorded. **${session.votes.length}/5** — ${remaining} more needed.`,
    });
  },
};
