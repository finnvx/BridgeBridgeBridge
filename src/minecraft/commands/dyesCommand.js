const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { fetchDyes, loadDyes, currentSkyblockYear, skyblockYearStart } = require("../other/dyesTracker.js");

function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${rest}m`;
  }

  return `${rest}m`;
}

function formatDyes(data) {
  const dyes = data.dyes.map((dye) => `${dye.name} ${dye.multiplier}x`).join(", ");
  const nextYear = data.year + 1;
  const startsIn = formatDuration(skyblockYearStart(nextYear) - Date.now());

  return `SkyBlock Year ${data.year}: ${dyes} | Year ${nextYear} starts in ${startsIn}`;
}

class DyesCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "dyes";
    this.aliases = ["dye"];
    this.description = "Boosted dyes of the current SkyBlock year (officers: !dyes refresh).";
    this.options = [];
  }

  /**
   * @param {string} player
   * @param {string} message
   */
  async onCommand(player, message) {
    const [, subcommand] = message.trim().split(/ +/);

    try {
      if (subcommand?.toLowerCase() === "refresh") {
        if (!this.officer) {
          return this.send("Only officers can refresh the dyes (use it in officer chat).");
        }

        this.send("Reading /dyes, this takes about a minute...");
        const data = await fetchDyes(this.minecraft);
        return this.send(formatDyes(data));
      }

      const year = currentSkyblockYear();
      const data = loadDyes();

      if (!data || data.year !== year) {
        return this.send(`The dyes for SkyBlock Year ${year} aren't loaded yet, try again in a few minutes.`);
      }

      return this.send(formatDyes(data));
    } catch (error) {
      console.warn("Minecraft > dyesCommand error:", error);
      return this.send(`Couldn't read /dyes: ${error.message || error}`);
    }
  }
}

module.exports = DyesCommand;
