// Shared answer for !bz and !lbin: finds the item, then answers with bazaar or lowest BIN prices.
// A bazaar item asked with !lbin (or an auction item asked with !bz) still gets the price it has.
const { findItem, getBazaarPrice, getLowestBin } = require("../../../API/functions/getPrices.js");
const { formatNumber } = require("../../contracts/helperFunctions.js");

const MAX_OTHERS_SHOWN = 3;

function price(number) {
  if (typeof number !== "number" || !Number.isFinite(number)) {
    return "none";
  }

  if (number >= 100000) {
    // "511.00M" -> "511M", "13.60M" -> "13.6M"
    return String(formatNumber(number, 2)).replace(/\.?0+(?=[A-Za-z]+$)/, "");
  }

  return number.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/**
 * @param {string} query what the player typed after the command
 * @param {"bazaar" | "bin"} preferred which price to look at first
 * @returns {Promise<string>}
 */
async function priceReply(query, preferred) {
  if (!query.trim()) {
    return preferred === "bazaar" ? "Usage: !bz <item>, e.g. !bz enchanted diamond" : "Usage: !lbin <item>, e.g. !lbin hyperion";
  }

  const item = await findItem(query);
  if (!item) {
    return `No item found for "${query.trim()}".`;
  }

  // Pets: one line with every level that has its own price ("PET-X-RARITY" = any level, "-100", "-200").
  const pet = item.id.match(/^(PET-.+-[A-Z_]+?)(?:-\d+)?$/);
  if (pet) {
    return petReply(item, pet[1]);
  }

  const [bazaar, lowestBin] = await Promise.all([getBazaarPrice(item.id), getLowestBin(item.id)]);

  const bazaarText = bazaar ? `Insta-Buy ${price(bazaar.instaBuy)} | Insta-Sell ${price(bazaar.instaSell)}` : null;
  const binText = lowestBin !== null ? `Lowest BIN ${price(lowestBin)}` : null;

  // Bazaar items always get the bazaar price (their few BIN auctions are no real price), so `preferred`
  // only matters for the message when an item has neither.
  const text = bazaarText ?? binText;
  if (!text) {
    return `${item.name} has no bazaar or auction price right now.`;
  }

  return `${item.name}: ${text}${alsoText(item.others)}`;
}

function alsoText(others) {
  if (others.length === 0) {
    return "";
  }
  const shown = others.slice(0, MAX_OTHERS_SHOWN).join(", ");
  const more = others.length > MAX_OTHERS_SHOWN ? ` and ${others.length - MAX_OTHERS_SHOWN} more` : "";
  return ` | Also: ${shown}${more}`;
}

const PET_LEVELS = [
  ["", "Any level"],
  ["-100", "Lvl 100"],
  ["-200", "Lvl 200"]
];

/** "Golden Dragon (Legendary): Lowest BIN Any level 620M | Lvl 100 664M | Lvl 200 848M" */
async function petReply(item, baseId) {
  const prices = await Promise.all(PET_LEVELS.map(([suffix]) => getLowestBin(baseId + suffix)));
  const parts = PET_LEVELS.map(([, label], i) => (prices[i] !== null ? `${label} ${price(prices[i])}` : null)).filter(Boolean);

  const name = item.name.replace(/ Lvl \d+$/, "");
  if (parts.length === 0) {
    return `${name} has no auction price right now.`;
  }

  // Levels are already in the answer, so other matches are listed once per pet and rarity.
  const others = [...new Set(item.others.map((other) => other.replace(/ Lvl \d+$/, "")))].filter((other) => other !== name);
  return `${name}: Lowest BIN ${parts.join(" | ")}${alsoText(others)}`;
}

module.exports = { priceReply };
