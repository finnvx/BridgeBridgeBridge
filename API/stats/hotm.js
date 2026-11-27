const CONSTANTS = require("../constants/mining.js");
const { getLevelByXp } = require("../constants/skills.js");

function getFirstNumber(obj, keys) {
  if (!obj) return null;

  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function getPath(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function formatAbility(rawAbility) {
  if (typeof rawAbility !== "string" || rawAbility.trim() === "") return "None";

  const normalized = rawAbility.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  const mapped = CONSTANTS.hotm.perks?.[normalized]?.name;
  if (mapped) return mapped;

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Returns the player's HotM stats.
 * @param {import("../../types/profiles.js").Member} profile
 * @returns {import("./hotm.types").HotM | null}
 */
function getHotm(profile) {
  try {
    if (!profile?.mining_core) {
      return null;
    }

    const miningCore = profile.mining_core;
    const skillTree = profile.skill_tree ?? {};

    const mithrilCurrent =
      getFirstNumber(miningCore, ["powder_mithril_total", "mithril_powder_total"]) ?? 0;
    const mithrilSpent =
      getFirstNumber(miningCore, ["powder_spent_mithril", "mithril_powder_spent"]) ?? 0;
    const mithrilTotal =
      getFirstNumber(miningCore, ["powder_mithril", "mithril_powder"]) ?? (mithrilCurrent + mithrilSpent);

    const gemstoneCurrent =
      getFirstNumber(miningCore, ["powder_gemstone_total", "gemstone_powder_total"]) ?? 0;
    const gemstoneSpent =
      getFirstNumber(miningCore, ["powder_spent_gemstone", "gemstone_powder_spent"]) ?? 0;
    const gemstoneTotal =
      getFirstNumber(miningCore, ["powder_gemstone", "gemstone_powder"]) ?? (gemstoneCurrent + gemstoneSpent);

    const glaciteCurrent =
      getFirstNumber(miningCore, ["powder_glacite_total", "glacite_powder_total"]) ?? 0;
    const glaciteSpent =
      getFirstNumber(miningCore, ["powder_spent_glacite", "glacite_powder_spent"]) ?? 0;
    const glaciteTotal =
      getFirstNumber(miningCore, ["powder_glacite", "glacite_powder"]) ?? (glaciteCurrent + glaciteSpent);

    const hotmXp =
      getPath(skillTree, "experience.mining") ??
      getFirstNumber(miningCore, ["experience", "hotm_xp", "hotmXp", "hotm_experience", "hotmExperience"]);

    let level = { level: 1, levelWithProgress: 1 };
    if (typeof hotmXp === "number" && Number.isFinite(hotmXp)) {
      level = getLevelByXp(hotmXp, { type: "hotm" });
    }

    const rawAbility =
      miningCore.selected_pickaxe_ability ??
      miningCore.selectedPickaxeAbility ??
      miningCore.selected_ability ??
      miningCore.selectedAbility ??
      miningCore.ability ??
      getPath(skillTree, "selected_ability.mining");

    return {
      powder: {
        mithril: {
          spent: mithrilSpent,
          current: mithrilCurrent,
          total: mithrilTotal
        },
        gemstone: {
          spent: gemstoneSpent,
          current: gemstoneCurrent,
          total: gemstoneTotal
        },
        glacite: {
          spent: glaciteSpent,
          current: glaciteCurrent,
          total: glaciteTotal
        }
      },
      level,
      // @ts-ignore
      ability: formatAbility(rawAbility)
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 *
 * @param {import("../../types/profiles.js").Member} profile
 * @returns {import("./hotm.types").Forge | null}
 */
/**
 * Level of the HotM perk Quick Forge. Hypixel moved the HotM tree from mining_core.nodes.forge_time to
 * skill_tree.nodes.mining_2.quick_forge; a perk switched off in game doesn't count.
 * @param {any} profile
 * @returns {number}
 */
function getQuickForgeLevel(profile) {
  const trees = [profile.skill_tree?.nodes?.mining_2, profile.skill_tree?.nodes?.mining];
  for (const nodes of trees) {
    if (nodes?.quick_forge != null) {
      return nodes.toggle_quick_forge === false ? 0 : Number(nodes.quick_forge) || 0;
    }
  }

  const oldLevel = profile.mining_core?.nodes?.forge_time;
  if (oldLevel != null) {
    return profile.mining_core?.nodes?.toggle_forge_time === false ? 0 : Number(oldLevel) || 0;
  }

  return 0;
}

/** "1d 17h", "5h 12m", "8m" */
function formatRemaining(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

function getForge(profile) {
  const forgeItems = [];
  if (!profile.forge?.forge_processes?.forge_1) {
    return null;
  }

  const forge = Object.values(profile.forge.forge_processes.forge_1);

  for (const item of forge) {
    const forgeItem = {
      id: item.id,
      name: "Unknown Item",
      slot: item.slot,
      timeStarted: item.startTime,
      timeFinished: 0,
      timeFinishedText: ""
    };

    if (item.id in CONSTANTS.forge.items) {
      // @ts-ignore
      let forgeTime = CONSTANTS.forge.items[item.id].duration;
      const quickForge = getQuickForgeLevel(profile);
      if (quickForge > 0) {
        // @ts-ignore
        forgeTime *= CONSTANTS.forge.quickForgeMultiplier[Math.min(quickForge, 20)];
      }

      // @ts-ignore
      forgeItem.name = CONSTANTS.forge.items[item.id].name;

      const timeFinished = item.startTime + forgeTime;
      forgeItem.timeStarted = item.startTime;
      forgeItem.timeFinished = timeFinished;
      forgeItem.timeFinishedText = timeFinished < Date.now() ? "(FINISHED)" : `(in ${formatRemaining(timeFinished - Date.now())})`;
    }

    forgeItems.push(forgeItem);
  }

  return forgeItems;
}

module.exports = {
  getHotm,
  getForge
};
