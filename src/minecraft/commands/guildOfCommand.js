const minecraftCommand = require("../../contracts/minecraftCommand.js");
const hypixel = require("../../contracts/API/HypixelRebornAPI.js");
const { getUUID, getUsername } = require("../../contracts/API/mowojangAPI.js");
const { formatError } = require("../../contracts/helperFunctions.js");

function formatDate(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

class GuildOfCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "guildof";
    this.aliases = ["whatguild"];
    this.description = "Which guild a player is in, with their rank.";
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
      const uuid = await getUUID(target || player);
      const username = await getUsername(uuid);

      const guild = await hypixel.getGuild("player", uuid, { noCaching: false });
      if (!guild) {
        return this.send(`${username} is not in a guild.`);
      }

      const member = guild.members?.find((entry) => String(entry.uuid).replace(/-/g, "") === String(uuid).replace(/-/g, ""));
      const tag = guild.tag ? ` [${guild.tag}]` : "";
      const parts = [`${username} is in ${guild.name}${tag}`];

      if (member?.rank) {
        parts.push(`Rank: ${member.rank}`);
      }

      const joined = member?.joinedAt ? formatDate(member.joinedAt) : null;
      if (joined) {
        parts.push(`Joined: ${joined}`);
      }

      parts.push(`Level ${Math.floor(guild.level ?? 0)}`, `${guild.members?.length ?? 0}/125 members`);

      return this.send(parts.join(" | "));
    } catch (error) {
      return this.send(formatError(error));
    }
  }
}

module.exports = GuildOfCommand;
