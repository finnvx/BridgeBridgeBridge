const { getUUID, getUsername } = require("../../contracts/API/mowojangAPI.js");
const { getPlayerBingo, getCurrentBingo } = require("../../../API/functions/getBingo.js");
const { formatNumber } = require("../../contracts/helperFunctions.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

const EVENT_WORDS = ["event", "current", "card", "goals"];

function formatDuration(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** "10.0M" -> "10M", "328.1K" stays */
function short(number) {
  return String(formatNumber(number, 1)).replace(/\.0(?=[A-Za-z]+$)/, "");
}

function titleCase(text) {
  return String(text).charAt(0).toUpperCase() + String(text).slice(1).toLowerCase();
}

class BingoCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "bingo";
    this.aliases = [];
    this.description = "Bingo points and cards of specified user (!bingo event: current bingo).";
    this.options = [
      {
        name: "username",
        description: "Minecraft username, or 'event' for the current bingo",
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
      const [arg] = this.getArgs(message);

      if (arg && EVENT_WORDS.includes(arg.toLowerCase())) {
        return this.send(await this.eventText());
      }

      return this.send(await this.playerText(arg || player));
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }

  /** "Bingo November 2026 (Normal): ends in 2d 4h | Community: Operation: Ore 30.3M/10M (done), ..." */
  async eventText() {
    const bingo = await getCurrentBingo();
    const now = Date.now();

    let when;
    if (now < bingo.start) {
      when = `starts in ${formatDuration(bingo.start - now)}`;
    } else if (now < bingo.end) {
      when = `ends in ${formatDuration(bingo.end - now)}`;
    } else {
      when = "has ended";
    }

    const community = (bingo.goals ?? [])
      .filter((goal) => typeof goal.progress === "number" && Array.isArray(goal.tiers) && goal.tiers.length > 0)
      .map((goal) => {
        const target = goal.tiers[goal.tiers.length - 1];
        const done = goal.progress >= target ? " (done)" : "";
        return `${goal.name} ${short(goal.progress)}/${short(target)}${done}`;
      });

    const communityText = community.length > 0 ? ` | Community: ${community.join(", ")}` : "";
    return `Bingo ${bingo.name} (${titleCase(bingo.modifier ?? "Normal")}): ${when}${communityText}`;
  }

  /** "ffnn's Bingo: 7 events, 742 points total | Last: #56 111 points, 20 goals" */
  async playerText(name) {
    const uuid = await getUUID(name);
    const [username, events, current] = await Promise.all([getUsername(uuid), getPlayerBingo(uuid), getCurrentBingo().catch(() => null)]);

    if (events.length === 0) {
      return `${username} has never played Bingo.`;
    }

    const totalPoints = events.reduce((sum, event) => sum + (Number(event.points) || 0), 0);
    const last = events.reduce((a, b) => (Number(b.key) > Number(a.key) ? b : a));
    const goals = Array.isArray(last.completed_goals) ? last.completed_goals.length : 0;

    // Only the current bingo has a name in the API; older ones are shown by their number.
    const isCurrent = current && Number(last.key) === Number(current.id);
    const lastName = isCurrent ? `${current.name} (#${last.key})` : `#${last.key}`;
    const goalText = isCurrent && current.goals?.length ? `${goals}/${current.goals.length} goals` : `${goals} goals`;

    return `${username}'s Bingo: ${events.length} events, ${totalPoints.toLocaleString("en-US")} points total | Last: ${lastName} ${Number(last.points) || 0} points, ${goalText}`;
  }
}

module.exports = BingoCommand;
