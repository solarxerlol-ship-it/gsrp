/**
 * erlc.js — ERLC API v2 helper.
 * Base: https://api.erlc.gg/v2
 * Auth: server-key header
 */

const https = require("https");

const BASE = "api.erlc.gg";

function request(path) {
  return new Promise((resolve, reject) => {
    const key = process.env.ERLC_SERVER_KEY;

    if (!key || key === "YOUR_ERLC_SERVER_KEY") {
      return reject(new Error("ERLC_SERVER_KEY not configured"));
    }

    const options = {
      hostname: BASE,
      path:     `/v2${path}`,
      method:   "GET",
      headers:  { "server-key": key },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON from ERLC API")); }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function getServer() {
  return request("/server");
}

async function getPlayers() {
  return request("/server/players");
}

module.exports = { getServer, getPlayers };
