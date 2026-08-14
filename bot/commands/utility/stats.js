const { SlashCommandBuilder } = require("discord.js");
const { infoContainer } = require("../../utils/container");
const { emojis } = require("../../config");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View server moderation statistics"),

  async execute(interaction) {
    const infractions = require("../../utils/db");

    const allInf     = Object.values(require("fs").existsSync("./data/infractions.json")
      ? JSON.parse(require("fs").readFileSync("./data/infractions.json", "utf8"))
      : {}).flat();

    const allGBans   = Object.keys(db.getAllGlobalBans()).length;
    const warns      = allInf.filter(i => i.type === "WARN").length;
    const bans       = allInf.filter(i => i.type === "BAN").length;
    const kicks      = allInf.filter(i => i.type === "KICK").length;
    const mutes      = allInf.filter(i => i.type === "MUTE").length;
    const total      = allInf.length;

    await interaction.reply(
      infoContainer(
        `${emojis.stats}  Server Statistics`,
        [
          { label: "Total Actions", value: `${total}` },
          { label: "Warnings",      value: `${warns}` },
          { label: "Bans",          value: `${bans}` },
          { label: "Kicks",         value: `${kicks}` },
          { label: "Mutes",         value: `${mutes}` },
          { label: "Global Bans",   value: `${allGBans}` },
          { label: "Members",       value: `${interaction.guild.memberCount}` },
        ],
        [],
        [],
        "primary"
      )
    );
  },
};
