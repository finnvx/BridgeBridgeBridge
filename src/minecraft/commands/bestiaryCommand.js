const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatNumber } = require("../../contracts/helperFunctions.js");

class BestiaryCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "bestiary";
    this.aliases = ["be"];
    this.description = "Bestiary of specified user.";
    this.options = [
      {
        name: "username",
        description: "Mincraft Username",
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
      player = args[0] ?? player;

      const { username, profile } = await getLatestProfile(player);

      if (!profile?.bestiary?.kills) {
        return this.send("This player has not yet joined SkyBlock since the bestiary update.");
      }

      // Hypixel has 359 families now, the public lists (NEU 257, SkyCrypt 208) don't, so tiers computed from
      // them come out too low. Hypixel saves "last_claimed_milestone" one above the milestone the game shows
      // (API 513 = "Bestiary Milestone 512" with 5,125 tiers in game), so it's shown minus one.
      const lastClaimed = Number(profile.bestiary.milestone?.last_claimed_milestone) || 0;
      const milestone = Math.max(0, lastClaimed - 1);
      const kills = Object.entries(profile.bestiary.kills).filter(([key, value]) => key !== "last_killed_mob" && typeof value === "number");
      const totalKills = kills.reduce((sum, [, value]) => sum + value, 0);

      this.send(`${username}'s Bestiary: Milestone ${milestone} | Kills: ${formatNumber(totalKills, 2)} | Mob types killed: ${kills.length}`);
    } catch (error) {
      console.error(error);
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = BestiaryCommand;
