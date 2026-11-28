const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

// "X the Fish" collected for Coral (foraging.fish_family). The game counts 32 of them; Hypixel's item list has
// a few more "_THE_FISH" items that don't count, so the total is set by hand.
const TOTAL_FISH = 32;

class CoralCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "coral";
    this.aliases = ["fishfamily", "thefish"];
    this.description = "How many of Coral's \"the Fish\" a player has found.";
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

      const found = new Set(profile?.foraging?.fish_family ?? []).size;
      if (found === 0) {
        return this.send(`${username} hasn't found any of the Fish yet.`);
      }

      return this.send(`${username}'s Fish Family: ${found}/${TOTAL_FISH}${found >= TOTAL_FISH ? " (all found!)" : ""}`);
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = CoralCommand;
