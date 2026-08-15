/**
 * ticketSelect.js
 * Handles the support desk select menu → creates a ticket channel.
 *
 * IMPORTANT: Discord does NOT allow ContainerBuilder (type 17) in interaction
 * replies. All containers must go to channel.send(). Interaction replies are
 * plain ephemeral text only.
 */

const {
  Events,
  ChannelType,
  PermissionFlagsBits,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const {
  buildContainer,
  heading,
  text,
  sep,
  actionButton,
  row,
  HeadingLevel,
} = require("../utils/container");

const { emojis, channels, roles, ticketCategories, ticketRoles } = require("../config");
const ticketDb = require("../utils/ticketDb");
const { TICKET_TYPES } = require("../commands/tickets/setup_tickets");

// Lazy-load closeRequests to avoid circular require at startup
function getCloseRequests() {
  try { return require("../commands/tickets/staff_panel").closeRequests; }
  catch { return null; }
}

// ── Label/detail lookup ───────────────────────────────────────────────────────
const TYPE_MAP = Object.fromEntries(TICKET_TYPES.map(t => [t.value, t]));

/**
 * Returns the ping string for a given ticket type.
 * Uses ticketRoles[type] from config (array of role IDs) so only the
 * correct role(s) for that ticket type are pinged — not everyone.
 */
function getStaffPing(type) {
  const roleIds = ticketRoles?.[type];
  if (Array.isArray(roleIds) && roleIds.length > 0) {
    return roleIds.filter(Boolean).map(id => `<@&${id}>`).join(" ");
  }
  // Fallback per type if ticketRoles is not configured
  const fallback = {
    general:          roles.staff,
    internal_affairs: roles.admin,
    management:       roles.management,
  };
  const fallbackId = fallback[type];
  return fallbackId ? `<@&${fallbackId}>` : "";
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // Step 1 — user picks a ticket type → show inquiry modal
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_open_select") {
      await handleSelectType(interaction);
      return;
    }
    // Step 2 — user submits the inquiry modal → create ticket
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_inquiry_modal:")) {
      await handleOpen(interaction);
      return;
    }
    if (interaction.isButton() && interaction.customId === "ticket_close") {
      await handleClose(interaction);
      return;
    }
    if (interaction.isButton() && interaction.customId === "ticket_claim") {
      await handleClaim(interaction);
      return;
    }
    if (interaction.isButton() && interaction.customId === "ticket_delete_confirm") {
      await handleDelete(interaction);
      return;
    }
  },
};

