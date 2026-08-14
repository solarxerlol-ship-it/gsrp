require("dotenv").config();

module.exports = {
  token:    process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID    || "1537508635259961434",
  guildId:  process.env.GUILD_ID     || "1530375780012658918",

  colors: {
    primary:  0x5865F2,
    success:  0x57F287,
    danger:   0xED4245,
    warning:  0xFEE75C,
    neutral:  0x2B2D31,
    purple:   0x9B59B6,
  },

  // ── Banner / footer images ─────────────────────────────────────────────────
  // All URLs live in .env so they survive git pushes and restarts.
  // Use permanent hosts (imgur, etc.) — Discord CDN attachment links expire.
  images: {
    sessions: {
      banner: process.env.IMG_SESSIONS_BANNER,
      footer: process.env.IMG_SESSIONS_FOOTER,
    },
    verification: {
      banner: process.env.IMG_VERIFY_BANNER,
      footer: process.env.IMG_VERIFY_FOOTER,
    },
    tickets: {
      banner: process.env.IMG_TICKETS_BANNER,
      footer: process.env.IMG_TICKETS_FOOTER,
    },
    infractions: {
      banner: process.env.IMG_INFRACTIONS_BANNER,
      footer: process.env.IMG_INFRACTIONS_FOOTER,
    },
    promotions: {
      banner: process.env.IMG_PROMOTIONS_BANNER,
      footer: process.env.IMG_PROMOTIONS_FOOTER,
    },
  },

  // ── Custom Emojis ──────────────────────────────────────────────────────────
  // Text format  →  used inside message/container text fields
  // _c format    →  used in component emoji props (select menus, buttons)
  emojis: {
    tickets:     "<:gtickets:1537509801838510102>",
    glock:       "<:gglock:1537509622880014357>",
    ulock:       "<:gulock:1537509552902115358>",
    send:        "<:gsend:1537509801838510102>",
    shield:      "<:gshield:1537509436581748896>",
    member:      "<:gmember:1537509356801757295>",
    info:        "<:ginfo:1537509320932196504>",
    up:          "<:gup:1537509274748723360>",
    exclamation: "<:gexclamation:1537509209489547375>",
    arrow:       "<:garrow:1537509113867534517>",
    folder:      "<:gfolder:1537509054606483606>",
    clock:       "<:gclock:1537509020234162206>",
    link:        "<:glink:1537508980564430982>",
    wifi:        "<:gwifi:1537508941070733462>",

    // ── Aliases used across the bot ────────────────────────────────────────
    check:       "<:gshield:1537509436581748896>",      // success / verified
    cross:       "<:gexclamation:1537509209489547375>",  // error / removed
    dot:         "<:garrow:1537509113867534517>",        // bullet point
    note:        "<:ginfo:1537509320932196504>",         // info / detail
    reason:      "<:ginfo:1537509320932196504>",         // reason field
    user:        "<:gmember:1537509356801757295>",       // user field
    members:     "<:gmember:1537509356801757295>",       // member count
    case:        "<:gfolder:1537509054606483606>",       // ticket/case number
    calendar:    "<:gclock:1537509020234162206>",        // date/time
    lock:        "<:gglock:1537509622880014357>",        // lock / close
    unlock:      "<:gulock:1537509552902115358>",        // unlock
    verify:      "<:gshield:1537509436581748896>",       // verification
    globe:       "<:gwifi:1537508941070733462>",         // global / network
    automod:     "<:gexclamation:1537509209489547375>",  // automod warning
    online:      "🟢",                                   // online status
    offline:     "🔴",                                   // offline status
    idle:        "🟡",                                   // idle status
    ping:        "<:ginfo:1537509320932196504>",         // ping/latency
    uptime:      "<:gclock:1537509020234162206>",        // uptime
    stats:       "<:gfolder:1537509054606483606>",       // statistics
    server:      "<:gwifi:1537508941070733462>",         // server info
    promote:     "<:gup:1537509274748723360>",           // promote
    demote:      "<:gexclamation:1537509209489547375>",  // demote
    transfer:    "<:garrow:1537509113867534517>",        // transfer
    robux:       "<:rbx:1537554866082152558>",           // economy currency

    _c: {
      tickets:     { id: "1537509801838510102", name: "gtickets"     },
      glock:       { id: "1537509622880014357", name: "gglock"       },
      ulock:       { id: "1537509552902115358", name: "gulock"       },
      send:        { id: "1537509801838510102", name: "gsend"        },
      shield:      { id: "1537509436581748896", name: "gshield"      },
      member:      { id: "1537509356801757295", name: "gmember"      },
      info:        { id: "1537509320932196504", name: "ginfo"        },
      up:          { id: "1537509274748723360", name: "gup"          },
      exclamation: { id: "1537509209489547375", name: "gexclamation" },
      arrow:       { id: "1537509113867534517", name: "garrow"       },
      folder:      { id: "1537509054606483606", name: "gfolder"      },
      clock:       { id: "1537509020234162206", name: "gclock"       },
      link:        { id: "1537508980564430982", name: "glink"        },
      wifi:        { id: "1537508941070733462", name: "gwifi"        },
    },
  },

  // ── Melonly verification ───────────────────────────────────────────────────
  melonly: {
    apiKey:  process.env.MELONLY_API_KEY,
    groupId: process.env.MELONLY_GROUP_ID,
  },

  // ── Ticket category IDs ────────────────────────────────────────────────────
  // Set these in .env — they persist across restarts and git pulls.
  ticketCategories: {
    general:          process.env.TICKET_CAT_GENERAL,
    internal_affairs: process.env.TICKET_CAT_IA,
    management:       process.env.TICKET_CAT_MANAGEMENT,
  },

  // ── Ticket role permissions ────────────────────────────────────────────────
  ticketRoles: {
    general:          [process.env.TICKET_ROLE_GENERAL],
    internal_affairs: [process.env.TICKET_ROLE_IA],
    management:       [process.env.TICKET_ROLE_MANAGEMENT],
  },

  // ── Channels ──────────────────────────────────────────────────────────────
  channels: {
    modLog:        process.env.CHANNEL_MOD_LOG,
    infractionLog: process.env.CHANNEL_INFRACTION_LOG || "1518629346963620011",
    promotionLog:  process.env.CHANNEL_PROMOTION_LOG,
    verifyLog:     process.env.CHANNEL_VERIFY_LOG,
    automodLog:    process.env.CHANNEL_AUTOMOD_LOG,
    globalBanLog:  process.env.CHANNEL_GLOBAL_BAN_LOG,
    auditLog:      process.env.CHANNEL_AUDIT_LOG,
    verifyChannel: process.env.CHANNEL_VERIFY,
    sessionStatus: process.env.CHANNEL_SESSION_STATUS,
  },

  // ── Roles ─────────────────────────────────────────────────────────────────
  roles: {
    verified:   process.env.ROLE_VERIFIED,
    unverified: process.env.ROLE_UNVERIFIED,
    muted:      process.env.ROLE_MUTED,
    moderator:  process.env.ROLE_MODERATOR,
    admin:      process.env.ROLE_ADMIN,
    management: process.env.ROLE_MANAGEMENT,
    staff:      process.env.ROLE_STAFF,
    sessionPing: process.env.ROLE_SESSION_PING,
  },

  automod: {
    maxMentions:    5,
    maxDuplicates:  4,
    capsThreshold:  0.70,
    spamInterval:   5000,
    spamLimit:      5,
    invitePattern:  /discord\.gg\/[a-zA-Z0-9]+/gi,
    linkPattern:    /https?:\/\/[^\s]+/gi,
    bannedWords:    ["badword1", "badword2"],
  },

  // ── Economy ───────────────────────────────────────────────────────────────
  economy: {
    prefix:         "-",
    currencySymbol: "<:rbx:1537554866082152558>",
    currencyName:   "Robux",
    dailyCooldown:  24 * 60 * 60 * 1000,
    ownerId:        process.env.OWNER_ID,
  },
};
