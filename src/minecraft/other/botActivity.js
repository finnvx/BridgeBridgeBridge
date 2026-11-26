// Tracks what the Minecraft bot is busy with (e.g. "warp", "dyes"), so two tasks
// that move the bot around (lobby -> SkyBlock -> limbo) never run at the same time.
let current = null;

module.exports = {
  /** @returns {string|null} */
  busyWith() {
    return current;
  },

  /**
   * @param {string} name
   * @returns {boolean} false if something else is already running
   */
  tryStart(name) {
    if (current !== null && current !== name) {
      return false;
    }

    current = name;
    return true;
  },

  /** @param {string} name */
  end(name) {
    if (current === name) {
      current = null;
    }
  }
};
