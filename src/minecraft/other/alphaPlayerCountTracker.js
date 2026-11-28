const minecraftProtocol = require("minecraft-protocol");
const fs = require("fs");
const config = require("../../../config.json");

// Posts only when Alpha opens or closes, not while it stays open.
// Open = more than OPEN_THRESHOLD players. Closed = CLOSED_CHECKS checks in a row at or below it (or unreachable),
// so a short dip in players doesn't post "closed" and then "open" again.
const CHECK_INTERVAL = 15 * 60000;
const OPEN_THRESHOLD = 10;
const CLOSED_CHECKS = 4; // 1 hour
const STATE_FILE = "./data/alpha-state.json";

let state = loadState(); // { open: boolean | null }
let closedStreak = 0;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { open: null };
  }
}

function saveState() {
  try {
    fs.mkdirSync("./data", { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (error) {
    console.error("Could not save Alpha state:", error);
  }
}

async function playerCount() {
  try {
    const response = await minecraftProtocol.ping({ host: "alpha.hypixel.net", port: 25565, version: "1.8.9" });
    return response?.players?.online ?? 0;
  } catch {
    return 0; // unreachable counts as closed
  }
}

async function checkAlphaPlayerCount() {
  const count = await playerCount();
  const open = count > OPEN_THRESHOLD;
  closedStreak = open ? 0 : closedStreak + 1;

  if (open && state.open !== true) {
    // First check after setup only remembers the state, so a restart doesn't post.
    if (state.open === false) {
      bot.chat(`/gc [ALPHA] Alpha Hypixel is now open, current player count: ${count}`);
    }
    state.open = true;
    saveState();
  } else if (!open && state.open !== false && (state.open === null || closedStreak >= CLOSED_CHECKS)) {
    if (state.open === true) {
      bot.chat("/gc [ALPHA] Alpha Hypixel is now closed.");
    }
    state.open = false;
    saveState();
  }
}

if (config.minecraft.hypixelUpdates.enabled === true && config.minecraft.hypixelUpdates.alphaPlayerCountTracker === true) {
  setInterval(checkAlphaPlayerCount, CHECK_INTERVAL);
  checkAlphaPlayerCount();
}
