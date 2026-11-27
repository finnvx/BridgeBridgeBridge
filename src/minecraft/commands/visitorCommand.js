const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const { getVisitorRarities } = require("../../../API/constants/gardenVisitors.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

const RARITY_ORDER = ["UNCOMMON", "RARE", "LEGENDARY", "MYTHIC", "SPECIAL"];

function titleCase(text) {
  return text.charAt(0) + text.slice(1).toLowerCase();
}

class VisitorCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "visitor";
    this.aliases = ["visitors"];
    this.description = "Garden visitors served by specified user, per rarity.";
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
      const [target] = this.getArgs(message);
      const { username, garden } = await getLatestProfile(target || player, { garden: true });

      const commissions = garden?.commission_data;
      if (!commissions) {
        return this.send(`${username} has no garden visitors yet.`);
      }

      const rarities = await getVisitorRarities();
      const completed = commissions.completed ?? {};
      const visits = commissions.visits ?? {};
      const number = (value) => (Number(value) || 0).toLocaleString("en-US");

      // Like the game's visitor stats: accepted / visited, in total and per rarity.
      const perRarity = {};
      let totalAccepted = 0;
      let totalVisits = 0;
      for (const id of new Set([...Object.keys(visits), ...Object.keys(completed)])) {
        const rarity = rarities[id] ?? "UNKNOWN";
        const accepted = Number(completed[id]) || 0;
        const visited = Number(visits[id]) || 0;

        perRarity[rarity] ??= { accepted: 0, visits: 0 };
        perRarity[rarity].accepted += accepted;
        perRarity[rarity].visits += visited;
        totalAccepted += accepted;
        totalVisits += visited;
      }

      const order = [...RARITY_ORDER, ...Object.keys(perRarity).filter((rarity) => !RARITY_ORDER.includes(rarity))];
      const rarityText = order
        .filter((rarity) => perRarity[rarity]?.visits > 0)
        .map((rarity) => `${titleCase(rarity)}: ${number(perRarity[rarity].accepted)}/${number(perRarity[rarity].visits)}`)
        .join(" | ");

      const unique = Number(commissions.unique_npcs_served) || 0;
      const uniqueVisited = Object.keys(visits).length;

      return this.send(
        `${username}'s Visitors: Unique Served: ${unique}/${uniqueVisited} | Total: ${number(totalAccepted)}/${number(totalVisits)} | ${rarityText}`
      );
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = VisitorCommand;
