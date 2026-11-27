const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatNumber } = require("../../contracts/helperFunctions.js");
const { getHotf } = require("../../../API/stats/hotm.js");

class HotfCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "hotf";
    this.aliases = ["forest", "treeoftheforest"];
    this.description = "Skyblock Heart of the Forest Stats of specified user.";
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
   * */
  async onCommand(player, message) {
    try {
      const args = this.getArgs(message);
      player = args[0] || player;

      const { username, profile, profileData } = await getLatestProfile(player);

      const hotf = getHotf(profile);
      if (hotf == null) {
        throw `${username} has never gone to Galatea on ${profileData.cute_name}.`;
      }

      // Same layout as !hotm: level, the two currencies (now + spent), then the ability if one is picked.
      const parts = [
        `${username}'s Hotf: ${formatNumber(hotf.level.levelWithProgress, 2)}`,
        `Forest Whispers: ${formatNumber(hotf.whispers.forest.total)}`,
        `Desert Whispers: ${formatNumber(hotf.whispers.desert.total)}`,
        `Center of the Forest: ${hotf.centerOfTheForest}`
      ];

      if (hotf.ability !== "None") {
        parts.push(`Selected Ability: ${hotf.ability}`);
      }

      this.send(parts.join(" | "));
    } catch (error) {
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = HotfCommand;
