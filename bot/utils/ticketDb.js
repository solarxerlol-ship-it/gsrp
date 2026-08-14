/**
 * ticketDb.js — MongoDB ticket persistence via Mongoose.
 * Mongoose connection is shared from db.js (connected on require).
 */

require("./db"); // ensure mongoose is connected
const mongoose = require("mongoose");

// ── Schema ────────────────────────────────────────────────────────────────────

const ticketSchema = new mongoose.Schema({
  ticketId:  { type: Number, unique: true },
  userId:    String,
  type:      String,
  channelId: { type: String, unique: true },
  guildId:   String,
  status:    { type: String, default: "open" },
  claimedBy: { type: String, default: null },
  openedAt:  { type: Number, default: () => Date.now() },
  closedAt:  { type: Number, default: null },
});

const Ticket  = mongoose.models.Ticket  || mongoose.model("Ticket",  ticketSchema);

const counterSchema = new mongoose.Schema({
  _id:   { type: String, default: "tickets" },
  value: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function nextTicketId() {
  const doc = await Counter.findByIdAndUpdate(
    "tickets",
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );
  return doc.value;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function createTicket({ userId, type, channelId, guildId }) {
  const ticketId = await nextTicketId();
  const ticket = await Ticket.create({ ticketId, userId, type, channelId, guildId });
  return ticket.toObject();
}

async function getTicket(channelId) {
  return Ticket.findOne({ channelId }).lean();
}

async function getTicketById(ticketId) {
  return Ticket.findOne({ ticketId }).lean();
}

async function getUserOpenTicket(userId, type) {
  return Ticket.findOne({ userId, type, status: "open" }).lean();
}

async function claimTicket(channelId, staffId) {
  const res = await Ticket.updateOne({ channelId }, { claimedBy: staffId });
  return res.modifiedCount > 0;
}

async function closeTicket(channelId) {
  const res = await Ticket.updateOne({ channelId }, { status: "closed", closedAt: Date.now() });
  return res.modifiedCount > 0;
}

async function deleteTicket(channelId) {
  await Ticket.deleteOne({ channelId });
}

async function getOpenTickets() {
  return Ticket.find({ status: "open" }).lean();
}

async function getAllTickets() {
  return Ticket.find().lean();
}

module.exports = {
  createTicket,
  getTicket,
  getTicketById,
  getUserOpenTicket,
  claimTicket,
  closeTicket,
  deleteTicket,
  getOpenTickets,
  getAllTickets,
};
