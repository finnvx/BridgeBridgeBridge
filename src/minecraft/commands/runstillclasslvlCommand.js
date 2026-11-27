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
  getClassDefinition,
  calculateRunsUntilClassLevel,
} = require("../utils/dungeonRuns.js");

class RunsTillClassLevelCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "runstillclasslvl";
    this.aliases = [];
    this.description = "Runs until Class level.";
    this.dashPrefix = true;
  }

  async onCommand(player, message) {
    const [, ...args] = message.trim().split(/ +/);

    try {
      let target = args[0] || player;
      let classInput = args[1];
      let targetLevel = parsePositiveNumber(args[2], 50);
      let floorInput = args[3] || "m7";
      let playingClassInput = args[4];

      if (getClassDefinition(target)) {
        classInput = target;
        target = player;
        targetLevel = parsePositiveNumber(args[1], 50);
        floorInput = args[2] || "m7";
        playingClassInput = args[3];
      }

      const targetClass = getClassDefinition(classInput);
      if (!targetClass) {
        return this.send("Unknown class.");
      }

      if (FLOORS[String(floorInput || "").toLowerCase()] === undefined && getClassDefinition(floorInput)) {
        playingClassInput = floorInput;
        floorInput = "m7";
      }

      const floor = getFloorOrDefault(floorInput);
      const playingClass = getClassDefinition(playingClassInput) ?? targetClass;

      const { username, profile } = await getLatestProfile(target);
      const memberProfile = getMemberProfile(profile);
      const dungeons = getDungeons(profile);

      const result = await calculateRunsUntilClassLevel(
        dungeons,
        floor,
        memberProfile,
        targetClass.short,
        targetLevel,
        playingClass.short
      );

      if (result.runs <= 0) {
        return this.send(`${username} is already ${targetClass.display} ${targetLevel}, gg :)`);
      }

      return this.send(
        `It will take ${formatNumber(result.runs)} ${floor.label} runs for ${username} to reach ${targetClass.display} level ${targetLevel} (playing class: ${result.playingClass.display})${xpBoostNote()}`
      );
    } catch (error) {
      console.error(error);
      return this.send("Could not calculate runs until Class level.");
    }
  }
}

module.exports = RunsTillClassLevelCommand;