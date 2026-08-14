const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { guard } = require("../../utils/permissions");
const { buildContainer, heading, text, sep, HeadingLevel } = require("../../utils/container");
const { emojis } = require("../../config");

// ── Ticket types ──────────────────────────────────────────────────────────────
const TICKET_TYPES = [
  {
    value:       "general",
    label:       "General Support",
    description: "General questions, concerns, or non-urgent matters.",
    detail:      "This ticket is for general, non-urgent questions — for example, questions about roles, perks, or to speak with a member of our support team about a concern.",
    emoji:       emojis._c.shield,       // gshield
  },
  {
    value:       "internal_affairs",
    label:       "Internal Affairs",
    description: "Report misconduct or concerns involving staff members.",
    detail:      "This option is used to report misconduct or concerns involving staff members. All reports must include clear and valid evidence. Reports submitted without proof may be deemed invalid. Please remain professional and provide as much detail as possible.",
    emoji:       emojis._c.exclamation,  // gexclamation
  },
  {
    value:       "management",
    label:       "Management Support",
    description: "Serious matters requiring elevated review.",
    detail:      "This ticket is strictly for serious matters involving high-ranking members, leadership concerns, or sensitive issues that require elevated review. Please only use this option when necessary. Misuse may result in the ticket being closed without action.",
    emoji:       emojis._c.info,         // ginfo
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-tickets")
    .setDescription("Post the Georgia State Roleplay support desk panel")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Channel to post the panel in (defaults to current)")
    ),

  async execute(interaction) {
    if (await guard(interaction, "admin")) return;

    const target = interaction.options.getChannel("channel") ?? interaction.channel;

    // Section for each ticket type
    const typeLines = TICKET_TYPES.flatMap((t) => [
      sep(false),
      heading(t.label, HeadingLevel.Three),
      text(`-# ${t.detail}`),
    ]);

    // Select menu
    const select = new StringSelectMenuBuilder()
      .setCustomId("ticket_open_select")
      .setPlaceholder("Georgia State Roleplay Support Desk")
      .addOptions(
        TICKET_TYPES.map((t) =>
          new StringSelectMenuOptionBuilder()
            .setValue(t.value)
            .setLabel(t.label)
            .setDescription(t.description)
            .setEmoji(t.emoji)
        )
      );

    const selectRow = new ActionRowBuilder().addComponents(select);

    // tickets category → gets banner + footer from config.images.tickets
    const panel = buildContainer(
      [
        heading(`<:gtickets:1537509801838510102>  Georgia State Roleplay  —  Support Desk`, HeadingLevel.One),
        sep(true),
        text(
          `Welcome to **Georgia State Roleplay** support desk. Below are the types of tickets you can open. Misusing this support system will result in punishment — please do not ping any staff members when opening a ticket.`
        ),
        ...typeLines,
        sep(true),
        selectRow,
      ],
      "primary",
      { category: "tickets" }
    );

    await target.send(panel);
    await interaction.reply({ content: "Support desk panel posted.", flags: MessageFlags.Ephemeral });
  },
};

// Export so ticketSelect.js can use them
module.exports.TICKET_TYPES = TICKET_TYPES;
