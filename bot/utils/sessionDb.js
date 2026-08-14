/**
 * sessionDb.js — Mongoose model for active session state.
 */

require("./db");
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  guildId:   { type: String, unique: true },
  messageId: String,
  channelId: String,
  players:   { type: Number, default: 0 },
  maxPlayers:{ type: Number, default: 50 },
  queue:     { type: Number, default: 0 },
  staff:     { type: Number, default: 0 },
  link:      String,
  online:    { type: Boolean, default: false },
  full:      { type: Boolean, default: false },
  votes:     { type: [String], default: [] },
  voteMsgId: { type: String, default: null },
  voteChId:  { type: String, default: null },
  startedAt: Number,
});

module.exports = mongoose.models.Session || mongoose.model("Session", sessionSchema);
