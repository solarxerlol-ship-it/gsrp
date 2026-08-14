const { SlashCommandBuilder } = require("discord.js");
const { guard } = require("../../utils/permissions");
const { infoContainer, errorContainer, successContainer } = require("../../utils/container");
const { emojis, channels } = require("../../config");
const db = require("../../utils/db");

const DEPARTMENTS = ["LSPD", "LSFD", "EMS", "BCSO", "DOC", "SASP", "CIV"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("deptban")
    .setDescription("Issue or remove a department ban")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Ban a user from a department")
        .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
        .addStringOption(o =>
          o.setName("department").setDescription("Department").setRequired(true)
           .addChoices(...DEPARTMENTS.map(d => ({ name: d, value: d })))
        )
        .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
        .addStringOption(o => o.setName("evidence").setDescription("Evidence"))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Remove a department ban")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
        .addStringOption(o =>
          o.setName("department").setDescription("Department").setRequired(true)
           .addChoices(...DEPARTMENTS.map(d => ({ name: d, value: d })))
        )
        .addStringOption(o => o.setName("reason").setDescription("Reason for removal"))
    )
    .addSubcommand(sub =>
      sub.setName("view")
        .setDescription("View all department bans for a user")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    ),

  async execute(interaction) {
    if (await guard(interaction, "admin")) return;

    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getUser("user");

    if (sub === "add") {
      const dept     = interaction.options.getString("department");
      const reason   = interaction.options.getString("reason");
      const evidence = interaction.options.getString("evidence") ?? "None";

      db.addDeptBan(target.id, dept, { reason, evidence, issuer: interaction.user.id });

      const payload = infoContainer(
        `${emojis.department}  Department Ban Issued`,
        [
          { label: "User",       value: target.tag },
          { label: "Department", value: dept },
          { label: "Issued by",  value: interaction.user.tag },
        ],
        [`${emojis.reason}  **Reason** — ${reason}`, `${emojis.note}  **Evidence** — ${evidence}`],
        [],
        "danger"
      );

      await interaction.reply(payload);
      const logCh = interaction.guild.channels.cache.get(channels.globalBanLog);
      if (logCh) await logCh.send(payload);

    } else if (sub === "remove") {
      const dept   = interaction.options.getString("department");
      const reason = interaction.options.getString("reason") ?? "No reason provided";
      const ok     = db.removeDeptBan(target.id, dept);

      if (!ok) return interaction.reply({ ...errorContainer("Not Found", "No department ban found."), ephemeral: true });

      await interaction.reply(
        successContainer(`${emojis.check}  Department Ban Removed`, [
          `${emojis.department}  **Department** — ${dept}`,
          `${emojis.user}  **User** — ${target.tag}`,
          `${emojis.reason}  **Reason** — ${reason}`,
        ])
      );

    } else if (sub === "view") {
      const bans = db.getUserDeptBans(target.id);
      const entries = Object.entries(bans);

      if (!entries.length) {
        return interaction.reply(
          infoContainer(
            `${emojis.department}  Department Bans`,
            [{ label: "User", value: target.tag }, { label: "Active Bans", value: "0" }],
            [`${emojis.check}  No active department bans.`],
            [],
            "success"
          )
        );
      }

      const lines = entries.map(([dept, data]) => {
        const date = new Date(data.timestamp).toLocaleDateString();
        return `${emojis.dot}  **${dept}** — ${data.reason} *(${date})*`;
      });

      await interaction.reply(
        infoContainer(
          `${emojis.department}  Department Bans`,
          [
            { label: "User",        value: target.tag },
            { label: "Active Bans", value: `${entries.length}` },
          ],
          lines,
          [],
          "danger"
        )
      );
    }
  },
};
