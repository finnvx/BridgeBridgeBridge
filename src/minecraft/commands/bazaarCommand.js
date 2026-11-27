const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { priceReply } = require("../utils/priceReply.js");

class BazaarCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "bz";
    this.aliases = ["bazaar"];
    this.description = "Bazaar price of an item (insta-buy and insta-sell).";
    this.options = [
      {
        name: "item",
        description: "Item name, e.g. enchanted diamond",
        required: true
      }
    ];
  }

  /**
   * @param {string} player
   * @param {string} message
   */
  async onCommand(player, message) {
    try {
      return this.send(await priceReply(this.getArgs(message).join(" "), "bazaar"));
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = BazaarCommand;
