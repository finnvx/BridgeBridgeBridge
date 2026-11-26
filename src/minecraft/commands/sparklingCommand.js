const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

// All Safari critters (API id -> in-game name). Critters the API reports that are missing here still count.
const CRITTERS = {
  CAVERNFISH: "Cavernfish",
  FLITTER: "Flitter",
  SHYWORM: "Shyworm",
  DRIFTLING: "Driftling",
  CHUCKWALLA: "Chuckwalla",
  ROCKMITE: "Rockmite",
  SCRAPPY: "Scrappy",
  SNOOZLE: "Snoozle",
  GEMZIE: "Gemzie",
  FOXTROT: "Foxtrot",
  BLUEBIRD: "Bluebird",
  HONEYBUG: "Honeybug",
  TREEFROG: "Treefrog",
  WOODCHUCKER: "Woodchucker",
  FLUFFLING: "Fluffling",
  HIDEONFLOOR: "Hideonfloor",
  PARAKEET: "Parakeet",
  MACAW: "Macaw",
  AREITA: "Areita",
  BLOODBAT: "Bloodbat",
  DUPLICO: "Duplico",
  GAZER: "Gazer",
  LITTERBUG: "Litterbug",
  SOLSNATCHER: "Solsnatcher",
  GIMMIEGOLD: "Gimmiegold",
  HIDEONWALL: "Hideonwall",
  HIDEYHO: "Hideyho",
  DOOMSPIRAL: "Doomspiral",
  STRONGARM: "Strongarm",
  TEPID: "Tepid",
  POLARIS: "Polaris",
  SHUDDERSQUID: "Shuddersquid",
  BILLYGOAT: "Billygoat",
  MANTIS_SHRIMP: "Mantis Shrimp",
  NOZZLENOSE: "Nozzlenose",
  TROODON: "Troodon",
  WUMPA: "Wumpa"
};

const MAX_MISSING_SHOWN = 10;

function critterName(id) {
  return CRITTERS[id] ?? id.toLowerCase().replace(/(^|_)(\w)/g, (_, space, letter) => (space ? " " : "") + letter.toUpperCase());
}

class SparklingCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "sparkling";
    this.aliases = ["sparkle", "sparkles"];
    this.description = "Sparkling critters of specified user (uniques, total caught, missing).";
    this.options = [
      {
        name: "username",
        description: "Minecraft username",
        required: false
      }
    ];
  }

  /**
   * @param {string} player
   * @param {string} message
   */
  async onCommand(player, message) {
    try {
      const [, target] = message.trim().split(/ +/);
      const { username, profile } = await getLatestProfile(target || player);

      const safari = profile?.safari;
      if (!safari) {
        return this.send(`${username} hasn't been to the Safari yet.`);
      }

      const found = new Set(safari.discovered_sparkling_critters ?? []);
      const all = new Set([...Object.keys(CRITTERS), ...(safari.discovered_critters ?? []), ...found]);
      const total = Number(safari.total_captured_sparkling_critters ?? 0).toLocaleString("en-US");
      const missing = [...all].filter((id) => !found.has(id)).map(critterName).sort();

      const summary = `${username}'s Sparkling Critters: ${found.size}/${all.size} uniques, ${total} caught`;

      if (missing.length === 0) {
        return this.send(`${summary} | All found!`);
      }

      // Keep the message short: list at most 10 missing critters.
      const shown = missing.slice(0, MAX_MISSING_SHOWN).join(", ");
      const more = missing.length > MAX_MISSING_SHOWN ? ` and ${missing.length - MAX_MISSING_SHOWN} more` : "";

      return this.send(`${summary} | Missing: ${shown}${more}`);
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = SparklingCommand;
