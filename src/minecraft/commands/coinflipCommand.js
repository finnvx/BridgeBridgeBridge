const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { randomInt } = require("crypto");

const GUESSES = {
  heads: "Heads",
  head: "Heads",
  h: "Heads",
  tails: "Tails",
  tail: "Tails",
  t: "Tails"
};

class CoinflipCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "coinflip";
    this.aliases = ["cf", "flip", "coin"];
    this.description = "Flip a coin, optionally guess heads or tails.";
    this.options = [
      {
        name: "guess",
        description: "heads or tails",
        required: false
      }
    ];
  }

  /**
   * @param {string} player
   * @param {string} message
   */
  onCommand(player, message) {
    const [guessArg] = this.getArgs(message);
    const result = randomInt(2) === 0 ? "Heads" : "Tails";

    if (!guessArg) {
      return this.send(`${player} flipped a coin: ${result}!`);
    }

    const guess = GUESSES[guessArg.toLowerCase()];
    if (!guess) {
      return this.send(`${player}, guess heads or tails (e.g. !cf heads).`);
    }

    const outcome = guess === result ? "You won!" : "You lost.";
    return this.send(`${player} guessed ${guess}, the coin landed on ${result}. ${outcome}`);
  }
}

module.exports = CoinflipCommand;
