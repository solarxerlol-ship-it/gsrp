const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { buildContainer, heading, sep, text, HeadingLevel, replyError } = require("../../utils/container");
const { emojis, channels, roles } = require("../../config");
const db = require("../../utils/db");
const ms = require("ms");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute a member (role-based)")
    .addUserOption(o => o.setName("user").setDescription("User to mute").setRequired(true))
    .addStringOption(o => o.setName("duration").setDescription("Duration e.g. 10m, 1h, 1d").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for mute")),

  async execute(interaction) {
    if (await guard(interaction, "moderator")) return;

    const target   = interaction.options.getUser("user");
    const rawDur   = interaction.options.getString("duration");
    const reason   = interaction.options.getString("reason") ?? "No reason provided";
    const member   = await interaction.guild.members.fetch(target.id).catch(() => null);
    const duration = ms(rawDur);

    if (!member)   return replyError(interaction, "Not Found", "User not in server.");
    if (!duration) return replyError(interaction, "Invalid Duration", `Could not parse \`${rawDur}\`.`);

    const muteRole = interaction.guild.roles.cache.get(roles.muted);
    if (!muteRole) return replyError(interaction, "Setup Error", "Muted role not configured.");

    await interaction.deferReply({ ephemeral: true });
    await member.roles.add(muteRole, reason);

    db.setMute(target.id, { moderator: interaction.user.id, reason, expiresAt: Date.now() + duration });

    const infraction = db.addInfraction(target.id, { type: "MUTE", reason, duration: rawDur, moderator: interaction.user.id, guild: interaction.guild.id });

    setTimeout(async () => {
      const fresh = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (fresh) { await fresh.roles.remove(muteRole, "Mute expired").catch(() => {}); db.removeMute(target.id); }
    }, duration);

    const payload = buildContainer([
      heading(`${emojis.glock}  Member Muted`, HeadingLevel.Two),
      sep(false),
      text(`${emojis.user}  **User** — ${target.tag}`),
      text(`${emojis.clock}  **Duration** — ${rawDur}`),
      text(`${emojis.folder}  **Case** — #${infraction.caseId}`),
      text(`${emojis.member}  **Moderator** — ${interaction.user.tag}`),
      text(`${emojis.reason}  **Reason** — ${reason}`),
    ], "warning", { noImages: true });

    const logCh = interaction.guild.channels.cache.get(channels.modLog);
    if (logCh) await logCh.send(payload);
    await interaction.editReply({ content: `${emojis.check}  **${target.tag}** has been muted for ${rawDur}.` });
  },
};
