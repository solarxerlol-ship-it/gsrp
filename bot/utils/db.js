/**
 * db.js — MongoDB persistence layer via Mongoose.
 */

const mongoose = require("mongoose");

// ── Connect ───────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("[DB] Connected to MongoDB"))
  .catch(err => console.error("[DB] Connection error:", err));

// ── Schemas ───────────────────────────────────────────────────────────────────

const infractionSchema = new mongoose.Schema({
  userId:      String,
  caseId:      Number,
  type:        String,
  reason:      String,
  description: String,
  moderator:   String,
  guild:       String,
  timestamp:   { type: Number, default: () => Date.now() },
});

const globalBanSchema = new mongoose.Schema({
  userId:    { type: String, unique: true },
  reason:    String,
  moderator: String,
  timestamp: { type: Number, default: () => Date.now() },
});

const deptBanSchema = new mongoose.Schema({
  userId:    String,
  dept:      String,
  reason:    String,
  moderator: String,
  timestamp: { type: Number, default: () => Date.now() },
});

const muteSchema = new mongoose.Schema({
  userId:    { type: String, unique: true },
  expiresAt: Number,
  reason:    String,
  moderator: String,
});

const verificationSchema = new mongoose.Schema({
  userId:    { type: String, unique: true },
  robloxId:  String,
  username:  String,
  timestamp: { type: Number, default: () => Date.now() },
});

const automodSchema = new mongoose.Schema({
  _id:             { type: String, default: "settings" },
  enabled:         { type: Boolean, default: true },
  antiSpam:        { type: Boolean, default: true },
  antiLinks:       { type: Boolean, default: true },
  antiInvites:     { type: Boolean, default: true },
  antiCaps:        { type: Boolean, default: true },
  antiMassMention: { type: Boolean, default: true },
  antiDuplicates:  { type: Boolean, default: true },
  wordFilter:      { type: Boolean, default: true },
  ignoredRoles:    [String],
  ignoredChannels: [String],
});

const promotionSchema = new mongoose.Schema({
  userId:     String,
  fromRole:   String,
  toRole:     String,
  fromDept:   String,
  toDept:     String,
  notes:      String,
  reason:     String,
  approvedBy: String,
  executor:   String,
  type:       String,
  timestamp:  { type: Number, default: () => Date.now() },
});

// ── Models ────────────────────────────────────────────────────────────────────

const Infraction  = mongoose.model("Infraction",  infractionSchema);
const GlobalBan   = mongoose.model("GlobalBan",   globalBanSchema);
const DeptBan     = mongoose.model("DeptBan",     deptBanSchema);
const Mute        = mongoose.model("Mute",        muteSchema);
const Verification= mongoose.model("Verification",verificationSchema);
const AutomodSettings = mongoose.model("AutomodSettings", automodSchema);
const Promotion   = mongoose.model("Promotion",   promotionSchema);

// ─── Infractions ──────────────────────────────────────────────────────────────

async function getInfractions(userId) {
  return Infraction.find({ userId }).sort({ timestamp: 1 }).lean();
}

async function addInfraction(userId, data) {
  const count = await Infraction.countDocuments();
  const caseId = count + 1;
  const entry = await Infraction.create({ userId, caseId, ...data });
  return entry.toObject();
}

async function removeInfraction(userId, caseId) {
  const res = await Infraction.deleteOne({ userId, caseId });
  return res.deletedCount > 0;
}

async function clearInfractions(userId) {
  await Infraction.deleteMany({ userId });
}

// ─── Global Bans ──────────────────────────────────────────────────────────────

async function getGlobalBan(userId) {
  return GlobalBan.findOne({ userId }).lean();
}

async function addGlobalBan(userId, data) {
  await GlobalBan.findOneAndUpdate({ userId }, { userId, ...data }, { upsert: true });
}

async function removeGlobalBan(userId) {
  const res = await GlobalBan.deleteOne({ userId });
  return res.deletedCount > 0;
}

async function getAllGlobalBans() {
  const bans = await GlobalBan.find().lean();
  return Object.fromEntries(bans.map(b => [b.userId, b]));
}

// ─── Department Bans ──────────────────────────────────────────────────────────

async function getDeptBan(userId, dept) {
  return DeptBan.findOne({ userId, dept }).lean();
}

async function addDeptBan(userId, dept, data) {
  await DeptBan.findOneAndUpdate({ userId, dept }, { userId, dept, ...data }, { upsert: true });
}

async function removeDeptBan(userId, dept) {
  const res = await DeptBan.deleteOne({ userId, dept });
  return res.deletedCount > 0;
}

async function getUserDeptBans(userId) {
  const bans = await DeptBan.find({ userId }).lean();
  return Object.fromEntries(bans.map(b => [b.dept, b]));
}

// ─── Mutes ────────────────────────────────────────────────────────────────────

async function getMute(userId) {
  return Mute.findOne({ userId }).lean();
}

async function setMute(userId, data) {
  await Mute.findOneAndUpdate({ userId }, { userId, ...data }, { upsert: true });
}

async function removeMute(userId) {
  await Mute.deleteOne({ userId });
}

// ─── Verification ─────────────────────────────────────────────────────────────

async function getVerification(userId) {
  return Verification.findOne({ userId }).lean();
}

async function setVerification(userId, data) {
  await Verification.findOneAndUpdate({ userId }, { userId, ...data }, { upsert: true });
}

// ─── AutoMod settings ─────────────────────────────────────────────────────────

async function getAutomodSettings() {
  const doc = await AutomodSettings.findById("settings").lean();
  if (doc) return doc;
  return {
    enabled: true, antiSpam: true, antiLinks: true, antiInvites: true,
    antiCaps: true, antiMassMention: true, antiDuplicates: true,
    wordFilter: true, ignoredRoles: [], ignoredChannels: [],
  };
}

async function setAutomodSettings(data) {
  await AutomodSettings.findByIdAndUpdate("settings", data, { upsert: true });
}

// ─── Promotions ───────────────────────────────────────────────────────────────

async function logPromotion(data) {
  await Promotion.create(data);
}

async function getPromotionHistory(userId) {
  return Promotion.find({ userId }).sort({ timestamp: 1 }).lean();
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // Infractions
  getInfractions, addInfraction, removeInfraction, clearInfractions,
  // Global bans
  getGlobalBan, addGlobalBan, removeGlobalBan, getAllGlobalBans,
  // Dept bans
  getDeptBan, addDeptBan, removeDeptBan, getUserDeptBans,
  // Mutes
  getMute, setMute, removeMute,
  // Verification
  getVerification, setVerification,
  // AutoMod settings
  getAutomodSettings, setAutomodSettings,
  // Promotions
  logPromotion, getPromotionHistory,
};
