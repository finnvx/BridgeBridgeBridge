const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { getGarden } = require("../../../API/stats/garden.js");

class GardenCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "garden";
    this.aliases = [];
    this.description = "Skyblock Garden Stats of specified user.";
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
      // CREDITS: by @Kathund (https://github.com/Kathund)
      const args = this.getArgs(message);
      player = args[0] || player;

      const { username, profile, garden } = await getLatestProfile(player, { garden: true });
      if (!garden) {
        return this.send(`[ERROR] ${username} does not have a garden.`);
      }

      const gardenData = getGarden(garden);
      if (!gardenData) {
        return this.send(`[ERROR] ${username} does not have a garden.`);
      }

      const crops = gardenData.cropMilesstone;
      const milestones = [
        ["Wheat", crops.wheat],
        ["Carrot", crops.carrot],
        ["Potato", crops.potato],
        ["Pumpkin", crops.pumpkin],
        ["Melon", crops.melon],
        ["Cane", crops.sugarCane],
        ["Cocoa", crops.cocoaBeans],
        ["Cactus", crops.cactus],
        ["Mushroom", crops.mushroom],
        ["Wart", crops.netherWart],
        ["Sunflower", crops.sunflower],
        ["Moonflower", crops.moonflower],
        ["Wild Rose", crops.wildRose]
      ].map(([name, level]) => `${name} ${level.level}`);

      const copper = Number(profile?.garden_player_data?.copper ?? 0).toLocaleString("en-US");

      this.send(`${username}'s Garden ${gardenData.level.level} | Copper: ${copper} | Crop Milestones: ${milestones.join(", ")}`);
    } catch (error) {
      console.log(error);
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = GardenCommand;
