/**
 * economy.js — Full economy prefix command handler.
 * Prefix: -
 */

const { Events, EmbedBuilder } = require("discord.js");
const { economy, roles } = require("../config");
const db = require("../utils/economyDb");

const PREFIX = "-";

// Cooldowns in ms
const CD = {
  work:  30 * 60 * 1000,
  rob:   60 * 60 * 1000,
  crime: 45 * 60 * 1000,
};

const WORK_LINES = [
  "worked a shift at the police department",
  "directed traffic downtown",
  "patrolled the city streets",
  "assisted at the fire station",
  "worked dispatch for the night",
  "helped out at the courthouse",
  "ran a speed trap on the highway",
  "escorted a VIP across the city",
  "investigated a noise complaint",
  "completed a ride-along with a rookie",
];

const CRIME_WIN = [
  "You robbed a convenience store",
  "You ran an illegal street race",
  "You sold counterfeit licenses",
  "You hacked into a parking meter system",
  "You fenced stolen goods",
];

const CRIME_LOSE = [
  "You got caught trying to pickpocket someone",
  "Your heist plan fell apart",
  "You were caught on camera and fined",
  "The sting operation caught you red-handed",
  "You tripped the alarm and got caught",
];

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args    = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();
    const guildId = message.guild.id;
    const userId  = message.author.id;

    const settings = await db.getSettings(guildId);
    const isOwner  = userId === economy.ownerId;
    const isMgmt   = isOwner || message.member?.roles?.cache?.has(roles.management);

    // ── balance ───────────────────────────────────────────────────────────────
    if (command === "balance" || command === "bal") {
      const target = message.mentions.users.first() ?? message.author;
      const wallet = await db.getWallet(target.id, guildId);
      return send(message, balanceEmbed(target, wallet));
    }

    // ── deposit ───────────────────────────────────────────────────────────────
    if (command === "deposit" || command === "dep") {
      const raw = args[0];
      if (!raw) return err(message, `Usage: \`${PREFIX}deposit <amount|all>\``);
      const wallet = await db.deposit(userId, raw === "all" ? "all" : parseInt(raw));
      if (!wallet) return err(message, "You don't have enough cash to deposit.");
      const amt = raw === "all" ? "all" : parseInt(raw);
      return send(message, simpleEmbed("🏦  Deposit",
        `Deposited **${fmt(amt === "all" ? wallet.bank : amt)}** into your bank.\n\n${walletLine(wallet)}`, GREEN));
    }

    // ── withdraw ──────────────────────────────────────────────────────────────
    if (command === "withdraw" || command === "with") {
      const raw = args[0];
      if (!raw) return err(message, `Usage: \`${PREFIX}withdraw <amount|all>\``);
      const wallet = await db.withdraw(userId, raw === "all" ? "all" : parseInt(raw));
      if (!wallet) return err(message, "You don't have enough in your bank.");
      return send(message, simpleEmbed("🏦  Withdraw",
        `Withdrew **${fmt(raw === "all" ? wallet.cash : parseInt(raw))}** from your bank.\n\n${walletLine(wallet)}`, GREEN));
    }

    // ── pay ───────────────────────────────────────────────────────────────────
    if (command === "pay") {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      if (!target || isNaN(amount) || amount <= 0) return err(message, `Usage: \`${PREFIX}pay @user <amount>\``);
      if (target.id === userId) return err(message, "You can't pay yourself.");
      if (target.bot) return err(message, "You can't pay a bot.");
      const ok = await db.transfer(userId, target.id, guildId, amount);
      if (!ok) return err(message, `Not enough cash. Check your \`${PREFIX}balance\`.`);
      return send(message, simpleEmbed("💸  Payment Sent",
        `You sent **${fmt(amount)}** to ${target}.`, GREEN));
    }

    // ── leaderboard ───────────────────────────────────────────────────────────
    if (command === "leaderboard" || command === "lb" || command === "top") {
      const top = await db.getLeaderboard(guildId, 10);
      if (!top.length) return err(message, "No economy data yet.");
      const lines = top.map((w, i) =>
        `**${i + 1}.** <@${w.userId}> — ${sym()} ${w.total.toLocaleString()}`
      );
      return send(message, simpleEmbed(`${sym()}  Leaderboard`, lines.join("\n"), BLUE));
    }

    // ── daily ─────────────────────────────────────────────────────────────────
    if (command === "daily") {
      const wallet = await db.getWallet(userId, guildId);
      const next   = wallet.lastDaily + (economy.dailyCooldown ?? 86400000);
      if (Date.now() < next) return err(message, `Your daily resets in **${msToTime(next - Date.now())}**.`);
      await db.addCash(userId, guildId, settings.dailyAmount);
      await db.setCooldown(userId, "lastDaily");
      const updated = await db.getWallet(userId, guildId);
      return send(message, simpleEmbed("📅  Daily Reward",
        `You claimed your daily **${fmt(settings.dailyAmount)}**!\n\n${walletLine(updated)}`, GREEN));
    }

    // ── work ──────────────────────────────────────────────────────────────────
    if (command === "work") {
      const wallet = await db.getWallet(userId, guildId);
      const next   = wallet.lastWork + CD.work;
      if (Date.now() < next) return err(message, `You can work again in **${msToTime(next - Date.now())}**.`);
      const earned  = rand(settings.workMin, settings.workMax);
      const line    = WORK_LINES[Math.floor(Math.random() * WORK_LINES.length)];
      await db.addCash(userId, guildId, earned);
      await db.setCooldown(userId, "lastWork");
      const updated = await db.getWallet(userId, guildId);
      return send(message, simpleEmbed("💼  Work",
        `You ${line} and earned **${fmt(earned)}**.\n\n${walletLine(updated)}`, GREEN));
    }

    // ── rob ───────────────────────────────────────────────────────────────────
    if (command === "rob") {
      const target = message.mentions.users.first();
      if (!target) return err(message, `Usage: \`${PREFIX}rob @user\``);
      if (target.id === userId) return err(message, "You can't rob yourself.");
      if (target.bot) return err(message, "You can't rob a bot.");

      const self = await db.getWallet(userId, guildId);
      const next  = self.lastRob + CD.rob;
      if (Date.now() < next) return err(message, `You can rob again in **${msToTime(next - Date.now())}**.`);

      const victim = await db.getWallet(target.id, guildId);
      if (victim.cash < 100) return err(message, `${target.username} doesn't have enough cash to rob.`);

      await db.setCooldown(userId, "lastRob");

      // 40% success
      if (Math.random() < 0.4) {
        const stolen = rand(50, Math.min(Math.floor(victim.cash * 0.3), 2000));
        await db.addCash(userId, guildId, stolen);
        await db.removeCash(target.id, stolen);
        return send(message, simpleEmbed("🦹  Rob",
          `You successfully robbed ${target} and got away with **${fmt(stolen)}**!`, GREEN));
      } else {
        const fine = rand(100, 400);
        await db.removeCash(userId, fine);
        return send(message, simpleEmbed("🚔  Caught!",
          `You got caught trying to rob ${target} and were fined **${fmt(fine)}**.`, RED));
      }
    }

    // ── crime ─────────────────────────────────────────────────────────────────
    if (command === "crime") {
      const self = await db.getWallet(userId, guildId);
      const next  = self.lastCrime + CD.crime;
      if (Date.now() < next) return err(message, `You can commit a crime again in **${msToTime(next - Date.now())}**.`);

      await db.setCooldown(userId, "lastCrime");

      // 50% success
      if (Math.random() < 0.5) {
        const earned = rand(300, 1200);
        const line   = CRIME_WIN[Math.floor(Math.random() * CRIME_WIN.length)];
        await db.addCash(userId, guildId, earned);
        return send(message, simpleEmbed("🕵️  Crime",
          `${line} and earned **${fmt(earned)}**.`, GREEN));
      } else {
        const fine = rand(200, 800);
        const line  = CRIME_LOSE[Math.floor(Math.random() * CRIME_LOSE.length)];
        await db.removeCash(userId, fine);
        return send(message, simpleEmbed("🚔  Caught!",
          `${line} and were fined **${fmt(fine)}**.`, RED));
      }
    }

    // ── coinflip ──────────────────────────────────────────────────────────────
    if (command === "coinflip" || command === "cf") {
      const raw = args[0];
      if (!raw) return err(message, `Usage: \`${PREFIX}coinflip <amount|all>\``);
      const wallet = await db.getWallet(userId, guildId);
      const amount = raw === "all" ? wallet.cash : parseInt(raw);
      if (isNaN(amount) || amount <= 0) return err(message, "Enter a valid amount.");
      if (wallet.cash < amount) return err(message, "Not enough cash.");

      const win = Math.random() < 0.5;
      if (win) {
        await db.addCash(userId, guildId, amount);
        return send(message, simpleEmbed("🪙  Coinflip", `**Heads!** You won **${fmt(amount)}**!`, GREEN));
      } else {
        await db.removeCash(userId, amount);
        return send(message, simpleEmbed("🪙  Coinflip", `**Tails!** You lost **${fmt(amount)}**.`, RED));
      }
    }

    // ── slots ─────────────────────────────────────────────────────────────────
    if (command === "slots") {
      const raw = args[0];
      if (!raw) return err(message, `Usage: \`${PREFIX}slots <amount>\``);
      const wallet = await db.getWallet(userId, guildId);
      const amount = parseInt(raw);
      if (isNaN(amount) || amount <= 0) return err(message, "Enter a valid amount.");
      if (wallet.cash < amount) return err(message, "Not enough cash.");

      const SYMBOLS = ["🍒", "🍋", "🍇", "⭐", "💎", "7️⃣"];
      const reels = [0, 0, 0].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      const display = `[ ${reels.join("  |  ")} ]`;

      let multiplier = 0;
      if (reels[0] === reels[1] && reels[1] === reels[2]) {
        multiplier = reels[0] === "💎" ? 10 : reels[0] === "7️⃣" ? 7 : 3;
      } else if (reels[0] === reels[1] || reels[1] === reels[2]) {
        multiplier = 1.5;
      }

      if (multiplier > 0) {
        const winnings = Math.floor(amount * multiplier);
        await db.addCash(userId, guildId, winnings - amount);
        return send(message, simpleEmbed("🎰  Slots",
          `${display}\n\n🎉 **Winner!** You won **${fmt(winnings)}**! (${multiplier}x)`, GREEN));
      } else {
        await db.removeCash(userId, amount);
        return send(message, simpleEmbed("🎰  Slots",
          `${display}\n\nNo match. You lost **${fmt(amount)}**.`, RED));
      }
    }

    // ── blackjack ─────────────────────────────────────────────────────────────
    if (command === "blackjack" || command === "bj") {
      const raw = args[0];
      if (!raw) return err(message, `Usage: \`${PREFIX}blackjack <amount>\``);
      const wallet = await db.getWallet(userId, guildId);
      const amount = parseInt(raw);
      if (isNaN(amount) || amount <= 0) return err(message, "Enter a valid amount.");
      if (wallet.cash < amount) return err(message, "Not enough cash.");

      const deck = buildDeck();
      const player = [draw(deck), draw(deck)];
      const dealer = [draw(deck), draw(deck)];

      const pScore = handValue(player);
      const dScore = handValue(dealer);

      let result, desc, color;

      if (pScore === 21) {
        const winnings = Math.floor(amount * 1.5);
        await db.addCash(userId, guildId, winnings);
        result = "Blackjack!"; color = GREEN;
        desc = `You got blackjack and won **${fmt(winnings)}**!`;
      } else if (dScore === 21 || pScore > 21) {
        await db.removeCash(userId, amount);
        result = "Dealer wins"; color = RED;
        desc = `You lost **${fmt(amount)}**.`;
      } else {
        // Dealer draws to 17
        while (handValue(dealer) < 17) dealer.push(draw(deck));
        const finalD = handValue(dealer);
        const finalP = pScore;

        if (finalD > 21 || finalP > finalD) {
          await db.addCash(userId, guildId, amount);
          result = "You win!"; color = GREEN;
          desc = `You won **${fmt(amount)}**!`;
        } else if (finalP === finalD) {
          result = "Push"; color = BLUE;
          desc = "It's a tie — your bet has been returned.";
        } else {
          await db.removeCash(userId, amount);
          result = "Dealer wins"; color = RED;
          desc = `You lost **${fmt(amount)}**.`;
        }
        player.push(...dealer.slice(2));
      }

      const embed = new EmbedBuilder().setColor(color).setTitle(`🃏  Blackjack — ${result}`)
        .addFields(
          { name: `Your Hand (${handValue(player)})`, value: player.map(c => c.display).join(" "), inline: true },
          { name: `Dealer Hand (${handValue(dealer)})`, value: dealer.map(c => c.display).join(" "), inline: true },
        )
        .setDescription(desc);
      return send(message, embed);
    }

    // ── dice ──────────────────────────────────────────────────────────────────
    if (command === "dice") {
      const raw = args[0];
      if (!raw) return err(message, `Usage: \`${PREFIX}dice <amount>\``);
      const wallet = await db.getWallet(userId, guildId);
      const amount = parseInt(raw);
      if (isNaN(amount) || amount <= 0) return err(message, "Enter a valid amount.");
      if (wallet.cash < amount) return err(message, "Not enough cash.");

      const pRoll = rand(1, 6);
      const bRoll = rand(1, 6);

      if (pRoll > bRoll) {
        await db.addCash(userId, guildId, amount);
        return send(message, simpleEmbed("🎲  Dice",
          `You rolled **${pRoll}** — Bot rolled **${bRoll}**.\nYou won **${fmt(amount)}**!`, GREEN));
      } else if (pRoll < bRoll) {
        await db.removeCash(userId, amount);
        return send(message, simpleEmbed("🎲  Dice",
          `You rolled **${pRoll}** — Bot rolled **${bRoll}**.\nYou lost **${fmt(amount)}**.`, RED));
      } else {
        return send(message, simpleEmbed("🎲  Dice",
          `You rolled **${pRoll}** — Bot rolled **${bRoll}**.\nIt's a tie — no money lost.`, BLUE));
      }
    }

    // ── roulette ──────────────────────────────────────────────────────────────
    if (command === "roulette") {
      const raw  = args[0];
      const bet  = args[1]?.toLowerCase();
      if (!raw || !bet) return err(message, `Usage: \`${PREFIX}roulette <amount> <red|black|green|0-36>\``);
      const wallet = await db.getWallet(userId, guildId);
      const amount = parseInt(raw);
      if (isNaN(amount) || amount <= 0) return err(message, "Enter a valid amount.");
      if (wallet.cash < amount) return err(message, "Not enough cash.");

      const spin = Math.floor(Math.random() * 37); // 0-36
      const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      const spinColor = spin === 0 ? "green" : RED_NUMS.includes(spin) ? "red" : "black";
      const spinEmoji = spin === 0 ? "🟢" : spinColor === "red" ? "🔴" : "⚫";

      let multiplier = 0;
      const betNum = parseInt(bet);

      if (!isNaN(betNum) && betNum >= 0 && betNum <= 36) {
        if (spin === betNum) multiplier = 35;
      } else if (bet === "red" || bet === "black") {
        if (bet === spinColor) multiplier = 1;
      } else if (bet === "green") {
        if (spin === 0) multiplier = 14;
      } else {
        return err(message, "Bet must be `red`, `black`, `green`, or a number 0–36.");
      }

      if (multiplier > 0) {
        const winnings = amount * multiplier;
        await db.addCash(userId, guildId, winnings);
        return send(message, simpleEmbed("🎡  Roulette",
          `${spinEmoji} The ball landed on **${spin}** (${spinColor}).\n\nYou won **${fmt(winnings)}**! (${multiplier}x)`, GREEN));
      } else {
        await db.removeCash(userId, amount);
        return send(message, simpleEmbed("🎡  Roulette",
          `${spinEmoji} The ball landed on **${spin}** (${spinColor}).\n\nYou lost **${fmt(amount)}**.`, RED));
      }
    }

    // ── shop ──────────────────────────────────────────────────────────────────
    if (command === "shop") {
      const items = await db.getShop(guildId);
      if (!items.length) return err(message, "The shop is empty. Management can add items with `-additem`.");
      const lines = items.map(i =>
        `**${i.name}** — ${fmt(i.price)}\n-# ${i.description}${i.sellBack ? ` • Sell back: ${fmt(i.sellBack)}` : ""}`
      );
      return send(message, simpleEmbed(`${sym()}  Shop`, lines.join("\n\n"), BLUE));
    }

    // ── buy ───────────────────────────────────────────────────────────────────
    if (command === "buy") {
      const name = args.join(" ");
      if (!name) return err(message, `Usage: \`${PREFIX}buy <item name>\``);
      const item = await db.getShopItem(guildId, name);
      if (!item) return err(message, `Item **${name}** not found in the shop.`);
      const wallet = await db.getWallet(userId, guildId);
      if (wallet.cash < item.price) return err(message, `You need **${fmt(item.price)}** but only have **${fmt(wallet.cash)}**.`);
      await db.removeCash(userId, item.price);
      await db.addToInventory(userId, guildId, item.name);
      return send(message, simpleEmbed(`${sym()}  Purchase`,
        `You bought **${item.name}** for **${fmt(item.price)}**.`, GREEN));
    }

    // ── sell ──────────────────────────────────────────────────────────────────
    if (command === "sell") {
      const name = args.join(" ");
      if (!name) return err(message, `Usage: \`${PREFIX}sell <item name>\``);
      const item = await db.getShopItem(guildId, name);
      if (!item) return err(message, `Item **${name}** not found.`);
      if (!item.sellBack || item.sellBack <= 0) return err(message, `**${item.name}** cannot be sold back.`);
      const removed = await db.removeFromInventory(userId, guildId, item.name);
      if (!removed) return err(message, `You don't own **${item.name}**.`);
      await db.addCash(userId, guildId, item.sellBack);
      return send(message, simpleEmbed(`${sym()}  Sold`,
        `You sold **${item.name}** for **${fmt(item.sellBack)}**.`, GREEN));
    }

    // ── inventory ─────────────────────────────────────────────────────────────
    if (command === "inventory" || command === "inv") {
      const target = message.mentions.users.first() ?? message.author;
      const inv = await db.getInventory(target.id, guildId);
      if (!inv.length) return send(message, simpleEmbed(`🎒  Inventory`, `${target.username} has no items.`, BLUE));
      const lines = inv.map(i => `${emojiBullet} **${i.itemName}** × ${i.quantity}`);
      return send(message, simpleEmbed(`🎒  ${target.username}'s Inventory`, lines.join("\n"), BLUE));
    }

    // ── networth ──────────────────────────────────────────────────────────────
    if (command === "networth" || command === "nw") {
      const target = message.mentions.users.first() ?? message.author;
      const wallet = await db.getWallet(target.id, guildId);
      return send(message, simpleEmbed(`📊  Net Worth`,
        `${target.username}'s net worth is **${fmt(wallet.cash + wallet.bank)}**.\n\n${walletLine(wallet)}`, BLUE));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Management commands (management role or owner)
    // ─────────────────────────────────────────────────────────────────────────

    if (command === "additem") {
      if (!isMgmt) return;
      // -additem <price> <name> | <description>
      // usage: -additem 500 VIP Pass | Grants VIP access
      const fullStr = args.join(" ");
      const [namePricePart, description] = fullStr.split("|").map(s => s.trim());
      const parts = namePricePart?.split(" ");
      const price = parseInt(parts?.[0]);
      const name  = parts?.slice(1).join(" ");

      if (!name || isNaN(price) || price <= 0 || !description) {
        return err(message, `Usage: \`${PREFIX}additem <price> <name> | <description>\`\nExample: \`${PREFIX}additem 500 VIP Pass | Grants VIP access\``);
      }

      await db.addShopItem(guildId, name, price, description);
      return send(message, simpleEmbed(`${sym()}  Item Added`,
        `**${name}** added to the shop for **${fmt(price)}**.`, GREEN));
    }

    if (command === "removeitem") {
      if (!isMgmt) return;
      const name = args.join(" ");
      if (!name) return err(message, `Usage: \`${PREFIX}removeitem <name>\``);
      const removed = await db.removeShopItem(guildId, name);
      if (!removed) return err(message, `Item **${name}** not found.`);
      return send(message, simpleEmbed(`${sym()}  Item Removed`, `**${name}** removed from the shop.`, RED));
    }

    if (command === "edititem") {
      if (!isMgmt) return;
      // -edititem <new price> <name>
      const price = parseInt(args[0]);
      const name  = args.slice(1).join(" ");
      if (!name || isNaN(price) || price <= 0) return err(message, `Usage: \`${PREFIX}edititem <new price> <name>\``);
      const item = await db.editShopItem(guildId, name, { price });
      if (!item) return err(message, `Item **${name}** not found.`);
      return send(message, simpleEmbed(`${sym()}  Item Updated`, `**${name}** price updated to **${fmt(price)}**.`, BLUE));
    }

    if (command === "setsellback") {
      if (!isMgmt) return;
      const sellBack = parseInt(args[0]);
      const name     = args.slice(1).join(" ");
      if (!name || isNaN(sellBack) || sellBack < 0) return err(message, `Usage: \`${PREFIX}setsellback <amount> <name>\``);
      const item = await db.editShopItem(guildId, name, { sellBack });
      if (!item) return err(message, `Item **${name}** not found.`);
      return send(message, simpleEmbed(`${sym()}  Sell-Back Updated`,
        `**${name}** sell-back value set to **${fmt(sellBack)}**.`, BLUE));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Owner-only commands
    // ─────────────────────────────────────────────────────────────────────────

    if (command === "addmoney") {
      if (!isOwner) return;
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      if (!target || isNaN(amount) || amount <= 0) return err(message, `Usage: \`${PREFIX}addmoney @user <amount>\``);
      await db.addCash(target.id, guildId, amount);
      return send(message, simpleEmbed(`${sym()}  Money Added`, `Added **${fmt(amount)}** to ${target}'s cash.`, GREEN));
    }

    if (command === "removemoney") {
      if (!isOwner) return;
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      if (!target || isNaN(amount) || amount <= 0) return err(message, `Usage: \`${PREFIX}removemoney @user <amount>\``);
      await db.removeCash(target.id, amount);
      return send(message, simpleEmbed(`${sym()}  Money Removed`, `Removed **${fmt(amount)}** from ${target}'s cash.`, RED));
    }

    if (command === "setmoney") {
      if (!isOwner) return;
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      if (!target || isNaN(amount) || amount < 0) return err(message, `Usage: \`${PREFIX}setmoney @user <amount>\``);
      await db.setCash(target.id, guildId, amount);
      return send(message, simpleEmbed(`${sym()}  Money Set`, `Set ${target}'s cash to **${fmt(amount)}**.`, BLUE));
    }

    if (command === "setdaily") {
      if (!isOwner) return;
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0) return err(message, `Usage: \`${PREFIX}setdaily <amount>\``);
      await db.updateSettings(guildId, { dailyAmount: amount });
      return send(message, simpleEmbed(`📅  Daily Updated`, `Daily reward set to **${fmt(amount)}**.`, BLUE));
    }

    if (command === "setworkmin") {
      if (!isOwner) return;
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0) return err(message, `Usage: \`${PREFIX}setworkmin <amount>\``);
      await db.updateSettings(guildId, { workMin: amount });
      return send(message, simpleEmbed(`💼  Work Updated`, `Minimum work payout set to **${fmt(amount)}**.`, BLUE));
    }

    if (command === "setworkmax") {
      if (!isOwner) return;
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0) return err(message, `Usage: \`${PREFIX}setworkmax <amount>\``);
      await db.updateSettings(guildId, { workMax: amount });
      return send(message, simpleEmbed(`💼  Work Updated`, `Maximum work payout set to **${fmt(amount)}**.`, BLUE));
    }

    if (command === "reseteconomy") {
      if (!isOwner) return;
      await db.resetAll(guildId);
      return send(message, simpleEmbed(`⚠️  Economy Reset`, "All balances and inventories have been wiped.", RED));
    }

    if (command === "ecohelp" || command === "ehelp") {
      const user = [
        `\`${PREFIX}balance [@user]\` — View cash & bank`,
        `\`${PREFIX}deposit <amount|all>\` — Deposit cash to bank`,
        `\`${PREFIX}withdraw <amount|all>\` — Withdraw from bank`,
        `\`${PREFIX}pay @user <amount>\` — Send cash to someone`,
        `\`${PREFIX}leaderboard\` — Top 10 richest`,
        `\`${PREFIX}networth [@user]\` — View total net worth`,
        `\`${PREFIX}daily\` — Claim daily reward (24h cooldown)`,
        `\`${PREFIX}work\` — Earn money (30m cooldown)`,
        `\`${PREFIX}rob @user\` — Rob someone (1h cooldown)`,
        `\`${PREFIX}crime\` — Commit a crime (45m cooldown)`,
        `\`${PREFIX}coinflip <amount|all>\` — 50/50 bet`,
        `\`${PREFIX}slots <amount>\` — Slot machine`,
        `\`${PREFIX}blackjack <amount>\` — Blackjack vs dealer`,
        `\`${PREFIX}dice <amount>\` — Dice roll`,
        `\`${PREFIX}roulette <amount> <red|black|green|0-36>\` — Roulette`,
        `\`${PREFIX}shop\` — Browse the shop`,
        `\`${PREFIX}buy <item>\` — Buy an item`,
        `\`${PREFIX}sell <item>\` — Sell an item back`,
        `\`${PREFIX}inventory [@user]\` — View inventory`,
      ];
      return send(message, simpleEmbed(`${sym()}  Economy Commands`, user.join("\n"), BLUE));
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const GREEN = 0x57F287;
const RED   = 0xED4245;
const BLUE  = 0x5865F2;
const emojiBullet = "▸";

function sym() { return economy.currencySymbol; }
function fmt(amount) { return `${economy.currencySymbol} ${Number(amount).toLocaleString()}`; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function walletLine(w) { return `💵  **Cash:** ${fmt(w.cash)}\n🏦  **Bank:** ${fmt(w.bank)}`; }

function send(message, embed) {
  return message.reply({ embeds: [embed] });
}

function err(message, text) {
  return message.reply({ embeds: [simpleEmbed("❌  Error", text, RED)] });
}

function simpleEmbed(title, description, color = BLUE) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
}

function balanceEmbed(user, wallet) {
  return new EmbedBuilder()
    .setColor(BLUE)
    .setAuthor({ name: `${user.username}'s Balance`, iconURL: user.displayAvatarURL() })
    .addFields(
      { name: "💵  Cash",   value: fmt(wallet.cash),              inline: true },
      { name: "🏦  Bank",   value: fmt(wallet.bank),              inline: true },
      { name: "📊  Total",  value: fmt(wallet.cash + wallet.bank), inline: true },
    );
}

function msToTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ── Blackjack helpers ─────────────────────────────────────────────────────────

function buildDeck() {
  const suits  = ["♠️","♥️","♦️","♣️"];
  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const deck   = [];
  for (const s of suits) for (const v of values) {
    deck.push({ display: `${v}${s}`, value: v });
  }
  return deck.sort(() => Math.random() - 0.5);
}

function draw(deck) { return deck.pop(); }

function cardVal(card) {
  if (["J","Q","K"].includes(card.value)) return 10;
  if (card.value === "A") return 11;
  return parseInt(card.value);
}

function handValue(hand) {
  let total = hand.reduce((sum, c) => sum + cardVal(c), 0);
  let aces  = hand.filter(c => c.value === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
