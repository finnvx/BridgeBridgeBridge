const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

// Kills/ores needed for each pet rarity (Common .. Legendary), from player_stats.pets.milestone.
const MILESTONES = [
  { name: "Rock", key: "ores_mined", unit: "ores", tiers: [2500, 7500, 20000, 100000, 250000] },
  { name: "Dolphin", key: "sea_creatures_killed", unit: "sea creatures", tiers: [250, 1000, 2500, 5000, 10000] }
];

function format(number) {
  return Math.floor(number).toLocaleString("en-US");
}

class MilestonesCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "milestones";
    this.aliases = ["milestone", "petmilestones"];
    this.description = "Rock and Dolphin pet milestones of specified user.";
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
      const { username, profile } = await getLatestProfile(target || player);

      const counts = profile?.player_stats?.pets?.milestone ?? {};

      const parts = MILESTONES.map(({ name, key, unit, tiers }) => {
        const count = Number(counts[key]) || 0;
        const reached = tiers.filter((needed) => count >= needed).length;

        if (reached === tiers.length) {
          return `${name}: ${format(count)} ${unit} (Legendary, maxed)`;
        }

        const status = reached === 0 ? "none yet" : RARITIES[reached - 1];
        return `${name}: ${format(count)} ${unit} (${status}, ${format(tiers[reached] - count)} to ${RARITIES[reached]})`;
      });

      return this.send(`${username}'s Pet Milestones: ${parts.join(" | ")}`);
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = MilestonesCommand;
