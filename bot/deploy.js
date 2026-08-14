/**
 * deploy.js — Register slash commands with Discord
 * Run with: node deploy.js
 */

const { REST, Routes } = require("discord.js");
const fs   = require("fs");
const path = require("path");
const { token, clientId, guildId } = require("./config");

const commands = [];

function loadCommands(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(full);
    } else if (entry.name.endsWith(".js")) {
      const cmd = require(full);
      if (cmd?.data?.toJSON) {
        commands.push(cmd.data.toJSON());
      }
    }
  }
}

loadCommands(path.join(__dirname, "commands"));

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`[DEPLOY] Registering ${commands.length} commands to guild ${guildId}...`);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log("[DEPLOY] Done.");
  } catch (err) {
    console.error("[DEPLOY ERROR]", err);
  }
})();
