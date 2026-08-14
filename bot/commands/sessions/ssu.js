/**
 * /ssu — Session Start Up
 * Posts the session status embed, pings the session role, marks Online.
 */

const {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const { guard }           = require("../../utils/permissions");
const { hasPermission }   = require("../../utils/permissions");
const { emojis, channels, roles } = require("../../config");
const Session             = require("../../utils/sessionDb");
const erlc                = require("../../utils/erlc");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ssu")
    .setDescription("Start a session and post the status embed")
    .addStringOption(o => o.setName("link").setDescription("In-game join link").setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!hasPermission(interaction.member, "management")) {
      return interaction.editReply({ content: "❌  You do not have permission to use this command." });
    }

    const link = interaction.options.getString("link");

    const statusCh = interaction.guild.channels.cache.get(channels.sessionStatus)
      ?? await interaction.guild.channels.fetch(channels.sessionStatus).catch(() => null);
    if (!statusCh) return interaction.editReply({ content: "❌  Set `CHANNEL_SESSION_STATUS` in your environment variables." });

    // Fetch live stats
    const server  = await erlc.getServer().catch(() => null);
    const players = server?.CurrentPlayers ?? 45;
    const maxPlayers = server?.MaxPlayers ?? 50;

    const payload = buildSessionEmbed({ players, maxPlayers, queue: 0, link, online: true, votes: [], full: false });

    const pingRole = roles.sessionPing;
    if (pingRole) await statusCh.send({ content: `<@&${pingRole}> — A session is now **online**!` });

    const msg = await statusCh.send(payload);

    await Session.findOneAndUpdate(
      { guildId: interaction.guild.id },
      {
        guildId: interaction.guild.id,
        messageId: msg.id,
        channelId: statusCh.id,
        players, maxPlayers,
        queue: 0,
        link,
        online: true,
        full: false,
        votes: [],
        startedAt: Date.now(),
      },
      { upsert: true }
    );

    await interaction.editReply({ content: `${emojis.check}  Session started — status posted in ${statusCh}.` });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared embed builder — matches reference screenshot layout exactly
// Uses SectionBuilder for the label+value stat rows
// ─────────────────────────────────────────────────────────────────────────────
function buildSessionEmbed({ players, maxPlayers = 50, queue = 0, staff = 0, link, online, votes = [], full = false }) {
  const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
  } = require("discord.js");

  const { images } = require("../../config");
  const accent     = online && !full ? 0x3B82F6 : 0x2B2D31;

  const statusLabel = full ? "Full" : online ? "Online" : "Offline";
  const note = online && !full
    ? `Welcome to **Georgia State Roleplay**! We host fun, active, and engaging sessions. Sessions are hosted at peak activity times. We hope you enjoy fun and immersive roleplaying experiences.`
    : full
    ? `Welcome to **Georgia State Roleplay**! The session is currently **full**. Keep an eye out for openings — more slots may become available soon.`
    : `The session has concluded. Thanks to everyone who joined! We hope to see you next time.`;

  function sep() {
    return new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);
  }

  function statSection(customId, label, subtext, value) {
    return new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${label}**\n-# ${subtext}`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(customId)
          .setLabel(value)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
  }

  const c = new ContainerBuilder().setAccentColor(accent);

  // Banner
  const bannerUrl = images?.sessions?.banner;
  if (bannerUrl) {
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(bannerUrl))
    );
    c.addSeparatorComponents(sep());
  }

  // Title
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${emojis.wifi}  Sessions`));
  c.addSeparatorComponents(sep());

  // Description
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(note));
  c.addSeparatorComponents(sep());

  // Stats
  c.addSectionComponents(statSection("stat_players", "Players", "How many players are in game",   `${players}/${maxPlayers}`));
  c.addSectionComponents(statSection("stat_queue",   "Queue",   "How many people are in queue",   `${queue}`));
  c.addSectionComponents(statSection("stat_staff",   "Staff",   "How many staff are in game",     `${staff}`));
  c.addSeparatorComponents(sep());

  // Bottom row: status + join
  const statusBtn = new ButtonBuilder()
    .setCustomId("session_status_noop")
    .setLabel(statusLabel)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const bottomRow = new ActionRowBuilder().addComponents(statusBtn);

  if (online && !full && link) {
    bottomRow.addComponents(
      new ButtonBuilder()
        .setLabel("Join In-Game")
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );
  }

  c.addActionRowComponents(bottomRow);

  // Last updated
  if (online || full) {
    const unixSec = Math.floor(Date.now() / 1000);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Last Updated  <t:${unixSec}:R>`));
  }

  // Footer
  const footerUrl = images?.sessions?.footer;
  if (footerUrl) {
    c.addSeparatorComponents(sep());
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(footerUrl))
    );
  }

  return { flags: MessageFlags.IsComponentsV2, components: [c] };
}

module.exports.buildSessionEmbed = buildSessionEmbed;
