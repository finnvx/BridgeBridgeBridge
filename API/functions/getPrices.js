// Item search and prices for !bz and !lbin. All sources are public, no API key:
// - Hypixel's item list (names) and bazaar API
// - lb.tricked.pro lowest BINs (also pets as "PET-ENDER_DRAGON-LEGENDARY" and "...-100")
// @ts-ignore
const { get } = require("axios");

const ITEMS_URL = "https://api.hypixel.net/v2/resources/skyblock/items";
const BAZAAR_URL = "https://api.hypixel.net/v2/skyblock/bazaar";
const LOWEST_BIN_URL = "https://lb.tricked.pro/lowestbins";

const ITEMS_MAX_AGE = 12 * 60 * 60 * 1000;
const BAZAAR_MAX_AGE = 60 * 1000;
const LOWEST_BIN_MAX_AGE = 5 * 60 * 1000;

const RARITIES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "DIVINE", "SPECIAL", "VERY_SPECIAL"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const caches = {};

/** Fetches a URL at most once per maxAge; on an error the old data stays in use. */
async function cached(url, maxAge, transform) {
  const entry = caches[url];
  if (entry && Date.now() - entry.at < maxAge) {
    return entry.data;
  }

  try {
    const { data } = await get(url, { timeout: 15000 });
    caches[url] = { at: Date.now(), data: transform(data) };
  } catch (error) {
    if (!entry) {
      throw "Couldn't load the prices right now, try again later.";
    }
  }

  return caches[url].data;
}

function titleCase(text) {
  return text
    .toLowerCase()
    .split(/[_ ]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/§./g, "")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const getItemNames = () =>
  cached(ITEMS_URL, ITEMS_MAX_AGE, (data) => {
    const names = {};
    for (const item of data?.items ?? []) {
      if (item?.id && item?.name) {
        names[item.id] = item.name.replace(/§./g, "");
      }
    }
    return names;
  });

const getBazaar = () => cached(BAZAAR_URL, BAZAAR_MAX_AGE, (data) => data?.products ?? {});

const getLowestBins = () => cached(LOWEST_BIN_URL, LOWEST_BIN_MAX_AGE, (data) => data ?? {});

/** Display names for ids that aren't in Hypixel's item list (books, pets). Returns [name, ...aliases]. */
function namesForId(id, itemNames) {
  if (itemNames[id]) {
    return [itemNames[id]];
  }

  // ENCHANTMENT_ULTIMATE_WISE_5 -> "Ultimate Wise 5" (also findable as "Ultimate Wise V")
  const book = id.match(/^ENCHANTMENT_(ULTIMATE_)?(.+)_(\d+)$/);
  if (book) {
    const name = titleCase(`${book[1] ? "ultimate " : ""}${book[2]}`);
    const level = Number(book[3]);
    return [`${name} ${level}`, `${name} ${ROMAN[level] ?? level}`];
  }

  // PET-ENDER_DRAGON-LEGENDARY(-100) -> "Ender Dragon (Legendary)" / "... Lvl 100"
  const pet = id.match(/^PET-(.+)-([A-Z_]+?)(?:-(\d+))?$/);
  if (pet && RARITIES.includes(pet[2])) {
    const base = `${titleCase(pet[1])} (${titleCase(pet[2])})`;
    const level = pet[3] ? ` Lvl ${pet[3]}` : "";
    return [`${base}${level}`, `${titleCase(pet[2])} ${titleCase(pet[1])}${level}`];
  }

  return [];
}

/**
 * Finds the item that best matches what the player typed.
 * @param {string} query
 * @returns {Promise<{ id: string, name: string, others: string[] } | null>}
 */
async function findItem(query) {
  const [itemNames, bazaar, lowestBins] = await Promise.all([getItemNames(), getBazaar(), getLowestBins()]);

  const wanted = normalize(query);
  const wantedWords = wanted.split(" ").filter(Boolean);
  if (wantedWords.length === 0) {
    return null;
  }

  const ids = new Set([...Object.keys(itemNames), ...Object.keys(bazaar), ...Object.keys(lowestBins)]);
  const matches = [];

  for (const id of ids) {
    const hasPrice = bazaar[id] !== undefined || lowestBins[id] !== undefined;
    const names = namesForId(id, itemNames);

    for (const name of [...names, id.replace(/[_-]+/g, " ")]) {
      const normalized = normalize(name);
      const words = normalized.split(" ");

      let score = 0;
      if (normalized === wanted) {
        score = 3;
      } else if (normalized.startsWith(wanted)) {
        score = 2;
      } else if (wantedWords.every((word) => words.some((part) => part.startsWith(word)))) {
        score = 1;
      }

      if (score > 0) {
        // Pets without a rarity in the search: the highest rarity first.
        const petRarity = id.match(/^PET-.+-([A-Z_]+?)(?:-\d+)?$/)?.[1];
        const rarityRank = petRarity ? RARITIES.indexOf(petRarity) : -1;
        const nameLength = normalized.replace(/\b(common|uncommon|rare|epic|legendary|mythic|divine|special|very)\b/g, "").length;

        matches.push({ id, name: names[0] ?? titleCase(id), score, hasPrice, rarityRank, length: nameLength });
        break;
      }
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Exact before prefix before word match, items with a price first, then the shortest name.
  matches.sort(
    (a, b) => b.score - a.score || Number(b.hasPrice) - Number(a.hasPrice) || a.length - b.length || b.rarityRank - a.rarityRank
  );

  const best = matches[0];
  const others = matches
    .slice(1)
    .filter((match) => match.score === best.score && match.hasPrice)
    .map((match) => match.name);

  return { id: best.id, name: best.name, others };
}

/**
 * Bazaar prices: insta-buy = cheapest sell offer, insta-sell = highest buy order.
 * @param {string} id
 */
async function getBazaarPrice(id) {
  const product = (await getBazaar())[id];
  if (!product) {
    return null;
  }

  return {
    instaBuy: product.buy_summary?.[0]?.pricePerUnit ?? product.quick_status?.buyPrice ?? null,
    instaSell: product.sell_summary?.[0]?.pricePerUnit ?? product.quick_status?.sellPrice ?? null
  };
}

/** @param {string} id */
async function getLowestBin(id) {
  const price = (await getLowestBins())[id];
  return typeof price === "number" ? price : null;
}

module.exports = { findItem, getBazaarPrice, getLowestBin };
