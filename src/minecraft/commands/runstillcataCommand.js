const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { xpBoostNote } = require("../other/xpBoost.js");

const {
  FLOORS,
  formatNumber,
  parsePositiveNumber,
  getFloorOrDefault,
  getMemberProfile,
  getDungeons,
  calculateRunsUntilCata,
} = require("../utils/dungeonRuns.js");

class RunsTillCataCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "runstillcata";
    this.aliases = ["rtc"];
    this.description = "Runs until Catacombs level.";
    this.dashPrefix = true;
  }

  async onCommand(player, message) {
    const [, ...args] = message.trim().split(/ +/);

    try {
      let target = args[0] || player;
      let targetLevel = 50;
      let floorInput = "m7";

      if (FLOORS[target?.toLowerCase?.()]) {
        floorInput = target.toLowerCase();
        target = player;
      } else {
        targetLevel = parsePositiveNumber(args[1], 50);
        floorInput = args[2] || "m7";

        if (FLOORS[String(args[1] || "").toLowerCase()]) {
          targetLevel = 50;
          floorInput = args[1];
        }
      }

      const floor = getFloorOrDefault(floorInput);

      const { username, profile } = await getLatestProfile(target);
      const memberProfile = getMemberProfile(profile);
      const dungeons = getDungeons(profile);

      const result = await calculateRunsUntilCata(dungeons, floor, memberProfile, targetLevel);

      if (result.runs <= 0) {
        return this.send(`${username} is already Catacombs ${targetLevel}, gg :)`);
      }

      return this.send(
        `It will take ${formatNumber(result.runs)} ${floor.label} runs for ${username} to reach cata ${targetLevel}${xpBoostNote()}`
      );
    } catch (error) {
      console.error(error);
      return this.send("Could not calculate runs until Catacombs level.");
    }
  }
}

module.exports = RunsTillCataCommand;