const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

// Rare Diana mobs; counted from the bestiary, which keeps one entry per mob level (minos_inquisitor_750, ..._1250).
const RARE_MOBS = [
  ["Inquisitor", "minos_inquisitor_"],
  ["King Minos", "king_minos_"],
  ["Manticore", "manticore_"],
  ["Sphinx", "sphinx_"]
];

const number = (value) => (Number(value) || 0).toLocaleString("en-US");

class DianaCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "diana";
    this.aliases = ["mythos", "burrows"];
    this.description = "Diana (mythological ritual) stats of specified user.";
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

      const mythos = profile?.player_stats?.mythos;
      if (!mythos) {
        return this.send(`${username} has never done Diana.`);
      }

      // Every burrow is a start/next, a treasure or a mob burrow.
      const burrows = ["burrows_dug_next", "burrows_dug_treasure", "burrows_dug_combat"].reduce(
        (sum, key) => sum + (Number(mythos[key]?.total) || 0),
        0
      );

      const bestiary = profile?.bestiary?.kills ?? {};
      const rare = RARE_MOBS.map(([name, prefix]) => {
        const kills = Object.entries(bestiary)
          .filter(([key]) => key.startsWith(prefix))
          .reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
        return `${name} ${number(kills)}`;
      });

      return this.send(
        `${username}'s Diana: ${number(mythos.kills)} kills | ${number(mythos.burrows_chains_complete?.total)} chains | ${number(burrows)} burrows | ${rare.join(", ")}`
      );
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = DianaCommand;
