const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");

// All fairy souls since the Galatea/Safari ones (NEU repo constants/fairy_souls.json, "Max Souls").
const MAX_FAIRY_SOULS = 289;

class FairySoulsCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "fairysouls";
    this.aliases = ["fs"];
    this.description = "Fairy Souls of specified user.";
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

      const total = profileData.game_mode === "island" ? 5 : MAX_FAIRY_SOULS;
      const fairy_soul = profile.fairy_soul;
      this.send(`${username}'s Fairy Souls: ${fairy_soul.total_collected} / ${total} | Progress: ${((fairy_soul.total_collected / total) * 100).toFixed(2)}%`);
    } catch (error) {
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = FairySoulsCommand;
