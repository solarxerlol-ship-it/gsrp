const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { successContainer, errorContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Add or remove a role from a member")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Add a role to a member")
        .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
        .addRoleOption(o => o.setName("role").setDescription("Role to add").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason"))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Remove a role from a member")
        .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
        .addRoleOption(o => o.setName("role").setDescription("Role to remove").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason"))
    ),

  async execute(interaction) {
    if (await guard(interaction, "admin")) return;

    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getUser("user");
    const role   = interaction.options.getRole("role");
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) return interaction.reply({ ...errorContainer("Not Found", "User not in server."), ephemeral: true });

    if (sub === "add") {
      await member.roles.add(role, reason);
      await interaction.reply(
        successContainer(`${emojis.roles}  Role Added`, [
          `${emojis.user}  **Member** — ${target.tag}`,
          `${emojis.dot}  **Role** — ${role.name}`,
          `${emojis.reason}  **Reason** — ${reason}`,
        ])
      );
    } else {
      await member.roles.remove(role, reason);
      await interaction.reply(
        successContainer(`${emojis.roles}  Role Removed`, [
          `${emojis.user}  **Member** — ${target.tag}`,
          `${emojis.dot}  **Role** — ${role.name}`,
          `${emojis.reason}  **Reason** — ${reason}`,
        ])
      );
    }

    const logCh = interaction.guild.channels.cache.get(channels.auditLog);
    if (logCh) {
      const payload = successContainer(`${emojis.roles}  Role ${sub === "add" ? "Added" : "Removed"}`, [
        `${emojis.user}  **Member** — ${target.tag}`,
        `${emojis.dot}  **Role** — ${role.name}`,
        `${emojis.reason}  **Reason** — ${reason}`,
        `${emojis.dot}  **Executor** — ${interaction.user.tag}`,
      ]);
      await logCh.send(payload);
    }
  },
};
