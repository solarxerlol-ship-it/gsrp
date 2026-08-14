const { Events } = require("discord.js");
const { infoContainer } = require("../utils/container");
const { channels, emojis } = require("../config");

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const logCh = member.guild.channels.cache.get(channels.modLog);
    if (!logCh) return;

    await logCh.send(
      infoContainer(
        `${emojis.offline}  Member Left`,
        [
          { label: "User",   value: member.user.tag },
          { label: "ID",     value: member.id },
          { label: "Joined", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown" },
          { label: "Roles",  value: `${member.roles.cache.size - 1}` },
        ],
        [],
        [],
        "neutral"
      )
    );
  },
};
