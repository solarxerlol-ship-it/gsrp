/**
 * economyDb.js — MongoDB economy persistence.
 */

require("./db");
const mongoose = require("mongoose");

// ── Schemas ───────────────────────────────────────────────────────────────────

const walletSchema = new mongoose.Schema({
  userId:     { type: String, unique: true },
  guildId:    String,
  cash:       { type: Number, default: 0 },
  bank:       { type: Number, default: 0 },
  lastDaily:  { type: Number, default: 0 },
  lastWork:   { type: Number, default: 0 },
  lastRob:    { type: Number, default: 0 },
  lastCrime:  { type: Number, default: 0 },
});

const inventorySchema = new mongoose.Schema({
  userId:   String,
  guildId:  String,
  itemName: String,
  quantity: { type: Number, default: 1 },
});

const shopSchema = new mongoose.Schema({
  guildId:     String,
  name:        { type: String },
  price:       Number,
  description: String,
  sellBack:    { type: Number, default: 0 }, // sell-back value (0 = not sellable)
});

const ecoSettingsSchema = new mongoose.Schema({
  guildId:      { type: String, unique: true },
  dailyAmount:  { type: Number, default: 500 },
  workMin:      { type: Number, default: 50 },
  workMax:      { type: Number, default: 300 },
});

const Wallet      = mongoose.models.Wallet      || mongoose.model("Wallet",      walletSchema);
const Inventory   = mongoose.models.Inventory   || mongoose.model("Inventory",   inventorySchema);
const ShopItem    = mongoose.models.ShopItem    || mongoose.model("ShopItem",    shopSchema);
const EcoSettings = mongoose.models.EcoSettings || mongoose.model("EcoSettings", ecoSettingsSchema);

// ── Wallet ────────────────────────────────────────────────────────────────────

async function getWallet(userId, guildId) {
  return Wallet.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, guildId, cash: 0, bank: 0 } },
    { upsert: true, new: true }
  ).lean();
}

async function addCash(userId, guildId, amount) {
  return Wallet.findOneAndUpdate(
    { userId },
    { $inc: { cash: amount }, $setOnInsert: { guildId } },
    { upsert: true, new: true }
  ).lean();
}

async function removeCash(userId, amount) {
  const w = await Wallet.findOne({ userId }).lean();
  if (!w) return null;
  const newCash = Math.max(0, w.cash - amount);
  return Wallet.findOneAndUpdate({ userId }, { cash: newCash }, { new: true }).lean();
}

async function setCash(userId, guildId, amount) {
  return Wallet.findOneAndUpdate(
    { userId },
    { cash: Math.max(0, amount), $setOnInsert: { guildId } },
    { upsert: true, new: true }
  ).lean();
}

async function deposit(userId, amount) {
  const w = await Wallet.findOne({ userId }).lean();
  if (!w) return null;
  const amt = amount === "all" ? w.cash : Math.min(amount, w.cash);
  if (amt <= 0) return null;
  return Wallet.findOneAndUpdate({ userId }, { $inc: { cash: -amt, bank: amt } }, { new: true }).lean();
}

async function withdraw(userId, amount) {
  const w = await Wallet.findOne({ userId }).lean();
  if (!w) return null;
  const amt = amount === "all" ? w.bank : Math.min(amount, w.bank);
  if (amt <= 0) return null;
  return Wallet.findOneAndUpdate({ userId }, { $inc: { cash: amt, bank: -amt } }, { new: true }).lean();
}

async function transfer(fromId, toId, guildId, amount) {
  const from = await Wallet.findOne({ userId: fromId }).lean();
  if (!from || from.cash < amount) return false;
  await Wallet.updateOne({ userId: fromId }, { $inc: { cash: -amount } });
  await Wallet.findOneAndUpdate(
    { userId: toId },
    { $inc: { cash: amount }, $setOnInsert: { guildId } },
    { upsert: true }
  );
  return true;
}

async function setCooldown(userId, field) {
  await Wallet.updateOne({ userId }, { [field]: Date.now() });
}

async function getLeaderboard(guildId, limit = 10) {
  const wallets = await Wallet.find({ guildId }).lean();
  return wallets
    .map(w => ({ ...w, total: w.cash + w.bank }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

async function resetAll(guildId) {
  await Wallet.deleteMany({ guildId });
  await Inventory.deleteMany({ guildId });
}

// ── Inventory ─────────────────────────────────────────────────────────────────

async function getInventory(userId, guildId) {
  return Inventory.find({ userId, guildId }).lean();
}

async function addToInventory(userId, guildId, itemName, qty = 1) {
  const existing = await Inventory.findOne({ userId, guildId, itemName });
  if (existing) {
    await Inventory.updateOne({ _id: existing._id }, { $inc: { quantity: qty } });
  } else {
    await Inventory.create({ userId, guildId, itemName, quantity: qty });
  }
}

async function removeFromInventory(userId, guildId, itemName, qty = 1) {
  const existing = await Inventory.findOne({ userId, guildId, itemName });
  if (!existing || existing.quantity < qty) return false;
  if (existing.quantity === qty) {
    await Inventory.deleteOne({ _id: existing._id });
  } else {
    await Inventory.updateOne({ _id: existing._id }, { $inc: { quantity: -qty } });
  }
  return true;
}

// ── Shop ──────────────────────────────────────────────────────────────────────

async function getShop(guildId) {
  return ShopItem.find({ guildId }).lean();
}

async function getShopItem(guildId, name) {
  return ShopItem.findOne({ guildId, name: new RegExp(`^${name}$`, "i") }).lean();
}

async function addShopItem(guildId, name, price, description, sellBack = 0) {
  return ShopItem.findOneAndUpdate(
    { guildId, name },
    { guildId, name, price, description, sellBack },
    { upsert: true, new: true }
  ).lean();
}

async function removeShopItem(guildId, name) {
  const res = await ShopItem.deleteOne({ guildId, name: new RegExp(`^${name}$`, "i") });
  return res.deletedCount > 0;
}

async function editShopItem(guildId, name, fields) {
  return ShopItem.findOneAndUpdate(
    { guildId, name: new RegExp(`^${name}$`, "i") },
    { $set: fields },
    { new: true }
  ).lean();
}

// ── Settings ──────────────────────────────────────────────────────────────────

async function getSettings(guildId) {
  return EcoSettings.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId } },
    { upsert: true, new: true }
  ).lean();
}

async function updateSettings(guildId, fields) {
  return EcoSettings.findOneAndUpdate({ guildId }, { $set: fields }, { upsert: true, new: true }).lean();
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  getWallet, addCash, removeCash, setCash, deposit, withdraw, transfer,
  setCooldown, getLeaderboard, resetAll,
  getInventory, addToInventory, removeFromInventory,
  getShop, getShopItem, addShopItem, removeShopItem, editShopItem,
  getSettings, updateSettings,
};
