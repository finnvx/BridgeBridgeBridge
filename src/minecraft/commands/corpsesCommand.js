const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

const CORPSES = [
  ["Lapis", "lapis"],
  ["Umber", "umber"],
  ["Tungsten", "tungsten"],
  ["Vanguard", "vanguard"]
];

const number = (value) => (Number(value) || 0).toLocaleString("en-US");

class CorpsesCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "corpses";
    this.aliases = ["corpse", "mineshafts", "mineshaft"];
    this.description = "Glacite Mineshaft corpses looted and mineshafts entered of specified user.";
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

      const glacite = profile?.glacite_player_data;
      if (!glacite) {
        return this.send(`${username} has never been to the Glacite Mineshafts.`);
      }

      const looted = glacite.corpses_looted ?? {};
      const total = CORPSES.reduce((sum, [, key]) => sum + (Number(looted[key]) || 0), 0);
      const parts = CORPSES.map(([name, key]) => `${name} ${number(looted[key])}`);

      return this.send(
        `${username}'s Corpses: ${number(total)} looted (${parts.join(", ")}) | Mineshafts entered: ${number(glacite.mineshafts_entered)}`
      );
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = CorpsesCommand;
