// Known essences in display order; any other type the API adds later is appended after them.
const ESSENCE_ORDER = ["DIAMOND", "DRAGON", "SPIDER", "WITHER", "UNDEAD", "GOLD", "ICE", "CRIMSON", "FOREST", "SAFARI"];

/**
 * Returns the essence of a profile.
 * @param {import("../../types/profiles").Member} profile
 * @returns {import("./essence.types").Essence | null}
 */
function getEssence(profile) {
  try {
    const essence = profile.currencies?.essence ?? {};
    const types = [...ESSENCE_ORDER, ...Object.keys(essence).filter((type) => !ESSENCE_ORDER.includes(type))];
    return Object.fromEntries(types.map((type) => [type.toLowerCase(), essence[type]?.current || 0]));
  } catch (error) {
    console.error(error);
    return null;
  }
}

module.exports = {
  getEssence
};
