/**
 * /ticket — staff management commands for tickets
 * Subcommands: add, remove, close, list, info
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");

const { guard } = require("../../utils/permissions");
const {
  infoContainer,
  successContainer,
  errorContainer,
  buildContainer,
  heading,
  text,
  sep,
  HeadingLevel,
} = require("../../utils/container");
const { emojis } = require("../../config");
const ticketDb = require("../../utils/ticketDb");
const { TICKET_TYPES } = require("./setup_tickets");

const TYPE_MAP = Object.fromEntries(TICKET_TYPES.map(t => [t.value, t]));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage support tickets")

    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Add a user to the current ticket")
        .addUserOption(o => o.setName("user").setDescription("User to add").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Remove a user from the current ticket")
        .addUserOption(o => o.setName("user").setDescription("User to remove").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("close")
        .setDescription("Force-close the current ticket channel")
        .addStringOption(o => o.setName("reason").setDescription("Reason for closing"))
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("List all open tickets")
    )
    .addSubcommand(sub =>
      sub.setName("info")
        .setDescription("View info for the current ticket channel")
    )
    .addSubcommand(sub =>
      sub.setName("rename")
        .setDescription("Rename the current ticket channel")
        .addStringOption(o => o.setName("name").setDescription("New channel name").setRequired(true))
    ),

  async execute(interaction) {
    if (await guard(interaction, "staff")) return;

    const sub = interaction.options.getSubcommand();

    // ── add ───────────────────────────────────────────────────────────────────
    if (sub === "add") {
      const ticket = ticketDb.getTicket(interaction.channel.id);
      if (!ticket) return notTicket(interaction);

      const target = interaction.options.getUser("user");
      await interaction.channel.permissionOverwrites.edit(target.id, {
        ViewChannel:        true,
        SendMessages:       true,
        ReadMessageHistory: true,
      });

      return interaction.reply(
        successContainer(`${emojis.check}  User Added`, [
          `${emojis.user}  ${target} has been added to this ticket.`,
        ])
      );
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === "remove") {
      const ticket = ticketDb.getTicket(interaction.channel.id);
      if (!ticket) return notTicket(interaction);

      const target = interaction.options.getUser("user");
      if (target.id === ticket.userId) {
        return interaction.reply({
          ...errorContainer("Cannot Remove", "You cannot remove the ticket owner."),
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: false,
      });

      return interaction.reply(
        successContainer(`${emojis.cross}  User Removed`, [
          `${emojis.user}  ${target} has been removed from this ticket.`,
        ])
      );
    }

    // ── close ─────────────────────────────────────────────────────────────────
    if (sub === "close") {
      const ticket = ticketDb.getTicket(interaction.channel.id);
      if (!ticket) return notTicket(interaction);

      const reason = interaction.options.getString("reason") ?? "Closed by staff";
      ticketDb.closeTicket(interaction.channel.id);

      await interaction.reply(
        successContainer(`${emojis.lock}  Ticket Closed`, [
          `${emojis.reason}  **Reason** — ${reason}`,
          `${emojis.dot}  **Closed by** — ${interaction.user.tag}`,
          `-# This channel will be deleted in 5 seconds.`,
        ])
      );

      setTimeout(async () => {
        await interaction.channel.delete("Staff closed ticket").catch(() => {});
        ticketDb.deleteTicket(interaction.channel.id);
      }, 5000);
      return;
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === "list") {
      const open = ticketDb.getOpenTickets();

      if (!open.length) {
        return interaction.reply(
          infoContainer(
            `${emojis.shield}  Open Tickets`,
            [{ label: "Open", value: "0" }],
            [`${emojis.check}  No open tickets.`],
            [],
            "success"
          )
        );
      }

      const lines = open.slice(0, 20).map(t => {
        const typeInfo = TYPE_MAP[t.type];
        const since    = `<t:${Math.floor(t.openedAt / 1000)}:R>`;
        const claimed  = t.claimedBy ? `<@${t.claimedBy}>` : "Unclaimed";
        return `${emojis.dot}  **#${t.ticketId}** — ${typeInfo?.label ?? t.type} — <@${t.userId}> — ${since} — ${claimed}`;
      });

      return interaction.reply(
        infoContainer(
          `${emojis.shield}  Open Tickets`,
          [
            { label: "Open",      value: `${open.length}` },
            { label: "Unclaimed", value: `${open.filter(t => !t.claimedBy).length}` },
          ],
          lines,
          [],
          "primary"
        )
      );
    }

    // ── info ──────────────────────────────────────────────────────────────────
    if (sub === "info") {
      const ticket = ticketDb.getTicket(interaction.channel.id);
      if (!ticket) return notTicket(interaction);

      const typeInfo = TYPE_MAP[ticket.type];

      return interaction.reply(
        infoContainer(
          `${emojis.shield}  Ticket Information`,
          [
            { label: "Ticket",    value: `#${ticket.ticketId}` },
            { label: "Type",      value: typeInfo?.label ?? ticket.type },
            { label: "Opened by", value: `<@${ticket.userId}>` },
            { label: "Claimed",   value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed" },
            { label: "Status",    value: ticket.status.toUpperCase() },
            { label: "Opened",    value: `<t:${Math.floor(ticket.openedAt / 1000)}:R>` },
          ],
          [],
          [],
          "primary"
        )
      );
    }

    // ── rename ────────────────────────────────────────────────────────────────
    if (sub === "rename") {
      const ticket = ticketDb.getTicket(interaction.channel.id);
      if (!ticket) return notTicket(interaction);

      const name = interaction.options.getString("name")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .slice(0, 100);

      await interaction.channel.setName(name);

      return interaction.reply(
        successContainer(`${emojis.check}  Channel Renamed`, [
          `${emojis.dot}  This ticket has been renamed to **${name}**.`,
        ])
      );
    }
  },
};

function notTicket(interaction) {
  return interaction.reply({
    ...errorContainer("Not a Ticket", "This command can only be used inside a ticket channel."),
    flags: MessageFlags.Ephemeral,
  });
}
