// The current dungeon XP boost (Hypixel event: +30% Catacombs and class XP). XP boosts are rare, so it's set
// here by hand instead of with a command. The run commands (!rtca, !rtc, ...) add it to their XP per run and
// say so in their answer. Set percent to 0 when the boost is over; `until` (ms) can end it automatically.
const XP_BOOST = {
  percent: 30,
  until: null // stays on until percent is set to 0
};

/** @returns {{ percent: number, until: number | null } | null} the active boost, or null */
function getXpBoost() {
  if (!(XP_BOOST.percent > 0) || (XP_BOOST.until && Date.now() > XP_BOOST.until)) {
    return null;
  }

  return XP_BOOST;
}

/** " (incl. 30% XP boost)" while the boost is active, else "" */
function xpBoostNote() {
  const boost = getXpBoost();
  return boost ? ` (incl. ${boost.percent}% XP boost)` : "";
}

module.exports = { getXpBoost, xpBoostNote };
