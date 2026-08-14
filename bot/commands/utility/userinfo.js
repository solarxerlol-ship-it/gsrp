const { SlashCommandBuilder } = require("discord.js");
const { infoContainer } = require("../../utils/container");
const { emojis } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View detailed information about a user")
    .addUserOption(o => o.setName("user").setDescription("User to inspect (defaults to you)")),

  async execute(interaction) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const joinedAt   = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown";
    const createdAt  = `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`;
    const roles      = member ? member.roles.cache.filter(r => r.id !== interaction.guild.id).size : 0;
    const infractions= db.getInfractions(target.id).length;
    const globalBan  = db.getGlobalBan(target.id) ? `${emojis.cross} Yes` : `${emojis.check} No`;
    const deptBans   = Object.keys(db.getUserDeptBans(target.id)).length;

    await interaction.reply(
      infoContainer(
        `${emojis.user}  User Information`,
        [
          { label: "Tag",         value: target.tag },
          { label: "ID",          value: target.id },
          { label: "Joined",      value: joinedAt },
          { label: "Created",     value: createdAt },
          { label: "Roles",       value: `${roles}` },
          { label: "Infractions", value: `${infractions}` },
          { label: "Global Ban",  value: globalBan },
          { label: "Dept Bans",   value: `${deptBans}` },
        ],
        [],
        [],
        "primary"
      )
    );
  },
};
