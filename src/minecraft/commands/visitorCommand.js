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

      // Accepted visitors per rarity (every time a visitor of that rarity was served).
      const perRarity = {};
      for (const [id, count] of Object.entries(completed)) {
        const rarity = rarities[id] ?? "UNKNOWN";
        perRarity[rarity] = (perRarity[rarity] ?? 0) + (Number(count) || 0);
      }

      const order = [...RARITY_ORDER, ...Object.keys(perRarity).filter((rarity) => !RARITY_ORDER.includes(rarity))];
      const rarityText = order
        .filter((rarity) => perRarity[rarity] > 0)
        .map((rarity) => `${titleCase(rarity)} ${perRarity[rarity].toLocaleString("en-US")}`)
        .join(", ");

      const served = Number(commissions.total_completed) || 0;
      const unique = Number(commissions.unique_npcs_served) || 0;

      return this.send(`${username}'s Visitors: ${served.toLocaleString("en-US")} accepted | ${unique} unique | ${rarityText}`);
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = VisitorCommand;
