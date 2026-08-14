const { SlashCommandBuilder } = require("discord.js");
const { infoContainer } = require("../../utils/container");
const { emojis } = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View detailed information about the server"),

  async execute(interaction) {
    const guild   = interaction.guild;
    await guild.fetch();

    const createdAt  = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;
    const members    = guild.memberCount;
    const channels   = guild.channels.cache.size;
    const roles      = guild.roles.cache.size;
    const boosts     = guild.premiumSubscriptionCount ?? 0;
    const boostTier  = `Tier ${guild.premiumTier}`;
    const owner      = `<@${guild.ownerId}>`;
    const verLvl     = guild.verificationLevel;

    await interaction.reply(
      infoContainer(
        `${emojis.server}  Server Information`,
        [
          { label: "Server",      value: guild.name },
          { label: "ID",          value: guild.id },
          { label: "Created",     value: createdAt },
          { label: "Members",     value: `${members}` },
          { label: "Channels",    value: `${channels}` },
          { label: "Roles",       value: `${roles}` },
          { label: "Boosts",      value: `${boosts}` },
          { label: "Boost Tier",  value: boostTier },
          { label: "Owner",       value: owner },
          { label: "Verify Lvl",  value: `${verLvl}` },
        ],
        [],
        [],
        "primary"
      )
    );
  },
};
