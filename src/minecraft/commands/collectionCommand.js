const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
// @ts-ignore
const { get } = require("axios");

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
const COLLECTIONS_MAX_AGE = 12 * 60 * 60 * 1000;

let collectionsCache = null;

/** All collections from Hypixel's public resource: [{ id, name, tiers: [amountRequired...] }] */
async function getCollections() {
  if (collectionsCache && Date.now() - collectionsCache.at < COLLECTIONS_MAX_AGE) {
    return collectionsCache.list;
  }

  const { data } = await get("https://api.hypixel.net/v2/resources/skyblock/collections", { timeout: 15000 });
  const list = [];
  for (const category of Object.values(data?.collections ?? {})) {
    for (const [id, item] of Object.entries(category.items ?? {})) {
      list.push({ id, name: item.name, tiers: (item.tiers ?? []).map((tier) => tier.amountRequired) });
    }
  }

  collectionsCache = { at: Date.now(), list };
  return list;
}

const normalize = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Best matching collection for what was typed, or null. */
function findCollection(list, query) {
  const wanted = normalize(query);
  if (!wanted) {
    return null;
  }

  return (
    list.find((entry) => normalize(entry.name) === wanted) ??
    list.find((entry) => normalize(entry.name).startsWith(wanted)) ??
    list.find((entry) => normalize(entry.id.replace(/_/g, " ")) === wanted) ??
    list.find((entry) => wanted.split(" ").every((word) => normalize(entry.name).split(" ").some((part) => part.startsWith(word)))) ??
    null
  );
}

class CollectionCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "collection";
    this.aliases = ["coll", "col"];
    this.description = "Collection amount and tier of an item. Usage: !collection [player] <item>";
    this.options = [
      {
        name: "item",
        description: "Collection, e.g. wheat or mithril (a player name can go first)",
        required: true
      }
    ];
  }

  /**
   * @param {string} player
   * @param {string} message
   */
  async onCommand(player, message) {
    try {
      const args = this.getArgs(message).filter(Boolean);
      if (args.length === 0) {
        return this.send("Usage: !collection [player] <item>, e.g. !collection wheat or !collection Teslanator mithril");
      }

      const list = await getCollections();

      // "!collection wheat" = own wheat; "!collection Teslanator wheat" = their wheat.
      let target = player;
      let collection = findCollection(list, args.join(" "));
      if (args.length > 1) {
        const withPlayer = findCollection(list, args.slice(1).join(" "));
        if (withPlayer && (!collection || normalize(collection.name) !== normalize(args.join(" ")))) {
          target = args[0];
          collection = withPlayer;
        }
      }

      if (!collection) {
        return this.send(`No collection found for "${args.join(" ")}".`);
      }

      const { username, profile } = await getLatestProfile(target);
      if (!profile?.collection || Object.keys(profile.collection).length === 0) {
        return this.send(`${username} has the Collections API turned off.`);
      }

      const amount = Number(profile.collection[collection.id]) || 0;
      const tier = collection.tiers.filter((required) => amount >= required).length;
      const max = collection.tiers.length;

      let status;
      if (tier >= max) {
        status = `Tier ${ROMAN[max] ?? max}, maxed`;
      } else {
        const next = collection.tiers[tier];
        const tierName = tier === 0 ? "0" : (ROMAN[tier] ?? tier);
        status = `Tier ${tierName}/${ROMAN[max] ?? max}, ${(next - amount).toLocaleString("en-US")} to ${ROMAN[tier + 1] ?? tier + 1}`;
      }

      return this.send(`${username}'s ${collection.name} Collection: ${amount.toLocaleString("en-US")} (${status})`);
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = CollectionCommand;
