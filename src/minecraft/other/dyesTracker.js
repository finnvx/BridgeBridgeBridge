// Reads the boosted dyes from Hypixel's /dyes menu once per SkyBlock year and keeps them in data/dyes.json.
// Each SkyBlock year (124 hours) one dye is 3x and two are 2x as common. The menu has no API, so the bot
// goes to SkyBlock (like !warp does), opens /dyes, reads the item lore and goes back to limbo.
const fs = require("fs");
const nbt = require("prismarine-nbt");
const { delay } = require("../../contracts/helperFunctions.js");
const botActivity = require("./botActivity.js");

const DATA_FILE = "./data/dyes.json";
const DEBUG_FILE = "./data/dyes-debug.json";

const SKYBLOCK_EPOCH_MS = 1560275700 * 1000;
const SKYBLOCK_YEAR_MS = 124 * 60 * 60 * 1000;

// Wait a few minutes into a new year before reading, so Hypixel has switched the menu over.
const FETCH_AFTER_NEW_YEAR_MS = 5 * 60 * 1000;
const RETRY_AFTER_MS = 10 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 1000;
const MENU_TIMEOUT_MS = 15000;

// "This dye is 3x as common during SkyBlock Year 528!"
const BOOST_REGEX = /(\d+)x as common during SkyBlock Year (\d+)/i;

let started = false;
let lastAttempt = 0;

function currentSkyblockYear(now = Date.now()) {
  return Math.floor((now - SKYBLOCK_EPOCH_MS) / SKYBLOCK_YEAR_MS) + 1;
}

function skyblockYearStart(year) {
  return SKYBLOCK_EPOCH_MS + (year - 1) * SKYBLOCK_YEAR_MS;
}

function loadDyes() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  try {
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data", { recursive: true });
    }

    fs.writeFileSync(file, JSON.stringify(value, null, 2));
  } catch (error) {
    console.warn(`Minecraft > Could not write ${file}: ${error.message || error}`);
  }
}

/** Plain text of a (simplified) chat component: strings, { text, extra }, lists, or { "": "..." }. */
function componentText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(componentText).join("");
  }

  if (typeof value === "object") {
    let text = "";

    if (typeof value.text === "string" || typeof value.text === "number") {
      text += value.text;
    } else if (typeof value[""] === "string") {
      text += value[""];
    }

    if (value.extra !== undefined) {
      text += componentText(value.extra);
    }

    return text;
  }

  return "";
}

/** Text of an anonymousNbt field from a packet (custom_name, a lore line, the window title). */
function nbtText(raw) {
  if (raw === null || raw === undefined) {
    return "";
  }

  let simplified = raw;
  try {
    if (typeof raw === "object" && typeof raw.type === "string" && "value" in raw) {
      simplified = nbt.simplify(raw);
    }
  } catch {
    simplified = raw;
  }

  return componentText(simplified)
    .replace(/§./g, "")
    .trim();
}

function readItem(slot) {
  if (!slot || !slot.itemCount || !Array.isArray(slot.components)) {
    return null;
  }

  const component = (type) => slot.components.find((entry) => entry.type === type)?.data;

  return {
    name: nbtText(component("custom_name") ?? component("item_name")),
    lore: (component("lore") || []).map(nbtText)
  };
}

/** Finds the boosted dyes among the menu items. */
function parseDyes(items) {
  const dyes = [];
  let year = null;

  for (const item of items) {
    if (!item) {
      continue;
    }

    // Hypixel wraps the sentence over two lore lines ("...as common during" / "SkyBlock Year 528!").
    const match = item.lore.join(" ").replace(/\s+/g, " ").match(BOOST_REGEX);
    if (match) {
      dyes.push({ name: item.name, multiplier: Number(match[1]) });
      year = Number(match[2]);
    }
  }

  dyes.sort((a, b) => b.multiplier - a.multiplier);

  return { year, dyes };
}

/** Runs a command that opens a menu and resolves with the menu's title and items. */
function openMenu(command) {
  return new Promise((resolve, reject) => {
    let windowId = null;
    let title = "";

    const cleanup = () => {
      bot._client.removeListener("packet", onPacket);
      clearTimeout(timeout);
    };

    const onPacket = (data, meta) => {
      if (/window|screen|container/.test(meta?.name ?? "")) {
        console.minecraft(`Dyes > packet ${meta.name} windowId=${data.windowId}`);
      }

      if (meta?.name === "open_window") {
        windowId = data.windowId;
        title = nbtText(data.windowTitle);
        return;
      }

      if (meta?.name === "window_items" && windowId !== null && data.windowId === windowId) {
        cleanup();
        resolve({ windowId, title, rawItems: data.items, items: data.items.map(readItem) });
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`no menu opened after ${command}`));
    }, MENU_TIMEOUT_MS);

    bot._client.on("packet", onPacket);
    bot.chat(command);
  });
}

