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

      // Unique visitors served per rarity: served at least once / all visitors of that rarity.
      const perRarity = {};
      for (const [id, rarity] of Object.entries(rarities)) {
        perRarity[rarity] ??= { served: 0, total: 0 };
        perRarity[rarity].total++;
        if ((Number(completed[id]) || 0) > 0) {
          perRarity[rarity].served++;
        }
      }

      const order = [...RARITY_ORDER, ...Object.keys(perRarity).filter((rarity) => !RARITY_ORDER.includes(rarity))];
      const rarityText = order
        .filter((rarity) => perRarity[rarity])
        .map((rarity) => `${titleCase(rarity)} ${perRarity[rarity].served}/${perRarity[rarity].total}`)
        .join(", ");

      const served = Number(commissions.total_completed) || 0;
      const unique = Number(commissions.unique_npcs_served) || 0;

      return this.send(
        `${username}'s Visitors: ${served.toLocaleString("en-US")} served | ${unique} unique | ${rarityText}`
      );
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = VisitorCommand;
