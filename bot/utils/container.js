/**
 * container.js
 * Builds Discord Components v2 container-style messages.
 * No embeds — containers only.
 *
 * Banners (top image + bottom footer) are shown ONLY for:
 *   sessions, verification, tickets, infractions, promotions
 *
 * Everything else (moderation, management, utility, errors, warnings)
 * is a clean container with no images.
 */

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  HeadingLevel,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require("discord.js");

const { colors, images: CFG_IMAGES } = require("../config");

// ── Categories that get banner + footer images ────────────────────────────────
const BANNER_CATEGORIES = new Set([
  "sessions",
  "verification",
  "tickets",
  "infractions",
  "promotions",
]);

// ── Accent colour map ─────────────────────────────────────────────────────────
const ACCENT = {
  primary: colors.primary,
  success: colors.success,
  danger:  colors.danger,
  warning: colors.warning,
  neutral: colors.neutral,
  purple:  colors.purple,
};

// ── Resolve images for a category ────────────────────────────────────────────
function getImages(category = "default") {
  const cat = CFG_IMAGES?.[category] ?? {};
  const def = CFG_IMAGES?.default   ?? {};
  return {
    banner: cat.banner ?? def.banner ?? "https://i.imgur.com/REPLACE.png",
    footer: cat.footer ?? def.footer ?? "https://i.imgur.com/REPLACE.png",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

function sep(large = false) {
  return new SeparatorBuilder()
    .setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small)
    .setDivider(true);
}

function heading(content, level = HeadingLevel.Two) {
  const prefix = level === HeadingLevel.One ? "#" : level === HeadingLevel.Three ? "###" : "##";
  return new TextDisplayBuilder().setContent(`${prefix} ${content}`);
}

function text(content) {
  return new TextDisplayBuilder().setContent(content);
}

/** Disabled stat-display button */
function statButton(label, value) {
  return new ButtonBuilder()
    .setCustomId(`stat_${label}_${Date.now()}_${Math.random()}`)
    .setLabel(`${label}:  ${value}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
}

function actionButton(label, customId, style = ButtonStyle.Primary, emoji = null) {
  const b = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  return b;
}

function linkButton(label, url, emoji = null) {
  const b = new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url);
  if (emoji) b.setEmoji(emoji);
  return b;
}

function row(...buttons) {
  return new ActionRowBuilder().addComponents(...buttons);
}

function mediaImage(url) {
  return new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(url)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Core builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {import("discord.js").ComponentBuilder[]} components
 * @param {"primary"|"success"|"danger"|"warning"|"neutral"|"purple"} accent
 * @param {object}  [opts]
 * @param {string}  [opts.category]      — if in BANNER_CATEGORIES, images are added
 * @param {boolean} [opts.forceImages]   — override: always show images
 * @param {boolean} [opts.noImages]      — override: never show images
 * @param {string}  [opts.bannerUrl]     — direct URL override
 * @param {string}  [opts.footerUrl]     — direct URL override
 */
function buildContainer(components, accent = "primary", opts = {}) {
  const { category, forceImages, noImages, bannerUrl, footerUrl } = opts;

  const showImages = noImages
    ? false
    : forceImages
      ? true
      : BANNER_CATEGORIES.has(category);

  const imgs   = showImages ? getImages(category) : null;
  const banner = bannerUrl ?? imgs?.banner;
  const footer = footerUrl ?? imgs?.footer;

  const all = [];

  if (showImages && banner) {
    all.push(mediaImage(banner));
    all.push(sep(false));
  }

  all.push(...components);

  if (showImages && footer) {
    all.push(sep(false));
    all.push(mediaImage(footer));
  }

  const container = new ContainerBuilder()
    .setAccentColor(ACCENT[accent] ?? ACCENT.primary);

  for (const part of all) {
    if (part instanceof ActionRowBuilder) {
      container.addActionRowComponents(part);
    } else if (part instanceof SeparatorBuilder) {
      container.addSeparatorComponents(part);
    } else if (part instanceof TextDisplayBuilder) {
      container.addTextDisplayComponents(part);
    } else if (part instanceof MediaGalleryBuilder) {
      container.addMediaGalleryComponents(part);
    } else {
      throw new TypeError(`Unsupported container component type: ${part?.constructor?.name ?? typeof part}`);
    }
  }

  return {
    flags:      MessageFlags.IsComponentsV2,
    components: [container],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Success — no images (used for mod actions, management, utility)
 */
function successContainer(title, lines = []) {
  return buildContainer(
    [
      heading(title, HeadingLevel.Two),
      sep(false),
      ...lines.map((l) => text(l)),
    ],
    "success",
    { noImages: true }
  );
}

/**
 * Error — no images, tight
 */
function errorContainer(title, description = "") {
  return buildContainer(
    [
      heading(title, HeadingLevel.Two),
      ...(description ? [sep(false), text(description)] : []),
    ],
    "danger",
    { noImages: true }
  );
}

/**
 * Warning — no images (automod notices, etc.)
 */
function warningContainer(title, description = "") {
  return buildContainer(
    [
      heading(title, HeadingLevel.Two),
      ...(description ? [sep(false), text(description)] : []),
    ],
    "warning",
    { noImages: true }
  );
}

/**
 * Info container with stat buttons.
 * Pass category = "infractions" | "promotions" | "tickets" | "verification" | "sessions"
 * to get the banner, otherwise no images.
 *
 * @param {string} title
 * @param {{ label: string, value: string }[]} stats
 * @param {string[]} extraLines
 * @param {import("discord.js").ButtonBuilder[][]} buttonRows
 * @param {"primary"|"success"|"danger"|"warning"|"neutral"|"purple"} accent
 * @param {string} [category]
 */
function infoContainer(
  title,
  stats      = [],
  extraLines = [],
  buttonRows = [],
  accent     = "primary",
  category   = null
) {
  const inner = [heading(title, HeadingLevel.Two), sep(true)];

  if (extraLines.length) {
    extraLines.forEach((l) => inner.push(text(l)));
    if (stats.length) inner.push(sep(false));
  }

  if (stats.length) {
    for (let i = 0; i < stats.length; i += 4) {
      const chunk = stats.slice(i, i + 4);
      inner.push(row(...chunk.map((s) => statButton(s.label, s.value))));
    }
  }

  if (buttonRows.length) {
    inner.push(sep(false));
    buttonRows.forEach((r) => inner.push(row(...r)));
  }

  return buildContainer(inner, accent, { category });
}

// ─────────────────────────────────────────────────────────────────────────────
// Interaction-safe helpers
// Containers (type 17) cannot go in interaction replies — use these instead.
// They send a plain ephemeral text reply, then optionally send a container to
// the channel for visible feedback.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a plain ephemeral error reply to an interaction.
 * Safe for ALL interaction types (reply, editReply, followUp).
 */
async function replyError(interaction, title, description = "") {
  const content = description ? `❌  **${title}** — ${description}` : `❌  **${title}**`;
  const method  = interaction.deferred || interaction.replied ? "editReply" : "reply";
  return interaction[method]({ content, flags: MessageFlags.Ephemeral });
}

/**
 * Send a plain ephemeral success reply to an interaction.
 */
async function replySuccess(interaction, title, description = "") {
  const content = description ? `✅  **${title}** — ${description}` : `✅  **${title}**`;
  const method  = interaction.deferred || interaction.replied ? "editReply" : "reply";
  return interaction[method]({ content, flags: MessageFlags.Ephemeral });
}

/**
 * Defer + send a container to the channel, then acknowledge ephemerally.
 * Use this when you want the container visible in the channel (not ephemeral).
 */
async function sendContainer(interaction, containerPayload, ackMessage = "\u200b") {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
  await interaction.channel.send(containerPayload);
  return interaction.editReply({ content: ackMessage });
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  buildContainer,
  sep,
  heading,
  text,
  statButton,
  actionButton,
  linkButton,
  row,
  mediaImage,
  getImages,
  successContainer,
  errorContainer,
  warningContainer,
  infoContainer,
  replyError,
  replySuccess,
  sendContainer,
  HeadingLevel,
  ButtonStyle,
};
