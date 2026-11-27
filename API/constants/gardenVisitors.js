// Garden visitor rarities from the NEU repo (constants/garden.json "visitors": id -> rarity).
// The Hypixel API only has visitor ids, so the rarity comes from there; reloaded every 12 hours.
// @ts-ignore
const { get } = require("axios");

const URL = "https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/constants/garden.json";
const RELOAD_MS = 12 * 60 * 60 * 1000;

// NEU lists these as Rare, the game counts them as Uncommon (checked against the in-game visitor stats).
const OVERRIDES = {
  bednom: "UNCOMMON",
  farm_merchant: "UNCOMMON"
};

let visitors = null;
let loadedAt = 0;

/** @returns {Promise<Record<string, string>>} visitor id -> rarity ("UNCOMMON", "RARE", "LEGENDARY", "MYTHIC", "SPECIAL") */
async function getVisitorRarities() {
  if (visitors && Date.now() - loadedAt < RELOAD_MS) {
    return visitors;
  }

  try {
    const { data } = await get(URL, { timeout: 10000 });
    if (data?.visitors && typeof data.visitors === "object") {
      visitors = { ...data.visitors, ...OVERRIDES };
      loadedAt = Date.now();
    }
  } catch (error) {
    if (!visitors) {
      throw "Couldn't load the visitor list, try again later.";
    }
  }

  return visitors;
}

module.exports = { getVisitorRarities };
