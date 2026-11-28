// "@ffnn" in game chat becomes a Discord ping when that player linked their account with /verify (data/linked.json).
const { readFileSync } = require("fs");
const { getUUID } = require("../../contracts/API/mowojangAPI.js");
const { resolvePlayerAlias } = require("../../contracts/playerAliases.js");

const MENTION = /(^|\s)@([A-Za-z0-9_]{3,16})(?![A-Za-z0-9_])/g;
const MAX_MENTIONS = 5;

function linkedAccounts() {
  try {
    return JSON.parse(readFileSync("data/linked.json", "utf8")) ?? {};
  } catch {
    return {};
  }
}

/**
 * Replaces "@name" with "<@discordId>" for linked players. Names that aren't linked stay as they are.
 * @param {string} message
 * @returns {Promise<string>}
 */
async function linkMentions(message) {
  if (typeof message !== "string" || !message.includes("@")) {
    return message;
  }

  const names = [...new Set([...message.matchAll(MENTION)].map((match) => match[2].toLowerCase()))].slice(0, MAX_MENTIONS);
  if (names.length === 0) {
    return message;
  }

  const linked = linkedAccounts();
  const ids = {};
  await Promise.all(
    names.map(async (name) => {
      try {
        const uuid = String(await getUUID(resolvePlayerAlias(name))).replace(/-/g, "");
        if (linked[uuid]) {
          ids[name] = linked[uuid];
        }
      } catch {
        // not a Minecraft name
      }
    })
  );

  return message.replace(MENTION, (match, before, name) => (ids[name.toLowerCase()] ? `${before}<@${ids[name.toLowerCase()]}>` : match));
}

module.exports = { linkMentions };
