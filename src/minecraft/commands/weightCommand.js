const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const { getSenitherWeight, getLilyWeight, getColeweight, getEliteWeight } = require("../../../API/weight/index.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

const number = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");

class WeightCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "weight";
    this.aliases = ["w"];
    this.description = "Senither, Lily, Coleweight and farming weight (eliteskyblock.com) of specified user.";
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
      const { username, rawUsername, profile, profileData, uuid } = await getLatestProfile(target || player);

      const senither = getSenitherWeight(profile);
      const lily = getLilyWeight(profile);
      const [cole, elite] = await Promise.all([getColeweight(rawUsername || target || player), getEliteWeight(uuid, profileData.profile_id)]);

      const parts = [
        `Senither ${number(senither.total)} (Skills ${number(senither.skill)}, Slayer ${number(senither.slayer)}, Dungeons ${number(senither.dungeon)})`,
        `Lily ${number(lily.total)}`
      ];

      if (cole) {
        parts.push(`Coleweight ${number(cole.coleweight)}${cole.rank ? ` (#${cole.rank.toLocaleString("en-US")})` : ""}`);
      }

      // Farming weight from eliteskyblock.com
      if (elite) {
        parts.push(`Farming ${number(elite.weight)}${elite.rank ? ` (#${elite.rank.toLocaleString("en-US")})` : ""}`);
      }

      return this.send(`${username}'s Weight: ${parts.join(" | ")}`);
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = WeightCommand;
