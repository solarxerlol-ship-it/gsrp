/**
 * staffPanel.js
 * Handles all button/modal interactions spawned by /staff-panel.
 *
 * customIds used:
 *   sp_escalate          — escalate ticket tier
 *   sp_rename            — open rename modal
 *   sp_rename_modal      — modal submit: rename
 *   sp_close_request     — post 24-h close countdown
 *   sp_close_confirm     — ticket opener confirms close
 *   sp_close_cancel      — ticket opener cancels close
 *   sp_add_user          — open add-user modal
 *   sp_add_user_modal    — modal submit: add user
 *   sp_remove_user       — open remove-user modal
 *   sp_remove_user_modal — modal submit: remove user
 */

const {
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonStyle,
  PermissionFlagsBits,
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

const { hasPermission } = require("../utils/permissions");
const { emojis, ticketCategories, ticketRoles, roles } = require("../config");
const ticketDb = require("../utils/ticketDb");
const { TICKET_TYPES } = require("../commands/tickets/setup_tickets");
const { closeRequests } = require("../commands/tickets/staff_panel");
const mongoose = require("mongoose");
const Ticket = mongoose.models.Ticket || require("mongoose").model("Ticket");

const TYPE_MAP   = Object.fromEntries(TICKET_TYPES.map(t => [t.value, t]));
const TYPE_ORDER = TICKET_TYPES.map(t => t.value);

const CLOSE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    const id = interaction.customId;

    if (interaction.isButton()) {
      if (id === "ticket_staff_panel") return handleStaffPanelButton(interaction);
      if (id === "sp_escalate")       return handleEscalate(interaction);
      if (id === "sp_rename")         return handleRenamePrompt(interaction);
      if (id === "sp_close_request")  return handleCloseRequest(interaction);
      if (id === "sp_close_confirm")  return handleCloseConfirm(interaction);
      if (id === "sp_close_cancel")   return handleCloseCancel(interaction);
      if (id === "sp_add_user")       return handleAddUserPrompt(interaction);
      if (id === "sp_remove_user")    return handleRemoveUserPrompt(interaction);
    }

    if (interaction.isModalSubmit()) {
      if (id === "sp_rename_modal")      return handleRenameSubmit(interaction);
      if (id === "sp_add_user_modal")    return handleAddUserSubmit(interaction);
      if (id === "sp_remove_user_modal") return handleRemoveUserSubmit(interaction);
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ephemeral(interaction, content) {
  const method = interaction.deferred ? "editReply" : "reply";
  return interaction[method]({ content, flags: MessageFlags.Ephemeral });
}

function staffOnly(interaction) {
  return !hasPermission(interaction.member, "staff");
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF PANEL BUTTON  (shown in every ticket, staff only)
// ─────────────────────────────────────────────────────────────────────────────
async function handleStaffPanelButton(interaction) {
  if (staffOnly(interaction)) {
    return ephemeral(interaction, "❌  You do not have permission to access the staff panel.");
  }

  const ticket = ticketDb.getTicket(interaction.channel.id);
  if (!ticket) return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");

  const { actionButton: ab, row: r } = require("../utils/container");

  const escalateBtn   = ab("Escalate Ticket", "sp_escalate",      ButtonStyle.Primary);
  const renameBtn     = ab("Rename Ticket",   "sp_rename",        ButtonStyle.Secondary);
  const closeReqBtn   = ab("Request Close",   "sp_close_request", ButtonStyle.Danger);
  const addUserBtn    = ab("Add User",         "sp_add_user",      ButtonStyle.Secondary);
  const removeUserBtn = ab("Remove User",      "sp_remove_user",   ButtonStyle.Secondary);

  await interaction.reply({
    content: `**${emojis.shield}  Staff Panel**`,
    components: [
      new (require("discord.js").ActionRowBuilder)().addComponents(escalateBtn, renameBtn, closeReqBtn),
      new (require("discord.js").ActionRowBuilder)().addComponents(addUserBtn, removeUserBtn),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALATE
// ─────────────────────────────────────────────────────────────────────────────
async function handleEscalate(interaction) {
  if (staffOnly(interaction)) {
    return ephemeral(interaction, "❌  You do not have permission to do that.");
  }

  const ticket = ticketDb.getTicket(interaction.channel.id);
  if (!ticket) return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");

  const currentIdx = TYPE_ORDER.indexOf(ticket.type);
  if (currentIdx === -1 || currentIdx >= TYPE_ORDER.length - 1) {
    return ephemeral(interaction, "❌  This ticket is already at the highest tier.");
  }

  const newType    = TYPE_ORDER[currentIdx + 1];
  const newInfo    = TYPE_MAP[newType];
  const newCatId   = ticketCategories?.[newType];
  const guild      = interaction.guild;

  // Move channel to new category
  if (newCatId) {
    await interaction.channel.setParent(newCatId, { lockPermissions: false }).catch(() => {});
  }

  // Update permissions: remove old type roles, add new type roles
  const oldRoleIds = (ticketRoles?.[ticket.type] ?? []).filter(Boolean);
  const newRoleIds = (ticketRoles?.[newType]     ?? []).filter(Boolean);

  for (const roleId of oldRoleIds) {
    await interaction.channel.permissionOverwrites.delete(roleId).catch(() => {});
  }
  for (const roleId of newRoleIds) {
    await interaction.channel.permissionOverwrites.edit(roleId, {
      [PermissionFlagsBits.ViewChannel]:      true,
      [PermissionFlagsBits.SendMessages]:     true,
      [PermissionFlagsBits.ReadMessageHistory]: true,
      [PermissionFlagsBits.ManageMessages]:   true,
    }).catch(() => {});
  }

  // Save updated type
  const raw = await Ticket.findOne({ channelId: interaction.channel.id });
  if (raw) {
    raw.type = newType;
    await raw.save();
  }

  // Ping new staff
  const newRolePings = newRoleIds.map(id => `<@&${id}>`).join(" ") ||
    (roles[newType] ? `<@&${roles[newType]}>` : "");

  if (newRolePings) {
    await interaction.channel.send({ content: `${newRolePings} — This ticket has been escalated.` });
  }

  await ephemeral(interaction, `${emojis.check}  Ticket escalated to **${newInfo.label}**.`);

  await interaction.channel.send(
    buildContainer(
      [
        heading(`${emojis.up}  Ticket Escalated`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.dot}  This ticket has been escalated to **${newInfo.label}**.`),
        text(`${emojis.user}  **Escalated by** — ${interaction.user.tag}`),
      ],
      "primary",
      { noImages: true }
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RENAME
// ─────────────────────────────────────────────────────────────────────────────
async function handleRenamePrompt(interaction) {
  if (staffOnly(interaction)) {
    return ephemeral(interaction, "❌  You do not have permission to do that.");
  }

  const modal = new ModalBuilder()
    .setCustomId("sp_rename_modal")
    .setTitle("Rename Ticket Channel");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("new_name")
        .setLabel("New channel name")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("ticket-username-topic")
        .setMinLength(2)
        .setMaxLength(100)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

async function handleRenameSubmit(interaction) {
  const ticket = ticketDb.getTicket(interaction.channel.id);
  if (!ticket) return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");

  const rawName = interaction.fields.getTextInputValue("new_name");
  const safeName = rawName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 100);

  await interaction.channel.setName(safeName).catch(() => {});
  await ephemeral(interaction, `${emojis.check}  Channel renamed to **${safeName}**.`);

  await interaction.channel.send(
    buildContainer(
      [
        heading(`${emojis.note}  Channel Renamed`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.dot}  This channel has been renamed to **${safeName}**.`),
        text(`${emojis.user}  **Renamed by** — ${interaction.user.tag}`),
      ],
      "neutral",
      { noImages: true }
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE REQUEST  (24-hour timer, ticket opener must confirm)
// ─────────────────────────────────────────────────────────────────────────────
async function handleCloseRequest(interaction) {
  if (staffOnly(interaction)) {
    return ephemeral(interaction, "❌  You do not have permission to do that.");
  }

  const ticket = ticketDb.getTicket(interaction.channel.id);
  if (!ticket) return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");
  if (ticket.status === "closed") return ephemeral(interaction, "❌  This ticket is already closed.");

  // Only one close request at a time
  if (closeRequests.has(interaction.channel.id)) {
    return ephemeral(interaction, "❌  A close request is already active for this ticket.");
  }

  const expireAt  = Date.now() + CLOSE_TIMEOUT_MS;
  const expireTs  = Math.floor(expireAt / 1000);

  const confirmBtn = actionButton("Yes, Close",   "sp_close_confirm", ButtonStyle.Danger);
  const cancelBtn  = actionButton("Keep Open",    "sp_close_cancel",  ButtonStyle.Secondary);

  // Acknowledge staff ephemerally first so we can use channel.send
  await ephemeral(interaction, `${emojis.check}  Close request sent. The ticket opener has 24 hours to confirm.`);

  const msg = await interaction.channel.send(
    buildContainer(
      [
        heading(`${emojis.lock}  Close Request`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.dot}  <@${ticket.userId}>, **${interaction.user.tag}** has requested this ticket be closed.`),
        text(`${emojis.clock}  This ticket will **automatically close** <t:${expireTs}:R> if no action is taken.`),
        sep(false),
        text("-# Only the person who opened this ticket can confirm or cancel."),
        sep(false),
        row(confirmBtn, cancelBtn),
      ],
      "danger",
      { noImages: true }
    )
  );

  // Schedule auto-close
  const timer = setTimeout(async () => {
    closeRequests.delete(interaction.channel.id);

    const latestTicket = ticketDb.getTicket(interaction.channel.id);
    if (!latestTicket || latestTicket.status === "closed") return;

    await doClose(interaction.channel, interaction.guild, ticket, "Auto-closed — 24-hour close request expired");
  }, CLOSE_TIMEOUT_MS);

  closeRequests.set(interaction.channel.id, {
    timer,
    messageId: msg.id ?? null,
    expireAt,
    requestedBy: interaction.user.id,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE CONFIRM  (only ticket opener)
// ─────────────────────────────────────────────────────────────────────────────
async function handleCloseConfirm(interaction) {
  const ticket = ticketDb.getTicket(interaction.channel.id);
  if (!ticket) return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");

  // Only the ticket opener can confirm
  if (interaction.user.id !== ticket.userId) {
    return ephemeral(interaction, "❌  Only the person who opened this ticket can confirm the close.");
  }

  const req = closeRequests.get(interaction.channel.id);
  if (!req) {
    return ephemeral(interaction, "❌  There is no active close request for this ticket.");
  }

  // Cancel the auto-close timer
  clearTimeout(req.timer);
  closeRequests.delete(interaction.channel.id);

  await ephemeral(interaction, `${emojis.check}  Closing ticket…`);
  await doClose(interaction.channel, interaction.guild, ticket, "Ticket closed by opener");
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE CANCEL  (only ticket opener)
// ─────────────────────────────────────────────────────────────────────────────
async function handleCloseCancel(interaction) {
  const ticket = ticketDb.getTicket(interaction.channel.id);
  if (!ticket) return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");

  if (interaction.user.id !== ticket.userId) {
    return ephemeral(interaction, "❌  Only the person who opened this ticket can cancel the close request.");
  }

  const req = closeRequests.get(interaction.channel.id);
  if (!req) {
    return ephemeral(interaction, "❌  There is no active close request for this ticket.");
  }

  clearTimeout(req.timer);
  closeRequests.delete(interaction.channel.id);

  await ephemeral(interaction, `${emojis.check}  Close request cancelled. Your ticket remains open.`);

  await interaction.channel.send(
    buildContainer(
      [
        heading(`${emojis.unlock}  Close Request Cancelled`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.dot}  The close request has been cancelled by ${interaction.user}. This ticket remains open.`),
      ],
      "success",
      { noImages: true }
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD USER
// ─────────────────────────────────────────────────────────────────────────────
async function handleAddUserPrompt(interaction) {
  if (staffOnly(interaction)) {
    return ephemeral(interaction, "❌  You do not have permission to do that.");
  }

  const modal = new ModalBuilder()
    .setCustomId("sp_add_user_modal")
    .setTitle("Add User to Ticket");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("user_id")
        .setLabel("User ID")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("123456789012345678")
        .setMinLength(17)
        .setMaxLength(20)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

async function handleAddUserSubmit(interaction) {
  const ticket = ticketDb.getTicket(interaction.channel.id);
  if (!ticket) return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");

  const userId = interaction.fields.getTextInputValue("user_id").trim();
  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!member) {
    return ephemeral(interaction, "❌  Could not find a member with that ID.");
  }

  await interaction.channel.permissionOverwrites.edit(member.id, {
    [PermissionFlagsBits.ViewChannel]:        true,
    [PermissionFlagsBits.SendMessages]:       true,
    [PermissionFlagsBits.ReadMessageHistory]: true,
  });

  await ephemeral(interaction, `${emojis.check}  Added ${member.user.tag} to the ticket.`);

  await interaction.channel.send(
    buildContainer(
      [
        heading(`${emojis.member}  User Added`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.dot}  ${member.user} has been added to this ticket by ${interaction.user.tag}.`),
      ],
      "success",
      { noImages: true }
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE USER
// ─────────────────────────────────────────────────────────────────────────────
async function handleRemoveUserPrompt(interaction) {
  if (staffOnly(interaction)) {
    return ephemeral(interaction, "❌  You do not have permission to do that.");
  }

  const modal = new ModalBuilder()
    .setCustomId("sp_remove_user_modal")
    .setTitle("Remove User from Ticket");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("user_id")
        .setLabel("User ID")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("123456789012345678")
        .setMinLength(17)
        .setMaxLength(20)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

async function handleRemoveUserSubmit(interaction) {
  const ticket = ticketDb.getTicket(interaction.channel.id);
  if (!ticket) return ephemeral(interaction, "❌  This can only be used inside a ticket channel.");

  const userId = interaction.fields.getTextInputValue("user_id").trim();

  // Prevent removing the ticket opener
  if (userId === ticket.userId) {
    return ephemeral(interaction, "❌  You cannot remove the ticket opener from their own ticket.");
  }

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) {
    return ephemeral(interaction, "❌  Could not find a member with that ID.");
  }

  await interaction.channel.permissionOverwrites.delete(member.id).catch(() => {});

  await ephemeral(interaction, `${emojis.check}  Removed ${member.user.tag} from the ticket.`);

  await interaction.channel.send(
    buildContainer(
      [
        heading(`${emojis.member}  User Removed`, HeadingLevel.Two),
        sep(false),
        text(`${emojis.dot}  ${member.user} has been removed from this ticket by ${interaction.user.tag}.`),
      ],
      "neutral",
      { noImages: true }
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared close routine
// ─────────────────────────────────────────────────────────────────────────────
async function doClose(channel, guild, ticket, reason = "Ticket closed") {
  ticketDb.closeTicket(channel.id);

  const { channels } = require("../config");
  const { buildContainer: bc, heading: h, text: t, sep: s, HeadingLevel: HL } = require("../utils/container");
  const { emojis: em } = require("../config");

  const logCh = guild.channels.cache.get(channels.modLog);
  if (logCh) {
    const typeInfo = TYPE_MAP[ticket.type];
    await logCh.send(
      bc(
        [
          h(`${em.lock}  Ticket Closed`, HL.Two),
          s(false),
          t(`${em.case}  **Ticket** — #${ticket.ticketId}`),
          t(`${em.info}  **Type** — ${typeInfo?.label ?? ticket.type}`),
          t(`${em.user}  **Opened by** — <@${ticket.userId}>`),
          t(`${em.note}  **Reason** — ${reason}`),
          t(`${em.clock}  **Duration** — ${formatDuration(Date.now() - ticket.openedAt)}`),
        ],
        "neutral",
        { noImages: true }
      )
    );
  }

  await channel.send(
    bc(
      [
        h(`${em.lock}  Closing Ticket`, HL.Two),
        s(false),
        t(`${em.dot}  Ticket #${ticket.ticketId} is being closed.`),
        t("-# This channel will be deleted in 3 seconds."),
      ],
      "success",
      { noImages: true }
    )
  );

  setTimeout(async () => {
    await channel.delete(reason).catch(() => {});
    ticketDb.deleteTicket(channel.id);
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
