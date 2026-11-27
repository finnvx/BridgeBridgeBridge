// Hypixel news in guild chat (config.minecraft.hypixelUpdates):
// - hypixelNews:     new posts in Hypixel's "News and Announcements" and "SkyBlock Patch Notes" forums (RSS)
// - statusUpdates:   incidents and maintenance from status.hypixel.net, and their updates
// - skyblockVersion: Skyblock version changes (Hypixel API)
// - fireSales:       new fire sales (Hypixel API), on unless set to false
// Everything already there when the bot starts counts as seen, so a restart doesn't repeat old news.
// Fire sales are also remembered in data/firesales.json, since they run for days.
const fs = require("fs");
const config = require("../../../config.json");
const Rss = require("rss-parser");
const axios = require("axios");
const { getItemName } = require("../../../API/functions/getPrices.js");

const parser = new Rss({ headers: { "User-Agent": "Mozilla/5.0 (compatible; guild-bridge)" } });

const NEWS_FEEDS = [
  "https://hypixel.net/forums/news-and-announcements.4/index.rss",
  "https://hypixel.net/forums/skyblock-patch-notes.158/index.rss"
];
const STATUS_FEED = "https://status.hypixel.net/history.rss";
const VERSION_URL = "https://api.hypixel.net/v2/resources/skyblock/skills";
const FIRE_SALES_URL = "https://api.hypixel.net/v2/skyblock/firesales";
const FIRE_SALES_FILE = "./data/firesales.json";

const NEWS_EVERY_MS = 3 * 60 * 1000;
const STATUS_EVERY_MS = 2 * 60 * 1000;
const VERSION_EVERY_MS = 2 * 60 * 1000;
const FIRE_SALES_EVERY_MS = 5 * 60 * 1000;
// Forum posts and incidents older than this are never announced (e.g. when a feed was down for a while).
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

let started = false;

function canChat() {
  return Boolean(global.bot?._client?.chat) && global.bot._client.state === "play";
}

