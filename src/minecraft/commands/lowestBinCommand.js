const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { priceReply } = require("../utils/priceReply.js");

class LowestBinCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "lbin";
    this.aliases = ["lowestbin", "price"];
    this.description = "Lowest BIN of an item (pets: e.g. !lbin legendary ender dragon).";
    this.options = [
      {
        name: "item",
        description: "Item name, e.g. hyperion",
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
      return this.send(await priceReply(this.getArgs(message).join(" "), "bin"));
    } catch (error) {
      return this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = LowestBinCommand;
