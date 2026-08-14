/**
 * /ssv — Session Vote
 * Posts a clean vote message with a clickable Vote button.
 * At 5 votes the session status embed goes online and the role is pinged.
 */

const {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

const { hasPermission } = require("../../utils/permissions");
const { emojis, channels, roles } = require("../../config");
const Session = require("../../utils/sessionDb");
const { buildSessionEmbed } = require("./ssu");

// ── Command ───────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ssv")
    .setDescription("Start a session vote (5 votes needed)"),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!hasPermission(interaction.member, "staff")) {
      return interaction.editReply({ content: "❌  You do not have permission to use this command." });
    }

    const statusCh = interaction.guild.channels.cache.get(channels.sessionStatus)
      ?? await interaction.guild.channels.fetch(channels.sessionStatus).catch(() => null);
    if (!statusCh) return interaction.editReply({ content: "❌  Set `CHANNEL_SESSION_STATUS` first." });

    // Reset session doc to pending
    await Session.findOneAndUpdate(
      { guildId: interaction.guild.id },
      {
        $set: {
          guildId:    interaction.guild.id,
          online:     false,
          full:       false,
          votes:      [],
          players:    0,
          maxPlayers: 50,
          queue:      0,
          staff:      0,
          startedAt:  Date.now(),
          voteMsgId:  null,
          voteChId:   null,
          messageId:  null,
          channelId:  statusCh.id,
          link:       "https://policeroleplay.community",
        },
      },
      { upsert: true }
    );

    // Ping role
    const pingRole = roles.sessionPing;
    if (pingRole) {
      await statusCh.send({ content: `<@&${pingRole}> — A session vote has started!` });
    }

    // Post vote message
    const { embed, row } = buildVoteEmbed(interaction.user, []);
    const voteMsg = await statusCh.send({ embeds: [embed], components: [row] });

    // Save vote msg ID
    await Session.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { voteMsgId: voteMsg.id, voteChId: statusCh.id }
    );

    await interaction.editReply({ content: `${emojis.check}  Vote started in ${statusCh}.` });
  },
};

// ── Vote embed + button builder ───────────────────────────────────────────────

function buildVoteEmbed(initiator, votes = []) {
  const count = votes.length;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setDescription(
      `A session vote was started by <@${initiator.id}>. Vote below!\n\n**Votes:** ${count} / 5`
    );

  const btn = new ButtonBuilder()
    .setCustomId("session_vote_btn")
    .setLabel(`Vote (${count}/5)`)
    .setStyle(count >= 5 ? ButtonStyle.Success : ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(btn);

  return { embed, row };
}

module.exports.buildVoteEmbed = buildVoteEmbed;