/** Sends lines to guild chat 1.5 s apart (long ones are split by bot.chat). Returns false if not in game. */
async function announce(lines) {
  for (const line of lines) {
    if (!canChat()) {
      return false;
    }

    global.bot.chat(`/gc ${line}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return true;
}

function formatIn(ms) {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

// ---- Forum news -------------------------------------------------------------------------------------------

const seenNews = new Set();
let newsSeeded = false;

async function checkNews() {
  try {
    const feeds = await Promise.all(NEWS_FEEDS.map((url) => parser.parseURL(url)));
    const items = feeds.flatMap((feed) => feed.items ?? []);
    const fresh = [];

    for (const item of items) {
      const key = item.link || item.title;
      if (!key || seenNews.has(key)) {
        continue;
      }

      seenNews.add(key);
      const published = new Date(item.isoDate || item.pubDate).getTime();
      if (newsSeeded && Number.isFinite(published) && Date.now() - published < MAX_AGE_MS) {
        fresh.push(`[HYPIXEL UPDATE] ${item.title} | ${item.link}`);
      }
    }

    newsSeeded = true;
    await announce(fresh);
  } catch (error) {
    console.warn(`Minecraft > Hypixel news feed failed: ${error.message || error}`);
  }
}

// ---- status.hypixel.net -----------------------------------------------------------------------------------

const seenIncidents = new Map(); // title -> Set of update lines
let statusSeeded = false;

/** The updates of an incident, oldest first ("Resolved - This incident has been resolved." etc.). */
function incidentUpdates(incident) {
  return String(incident.contentSnippet ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((_, index) => index % 2 !== 0)
    .reverse();
}

async function checkStatus() {
  try {
    const { items } = await parser.parseURL(STATUS_FEED);
    const lines = [];

    for (const incident of items ?? []) {
      const published = new Date(incident.isoDate || incident.pubDate).getTime();
      if (Number.isFinite(published) && Date.now() - published > MAX_AGE_MS) {
        continue;
      }

      const title = incident.title;
      if (!seenIncidents.has(title)) {
        seenIncidents.set(title, new Set());
        if (statusSeeded) {
          lines.push(`[HYPIXEL STATUS] ${title} | ${incident.link}`);
        }
      }

      const seen = seenIncidents.get(title);
      for (const update of incidentUpdates(incident)) {
        if (seen.has(update)) {
          continue;
        }

        seen.add(update);
        if (statusSeeded) {
          lines.push(`[HYPIXEL STATUS UPDATE] ${title} | ${update}`);
        }
      }
    }

    statusSeeded = true;
    await announce(lines);
  } catch (error) {
    console.warn(`Minecraft > Hypixel status feed failed: ${error.message || error}`);
  }
}

// ---- Skyblock version -------------------------------------------------------------------------------------

let skyblockVersion;

async function checkVersion() {
  try {
    const { data } = await axios.get(VERSION_URL, { timeout: 15000 });
    if (!data?.version || data.version === skyblockVersion) {
      return;
    }

    const previous = skyblockVersion;
    skyblockVersion = data.version;

    if (previous !== undefined) {
      await announce([`[HYPIXEL SKYBLOCK] SkyBlock version ${previous} -> ${data.version}. Server restarts might occur!`]);
    }
  } catch (error) {
    console.warn(`Minecraft > Skyblock version check failed: ${error.message || error}`);
  }
}

// ---- Fire sales -------------------------------------------------------------------------------------------

function loadAnnouncedSales() {
  try {
    return new Set(JSON.parse(fs.readFileSync(FIRE_SALES_FILE, "utf8")));
  } catch {
    return null;
  }
}

function saveAnnouncedSales(keys) {
  try {
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data", { recursive: true });
    }
    fs.writeFileSync(FIRE_SALES_FILE, JSON.stringify([...keys]));
  } catch (error) {
    console.warn(`Minecraft > Could not save ${FIRE_SALES_FILE}: ${error.message || error}`);
  }
}

/** "[FIRE SALE] Tribal Orc Reaper Mask Skin: 3,000x for 950 Gems | starts in 18h, ends in 5d" */
async function fireSaleLine(sale) {
  const name = await getItemName(sale.item_id);
  const now = Date.now();
  const when =
    now < sale.start ? `starts in ${formatIn(sale.start - now)}, ends in ${formatIn(sale.end - now)}` : `ends in ${formatIn(sale.end - now)}`;

  return `[FIRE SALE] ${name}: ${Number(sale.amount).toLocaleString("en-US")}x for ${Number(sale.price).toLocaleString("en-US")} Gems | ${when}`;
}

async function checkFireSales() {
  try {
    const { data } = await axios.get(FIRE_SALES_URL, { timeout: 15000 });
    const sales = (data?.sales ?? []).filter((sale) => sale?.item_id && sale.end > Date.now());
    const keyOf = (sale) => `${sale.item_id}:${sale.start}`;

    const announced = loadAnnouncedSales();
    const fresh = sales.filter((sale) => !announced?.has(keyOf(sale)));
    if (announced !== null && fresh.length === 0) {
      return;
    }

    // The very first run (no file yet) only remembers what's already on sale, so old sales aren't posted.
    if (announced !== null) {
      const lines = await Promise.all(fresh.map(fireSaleLine));
      if (!(await announce(lines))) {
        return; // not in game right now: try again next time
      }
    }

    // Keep only sales that still run, so the file stays small.
    saveAnnouncedSales(new Set(sales.map(keyOf)));
  } catch (error) {
    console.warn(`Minecraft > Fire sale check failed: ${error.message || error}`);
  }
}

// ---- Start ------------------------------------------------------------------------------------------------

/** Starts the checks once (safe to call on every connect). */
function startSkyblockNotifier() {
  const settings = config.minecraft?.hypixelUpdates;
  if (started || settings?.enabled !== true) {
    return;
  }

  started = true;

  const every = (check, ms) => {
    check();
    setInterval(check, ms);
  };

  if (settings.hypixelNews === true) {
    every(checkNews, NEWS_EVERY_MS);
  }

  if (settings.statusUpdates === true) {
    every(checkStatus, STATUS_EVERY_MS);
  }

  if (settings.skyblockVersion === true) {
    every(checkVersion, VERSION_EVERY_MS);
  }

  if (settings.fireSales !== false) {
    every(checkFireSales, FIRE_SALES_EVERY_MS);
  }
}

module.exports = { startSkyblockNotifier, fireSaleLine, incidentUpdates };
