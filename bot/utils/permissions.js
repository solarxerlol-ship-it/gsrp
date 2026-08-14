const { errorContainer } = require("./container");
const { roles } = require("../config");

const HIERARCHY = ["staff", "moderator", "admin", "management"];

/**
 * Check if a member has at least the required tier.
 * @param {import("discord.js").GuildMember} member
 * @param {"staff"|"moderator"|"admin"|"management"} required
 */
function hasPermission(member, required) {
  if (member.permissions.has("Administrator")) return true;
  const idx = HIERARCHY.indexOf(required);
  for (let i = idx; i < HIERARCHY.length; i++) {
    const roleId = roles[HIERARCHY[i]];
    if (member.roles.cache.has(roleId)) return true;
  }
  return false;
}

/**
 * Guard helper — call at the top of a command handler.
 * Returns true and replies if permission denied.
 */
async function guard(interaction, required) {
  if (!hasPermission(interaction.member, required)) {
    await interaction.reply({
      ...errorContainer("Access Denied", "You do not have permission to use this command."),
      ephemeral: true,
    });
    return true; // denied
  }
  return false; // allowed
}

module.exports = { hasPermission, guard };