function isOnline() {
  return Boolean(bot?._client) && bot._client.state === "play";
}

async function joinSkyblock(minecraft) {
  // Reuses !warp's join detection (resource pack, configuration phase, error messages).
  const WarpoutCommand = require("../commands/warpoutCommand.js");
  const joiner = new WarpoutCommand(minecraft);

  const joinOnce = async () => {
    if (typeof bot.armSkyblockResourcePackAcceptance === "function") {
      bot.armSkyblockResourcePackAcceptance(45000);
    }

    const result = joiner.waitForSkyBlockJoin(45000);
    bot.chat("/play skyblock");
    return await result;
  };

  bot.chat("/lobby megawalls");
  await delay(1500);

  let result = await joinOnce();

  if (!result.success && result.retryAction === "lobby" && isOnline()) {
    bot.chat("/lobby");
    await delay(1500);
    result = await joinOnce();
  }

  if (!result.success) {
    throw new Error(result.reason || "SkyBlock join failed");
  }
}

/**
 * Goes to SkyBlock, reads /dyes, saves and returns { year, dyes, fetchedAt }.
 * Throws if the bot is offline, busy, or the menu can't be read.
 */
async function fetchDyes(minecraft) {
  if (!isOnline()) {
    throw new Error("the bot is not online");
  }

  if (!botActivity.tryStart("dyes")) {
    throw new Error("the bot is busy right now");
  }

  let menu = null;

  try {
    console.minecraft("Dyes > going to SkyBlock to read /dyes");
    await joinSkyblock(minecraft);
    console.minecraft("Dyes > on SkyBlock, opening /dyes");
    await delay(3000);

    menu = await openMenu("/dyes");

    writeJson(DEBUG_FILE, {
      fetchedAt: new Date().toISOString(),
      title: menu.title,
      items: menu.items.map((item, slot) => (item ? { slot, ...item } : null)).filter(Boolean),
      rawItems: menu.rawItems
    });

    const { year, dyes } = parseDyes(menu.items);

    if (dyes.length === 0) {
      throw new Error(`no boosted dyes found in the menu "${menu.title}"`);
    }

    const data = { year, dyes, fetchedAt: new Date().toISOString() };
    writeJson(DATA_FILE, data);

    console.minecraft(`Dyes for SkyBlock Year ${year}: ${dyes.map((dye) => `${dye.name} ${dye.multiplier}x`).join(", ")}`);
    updateDiscordMessage(data);

    return data;
  } finally {
    if (menu && isOnline()) {
      try {
        bot._client.write("close_window", { windowId: menu.windowId });
      } catch {
        // the menu closes on the server switch anyway
      }
    }

    if (isOnline()) {
      await delay(1000);
      bot.chat("/limbo");
    }

    botActivity.end("dyes");
  }
}

/** Edits (or first posts) the dyes message in the Discord calendar channel. */
function updateDiscordMessage(data) {
  const { updateDyesEmbed } = require("../../discord/other/dyesEmbed.js");
  return updateDyesEmbed(data, skyblockYearStart(data.year + 1));
}

async function checkForNewYear(minecraft) {
  const year = currentSkyblockYear();
  const saved = loadDyes();

  if (saved?.year === year) {
    // Already read this year; make sure the Discord message shows it too (e.g. after a restart or the first time).
    const { postedYear } = require("../../discord/other/dyesEmbed.js");
    if (postedYear() !== year) {
      await updateDiscordMessage(saved);
    }
    return;
  }

  const now = Date.now();

  if (now < skyblockYearStart(year) + FETCH_AFTER_NEW_YEAR_MS || now - lastAttempt < RETRY_AFTER_MS) {
    return;
  }

  if (!isOnline() || botActivity.busyWith() !== null) {
    return;
  }

  lastAttempt = now;

  try {
    await fetchDyes(minecraft);
  } catch (error) {
    console.warn(`Minecraft > Could not read /dyes for SkyBlock Year ${year}, retrying in 10 minutes: ${error.message || error}`);
  }
}

/** Starts the yearly check once; safe to call on every login. */
function startDyesTracker(minecraft) {
  if (started) {
    return;
  }

  started = true;
  setInterval(() => checkForNewYear(minecraft), CHECK_EVERY_MS);
}

module.exports = {
  startDyesTracker,
  fetchDyes,
  loadDyes,
  parseDyes,
  readItem,
  currentSkyblockYear,
  skyblockYearStart
};
