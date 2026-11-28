const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { delay } = require("../../contracts/helperFunctions.js");
// @ts-ignore
const { get } = require("axios");

class MayorCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "mayor";
    this.aliases = [];
    this.description = "Skyblock Mayor.";
    this.options = [];
  }

  /**
   * @param {string} player
   * @param {string} message
   * */
  async onCommand(player, message) {
    try {
      // CREDITS: by @Kathund (https://github.com/Kathund)
      const response = await get(`https://api.hypixel.net/v2/resources/skyblock/election`);
      if (response === undefined || response.data === undefined || response.data.success === false) {
        throw "Request to Hypixel API failed. Please try again!";
      }

      /** @type {import("../../../types/election.js").Mayor} */
      const data = response.data;

      this.send(
        `[MAYOR] ${data.mayor.name} is the current mayor of Skyblock! Perks: ${data.mayor.perks
          .map((perk) => perk.name)
          .join(", ")}, Minister Perk: ${data.mayor.minister?.perk?.name ?? "Unknown"}`
          .replaceAll("ez", "e-z")
          .replaceAll("EZ", "E-Z")
      );

      await delay(1000);
      // `current` is the running election; `mayor.election` is the one the current mayor already won.
      const candidates = [...(data.current?.candidates ?? [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));
      if (candidates.length === 0) {
        return this.send(`[MAYOR] No election is running right now.`);
      }

      const totalVotes = candidates.reduce((total, candidate) => total + (candidate.votes || 0), 0) || 1;
      const share = (candidate) => `${(((candidate.votes || 0) / totalVotes) * 100).toFixed(1)}%`;
      const [mayor, minister, ...rest] = candidates;

      const parts = [`${mayor.name} ${share(mayor)} (${mayor.perks.map((perk) => perk.name).join(", ")})`];
      if (minister) {
        const ministerPerk = minister.perks.find((perk) => perk.minister);
        parts.push(`Minister: ${minister.name} ${share(minister)}${ministerPerk ? ` (${ministerPerk.name})` : ""}`);
      }
      if (rest.length > 0) {
        parts.push(`Others: ${rest.map((candidate) => `${candidate.name} ${share(candidate)}`).join(", ")}`);
      }

      this.send(
        `[MAYOR] Year ${data.current.year} Election: ${parts.join(" | ")}`.replaceAll("ez", "e-z").replaceAll("EZ", "E-Z")
      );
    } catch (error) {
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = MayorCommand;
