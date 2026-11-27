const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

// A Nucleus run places all five crystals, so the runs are the lowest "total_placed" of the five (as SkyCrypt counts them).
const NUCLEUS_CRYSTALS = ["jade_crystal", "amber_crystal", "amethyst_crystal", "sapphire_crystal", "topaz_crystal"];

class NucleusCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "nucleus";
    this.aliases = ["runs", "nucleusruns"];
    this.description = "Crystal Nucleus runs of specified user.";
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

      const crystals = profile?.mining_core?.crystals;
      if (!crystals) {
        return this.send(`${username} has never been to the Crystal Hollows.`);
      }

      const runs = Math.min(...NUCLEUS_CRYSTALS.map((crystal) => Number(crystals[crystal]?.total_placed) || 0));

      return this.send(`${username}'s Nucleus Runs: ${runs.toLocaleString("en-US")}`);
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = NucleusCommand;
