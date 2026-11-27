const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

// Order and names as in game; the API keys come from member.safari.tickets.
const TICKETS = [
  ["basic", "Basic"],
  ["economy", "Economy"],
  ["premium", "Premium"],
  ["first_class", "First-Class"]
];

class TicketsCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "tickets";
    this.aliases = ["ticket", "safaritickets"];
    this.description = "Safari Tickets of specified user.";
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
      const [, target] = message.trim().split(/ +/);
      const { username, profile } = await getLatestProfile(target || player);

      const tickets = profile?.safari?.tickets;
      if (!tickets) {
        return this.send(`${username} has no Safari Tickets.`);
      }

      const formatted = TICKETS.map(([key, label]) => `${label}: ${Number(tickets[key] ?? 0).toLocaleString("en-US")}`);
      const total = TICKETS.reduce((sum, [key]) => sum + Number(tickets[key] ?? 0), 0);

      return this.send(`${username}'s Safari Tickets: ${total.toLocaleString("en-US")} total | ${formatted.join(", ")}`);
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = TicketsCommand;
