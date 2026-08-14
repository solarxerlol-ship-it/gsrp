/**
 * staff_panel.js
 * /staff-panel — Posts an ephemeral staff control panel inside a ticket channel.
 *
 * Actions:
 *   Escalate      — moves the ticket to the next tier (General → IA → Management)
 *   Rename        — renames the channel via a modal
 *   Close Request — sends a 24-hour countdown; the ticket opener must confirm,
 *                   otherwise it auto-closes when the timer expires
 *   Add User      — grants a member view access via modal
 *   Remove User   — removes a member's view access via modal
 */

const {
  SlashCommandBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonStyle,
  ChannelType,
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
} = require("../../utils/container");

const { guard, hasPermission } = require("../../utils/permissions");
const { emojis, ticketCategories, ticketRoles, roles } = require("../../config");
const ticketDb = require("../../utils/ticketDb");
const { TICKET_TYPES } = require("./setup_tickets");

const TYPE_MAP    = Object.fromEntries(TICKET_TYPES.map(t => [t.value, t]));
const TYPE_ORDER  = TICKET_TYPES.map(t => t.value); // escalation order

// ── In-memory close-request timers: channelId → { timer, messageId, expireAt } ──
const closeRequests = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("staff-panel")
    .setDescription("Open the staff control panel for this ticket"),

  closeRequests, // exported so ticketSelect.js can cancel on manual close

  async execute(interaction) {
    // Must be inside a ticket channel
    const ticket = ticketDb.getTicket(interaction.channel.id);
    if (!ticket) {
      return interaction.reply({
        content: "❌  This command can only be used inside a ticket channel.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (await guard(interaction, "staff")) return;

    const typeInfo = TYPE_MAP[ticket.type];

    const escalateBtn    = actionButton("Escalate Ticket",  "sp_escalate",      ButtonStyle.Primary);
    const renameBtn      = actionButton("Rename Ticket",    "sp_rename",        ButtonStyle.Secondary);
    const closeReqBtn    = actionButton("Request Close",    "sp_close_request", ButtonStyle.Danger);
    const addUserBtn     = actionButton("Add User",         "sp_add_user",      ButtonStyle.Secondary);
    const removeUserBtn  = actionButton("Remove User",      "sp_remove_user",   ButtonStyle.Secondary);

    const panel = buildContainer(
      [
        heading(`${emojis.shield}  Staff Panel`, HeadingLevel.Two),
        sep(true),

        heading(`${emojis.up}  Escalate`, HeadingLevel.Three),
        text("-# Move this ticket up to the next tier (General → IA → Management)."),
        sep(false),
        row(escalateBtn),
        sep(true),

        heading(`${emojis.note}  Rename`, HeadingLevel.Three),
        text("-# Rename the ticket channel."),
        sep(false),
        row(renameBtn),
        sep(true),

        heading(`${emojis.cross}  Close Request`, HeadingLevel.Three),
        text("-# Send a 24-hour close countdown. The ticket opener must confirm — auto-closes if they don't respond."),
        sep(false),
        row(closeReqBtn),
        sep(true),

        heading(`${emojis.member}  Add / Remove User`, HeadingLevel.Three),
        text("-# Add or remove a member from this ticket channel."),
        sep(false),
        row(addUserBtn, removeUserBtn),
      ],
      "primary",
      { noImages: true }
    );

    await interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
  },
};
