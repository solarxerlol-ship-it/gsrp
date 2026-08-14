const { Events } = require("discord.js");
const { infoContainer, warningContainer } = require("../utils/container");
const { roles, channels, emojis } = require("../config");
const db = require("../utils/db");

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    // ── Assign unverified role ─────────────────────────────────────────────
    // Only assign if ROLE_UNVERIFIED is actually set AND is not the same as
    // any staff/management role (safety guard against misconfiguration).
    const unverifiedId = roles.unverified;
    if (unverifiedId && unverifiedId !== roles.management && unverifiedId !== roles.admin) {
      const unverifiedRole = member.guild.roles.cache.get(unverifiedId);
      if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => {});
    }

    // ── Check global ban ───────────────────────────────────────────────────
    // MUST await — db.getGlobalBan is async. Without await, gban is a
    // Promise (always truthy) and every join would trigger a ban.
    const gban = await db.getGlobalBan(member.id);
    if (gban) {
      await member.ban({ reason: `Global ban: ${gban.reason}` }).catch(() => {});

      const logCh = member.guild.channels.cache.get(channels.globalBanLog);
      if (logCh) {
        await logCh.send(
          warningContainer(
            `${emojis.globe}  Global Ban Enforced`,
            `${member.user.tag} attempted to join but is globally banned.\n**Reason:** ${gban.reason}`
          )
        );
      }
      return;
    }

    // ── Log join ───────────────────────────────────────────────────────────
    const logCh = member.guild.channels.cache.get(channels.verifyLog);
    if (logCh) {
      await logCh.send(
        infoContainer(
          `${emojis.members}  Member Joined`,
          [
            { label: "User",    value: member.user.tag },
            { label: "ID",      value: member.id },
            { label: "Account", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` },
          ],
          [],
          [],
          "success"
        )
      );
    }
  },
};
