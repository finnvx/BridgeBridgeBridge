const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

// foraging.starlyn.personal_bests: Agatha's and Miria's contests plus one best per log type.
const CONTESTS = [
  ["Agatha", "agatha"],
  ["Miria", "miria"]
];

const number = (value) => (Number(value) || 0).toLocaleString("en-US");

function titleCase(text) {
  return text
    .toLowerCase()
    .replace(/_log$/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

class StarlynCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "starlyn";
    this.aliases = ["foragingpb", "agatha"];
    this.description = "Starlyn personal bests (Agatha, Miria and per log type) of specified user.";
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

      const bests = profile?.foraging?.starlyn?.personal_bests;
      if (!bests || Object.keys(bests).length === 0) {
        return this.send(`${username} has no Starlyn personal bests yet.`);
      }

      const contests = CONTESTS.filter(([, key]) => bests[key] !== undefined).map(([name, key]) => `${name} ${number(bests[key])}`);
      const logs = Object.entries(bests)
        .filter(([key]) => /_LOG$/i.test(key))
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => `${titleCase(key)} ${number(value)}`);

      const parts = [contests.join(", "), logs.join(", ")].filter(Boolean);
      return this.send(`${username}'s Starlyn PBs: ${parts.join(" | ")}`);
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = StarlynCommand;