// ── Ephemeral plain-text reply helper (safe for interactions) ─────────────────
async function ephemeral(interaction, content) {
  const method = interaction.deferred ? "editReply" : "reply";
  return interaction[method]({ content, flags: MessageFlags.Ephemeral });
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECT TYPE  →  show inquiry modal
// ─────────────────────────────────────────────────────────────────────────────
async function handleSelectType(interaction) {
  const type     = interaction.values[0];
  const typeInfo = TYPE_MAP[type];

  if (!typeInfo) {
    return ephemeral(interaction, "❌  That ticket type does not exist.");
  }

  const existing = await ticketDb.getUserOpenTicket(interaction.user.id, type);
  if (existing) {
    return ephemeral(interaction,
      `❌  You already have an open **${typeInfo.label}** ticket — <#${existing.channelId}>.`
    );
  }

  // Show a modal so the user must provide their inquiry before the ticket opens
  const modal = new ModalBuilder()
    .setCustomId(`ticket_inquiry_modal:${type}`)
    .setTitle(`${typeInfo.label} — Describe Your Issue`);

  const inquiryInput = new TextInputBuilder()
    .setCustomId("inquiry")
    .setLabel("Briefly describe your inquiry")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Provide as much detail as possible so staff can assist you quickly.")
    .setMinLength(10)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(inquiryInput));

  await interaction.showModal(modal);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN  (called after modal submit)
// ─────────────────────────────────────────────────────────────────────────────
async function handleOpen(interaction) {
  const type     = interaction.customId.split(":")[1];
  const typeInfo = TYPE_MAP[type];
  const inquiry  = interaction.fields.getTextInputValue("inquiry");

  if (!typeInfo) {
    return ephemeral(interaction, "❌  That ticket type does not exist.");
  }

  // Re-check for duplicates in case they had two modals open
  const existing = await ticketDb.getUserOpenTicket(interaction.user.id, type);
  if (existing) {
    return ephemeral(interaction,
      `❌  You already have an open **${typeInfo.label}** ticket — <#${existing.channelId}>.`
    );
  }

  // Defer so we can do async work
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild    = interaction.guild;
  const category = ticketCategories[type];

  // Roles that should see this ticket type
  const roleIds = (ticketRoles?.[type] ?? []).filter(Boolean);

  // ── Permission overwrites ─────────────────────────────────────────────────
  const overwrites = [
    {
      id:   guild.roles.everyone,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id:    interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];

  // Grant access only to the role(s) configured for this ticket type
  for (const roleId of roleIds) {
    overwrites.push({
      id:    roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
    });
  }

  // Fallback: if no specific roles configured, grant the generic staff role
  if (roleIds.length === 0 && roles.staff) {
    overwrites.push({
      id:    roles.staff,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
    });
  }

  // ── Create channel ────────────────────────────────────────────────────────
  const channel = await guild.channels.create({
    name:   `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    type:   ChannelType.GuildText,
    parent: category ?? undefined,
    permissionOverwrites: overwrites,
  });

  const ticket = await ticketDb.createTicket({
    userId:    interaction.user.id,
    type,
    channelId: channel.id,
    guildId:   guild.id,
  });

  // ── Opening message in ticket channel ─────────────────────────────────────
  const claimBtn       = actionButton("Claim Ticket",  "ticket_claim",  ButtonStyle.Primary);
  const closeBtn       = actionButton("Close Ticket",  "ticket_close",  ButtonStyle.Danger);
  const staffPanelBtn  = actionButton("Staff Panel",   "ticket_staff_panel", ButtonStyle.Secondary);

  const openMsg = buildContainer(
    [
      heading(`${emojis.shield}  Georgia State Roleplay  —  Support`, HeadingLevel.One),
      sep(true),
      heading(typeInfo.label, HeadingLevel.Two),
      sep(false),
      text(`${emojis.user}  **Opened by** — ${interaction.user} \`(${interaction.user.id})\``),
      text(`${emojis.case}  **Ticket** — #${ticket.ticketId}`),
      text(`${emojis.calendar}  **Opened** — <t:${Math.floor(ticket.openedAt / 1000)}:F>`),
      sep(true),
      text(`${emojis.note}  ${typeInfo.detail}`),
      sep(true),
      text(`${emojis.dot}  **Inquiry**\n${inquiry}`),
      sep(true),
      text("-# A staff member will be with you shortly."),
      sep(false),
      row(claimBtn, closeBtn, staffPanelBtn),
    ],
    "primary",
    { category: "tickets" }
  );

  // Ping only the role(s) assigned to this ticket type
  const staffPing = getStaffPing(type);
  const pingContent = staffPing
    ? `${staffPing} — New **${typeInfo.label}** ticket opened by ${interaction.user}`
    : `New **${typeInfo.label}** ticket opened by ${interaction.user}`;

  await channel.send({ content: pingContent });
  await channel.send(openMsg);

  // ── Acknowledge the interaction (plain ephemeral text — no container) ──────
  await interaction.editReply({
    content: `${emojis.check}  Your ticket has been created — ${channel}. A staff member will be with you shortly.`,
  });

  // ── Log ───────────────────────────────────────────────────────────────────
  const logCh = guild.channels.cache.get(channels.modLog);
  if (logCh) {
    await logCh.send(
      buildContainer(
        [
          heading(`${emojis.tickets}  Ticket Opened`, HeadingLevel.Two),
          sep(false),
          text(`${emojis.user}  **User** — ${interaction.user.tag}`),
          text(`${emojis.info}  **Type** — ${typeInfo.label}`),
          text(`${emojis.case}  **Ticket** — #${ticket.ticketId}`),
          text(`${emojis.folder}  **Channel** — ${channel.name}`),
        ],
        "primary",
        { noImages: true }
      )
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM
// ─────────────────────────────────────────────────────────────────────────────
async function handleClaim(interaction) {
  const ticket = await ticketDb.getTicket(interaction.channel.id);

  if (!ticket) {
    return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");
  }
  if (ticket.claimedBy) {
    return ephemeral(interaction, `❌  This ticket has already been claimed by <@${ticket.claimedBy}>.`);
  }

  await ticketDb.claimTicket(interaction.channel.id, interaction.user.id);

  // Acknowledge silently, then send container to channel
  await interaction.reply({ content: "\u200b", flags: MessageFlags.Ephemeral });

  await interaction.channel.send(
    buildContainer(
      [
        heading(`${emojis.check}  Ticket Claimed`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.user}  **Claimed by** — ${interaction.user.tag}`),
        text(`${emojis.case}  **Ticket** — #${ticket.ticketId}`),
        sep(false),
        text(`${emojis.dot}  ${interaction.user} has claimed this ticket and will be assisting you.`),
      ],
      "success",
      { noImages: true }
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE
// ─────────────────────────────────────────────────────────────────────────────
async function handleClose(interaction) {
  const ticket = ticketDb.getTicket(interaction.channel.id);

  if (!ticket) {
    return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");
  }
  if (ticket.status === "closed") {
    return ephemeral(interaction, "❌  This ticket is already closed.");
  }

  const confirmBtn = actionButton("Yes, Close", "ticket_delete_confirm", ButtonStyle.Danger);

  // Acknowledge silently, send confirm prompt to channel
  await interaction.reply({ content: "\u200b", flags: MessageFlags.Ephemeral });

  await interaction.channel.send(
    buildContainer(
      [
        heading(`${emojis.lock}  Close Ticket`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.dot}  Are you sure you want to close **Ticket #${ticket.ticketId}**?`),
        text("-# This channel will be deleted after closing."),
        sep(false),
        row(confirmBtn),
      ],
      "danger",
      { noImages: true }
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE (confirmed close)
// ─────────────────────────────────────────────────────────────────────────────
async function handleDelete(interaction) {
  const ticket = ticketDb.getTicket(interaction.channel.id);

  if (!ticket) {
    return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");
  }

  ticketDb.closeTicket(interaction.channel.id);

  // Cancel any pending staff-panel close request timer
  const closeRequests = getCloseRequests();
  if (closeRequests?.has(interaction.channel.id)) {
    clearTimeout(closeRequests.get(interaction.channel.id).timer);
    closeRequests.delete(interaction.channel.id);
  }

  // Log before deleting
  const guild = interaction.guild;
  const logCh = guild.channels.cache.get(channels.modLog);
  if (logCh) {
    const typeInfo = TYPE_MAP[ticket.type];
    await logCh.send(
      buildContainer(
        [
          heading(`${emojis.lock}  Ticket Closed`, HeadingLevel.Two),
          sep(false),
          text(`${emojis.case}  **Ticket** — #${ticket.ticketId}`),
          text(`${emojis.info}  **Type** — ${typeInfo?.label ?? ticket.type}`),
          text(`${emojis.user}  **Opened by** — <@${ticket.userId}>`),
          text(`${emojis.member}  **Closed by** — ${interaction.user.tag}`),
          text(`${emojis.clock}  **Duration** — ${formatDuration(Date.now() - ticket.openedAt)}`),
        ],
        "neutral",
        { noImages: true }
      )
    );
  }

  // Acknowledge the button press with a plain ephemeral — avoids the empty
  // message error that occurs when update() is called with no content/embeds.
  await interaction.reply({ content: `${emojis.lock}  Closing ticket…`, flags: MessageFlags.Ephemeral });

  await interaction.channel.send(
    buildContainer(
      [
        heading(`${emojis.lock}  Closing Ticket`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.dot}  Ticket #${ticket.ticketId} is being closed.`),
        text("-# This channel will be deleted in 3 seconds."),
      ],
      "success",
      { noImages: true }
    )
  );

  const channelToDelete = interaction.channel;
  const channelId       = interaction.channel.id;
  setTimeout(async () => {
    await channelToDelete.delete("Ticket closed").catch(() => {});
    ticketDb.deleteTicket(channelId);
  }, 3000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
