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

  const [bazaar, lowestBin] = await Promise.all([getBazaarPrice(item.id), getLowestBin(item.id)]);

  const bazaarText = bazaar ? `Insta-Buy ${price(bazaar.instaBuy)} | Insta-Sell ${price(bazaar.instaSell)}` : null;
  const binText = lowestBin !== null ? `Lowest BIN ${price(lowestBin)}` : null;

  // Bazaar items always get the bazaar price (their few BIN auctions are no real price), so `preferred`
  // only matters for the message when an item has neither.
  const text = bazaarText ?? binText;
  if (!text) {
    return `${item.name} has no bazaar or auction price right now.`;
  }

  let reply = `${item.name}: ${text}`;
  if (item.others.length > 0) {
    const shown = item.others.slice(0, MAX_OTHERS_SHOWN).join(", ");
    const more = item.others.length > MAX_OTHERS_SHOWN ? ` and ${item.others.length - MAX_OTHERS_SHOWN} more` : "";
    reply += ` | Also: ${shown}${more}`;
  }

  return reply;
}

module.exports = { priceReply };
