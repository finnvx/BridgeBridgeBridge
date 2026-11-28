// Skyblock weights for !weight:
// - Senither: formulas from tonydawhale/senitherweight (MIT), ported below
// - Lily: Antonio32A/lilyweight (MIT), its calculation files are in ./lily (see ./lily/LICENSE)
// - Coleweight (mining): ninjune.dev's public API, which also gives the leaderboard rank
// - Elite (farming): api.elitebot.dev, data from https://eliteskyblock.com/
// @ts-ignore
const { get } = require("axios");
const { skillNames, skillXPPerLevel } = require("./lily/constants.json");
const { getSkillWeight } = require("./lily/skillWeight.js");
const { getSlayerWeight } = require("./lily/slayerWeight.js");
const { getDungeonExpWeight } = require("./lily/dungeonExpWeight.js");
const { getDungeonCompletionWeight } = require("./lily/dungeonCompWeight.js");

/** Skill XP from the current API (player_data.experience.SKILL_MINING), falling back to the old field. */
function skillXp(profile, skill) {
  const xp = profile?.player_data?.experience?.[`SKILL_${skill.toUpperCase()}`] ?? profile?.[`experience_skill_${skill}`];
  return Number(xp) || 0;
}

// ---- Senither ---------------------------------------------------------------------------------------------

const SENITHER_SKILLS = {
  mining: { exponent: 1.18207448, divider: 259634, maxLevel: 60 },
  foraging: { exponent: 1.232826, divider: 259634, maxLevel: 50 },
  enchanting: { exponent: 0.96976583, divider: 882758, maxLevel: 60 },
  farming: { exponent: 1.217848139, divider: 220689, maxLevel: 60 },
  combat: { exponent: 1.15797687265, divider: 275862, maxLevel: 60 },
  fishing: { exponent: 1.406418, divider: 88274, maxLevel: 50 },
  alchemy: { exponent: 1.0, divider: 1103448, maxLevel: 50 },
  taming: { exponent: 1.14744, divider: 441379, maxLevel: 50 }
};
const LEVEL_50_XP = 55172425;
const LEVEL_60_XP = 111672425;

// Cumulative skill XP for levels 0..60.
const SKILL_XP = [0, 50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925, 14925, 22425, 32425, 47425, 67425, 97425,
  147425, 222425, 322425, 522425, 822425, 1222425, 1722425, 2322425, 3022425, 3822425, 4722425, 5722425, 6822425,
  8022425, 9322425, 10722425, 12222425, 13822425, 15522425, 17322425, 19222425, 21222425, 23322425, 25522425,
  27822425, 30222425, 32722425, 35322425, 38072425, 40972425, 44072425, 47472425, 51172425, 55172425, 59472425,
  64072425, 68972425, 74172425, 79672425, 85472425, 91572425, 97972425, 104672425, 111672425];

const SENITHER_DUNGEONS = {
  catacombs: 0.0002149604615,
  healer: 0.0000045254834,
  mage: 0.0000045254834,
  berserk: 0.0000045254834,
  archer: 0.0000045254834,
  tank: 0.0000045254834
};
const DUNGEON_50_XP = 569809640;

const SENITHER_SLAYERS = {
  zombie: { divider: 2208, modifier: 0.15 },
  spider: { divider: 2118, modifier: 0.08 },
  wolf: { divider: 1962, modifier: 0.015 },
  enderman: { divider: 1430, modifier: 0.017 }
};

function levelWithProgress(xp, table) {
  for (let level = 1; level < table.length; level++) {
    if (xp < table[level]) {
      return level - 1 + (xp - table[level - 1]) / (table[level] - table[level - 1]);
    }
  }
  return table.length - 1;
}

function senitherSkill(skill, xp) {
  const group = SENITHER_SKILLS[skill];
  let level = levelWithProgress(xp, SKILL_XP);
  if (group.maxLevel === 50) {
    level = Math.min(level, 50);
  }

  const maxXp = group.maxLevel === 60 ? LEVEL_60_XP : LEVEL_50_XP;
  let base = Math.pow(level * 10, 0.5 + group.exponent + level / 100) / 1250;
  if (xp <= maxXp) {
    return base;
  }

  base = Math.round(base);
  return base + Math.pow((xp - maxXp) / group.divider, 0.968);
}

function senitherDungeon(type, xp, dungeonTable) {
  const level = levelWithProgress(xp, dungeonTable);
  const base = Math.pow(level, 4.5) * SENITHER_DUNGEONS[type];
  if (xp <= DUNGEON_50_XP) {
    return base;
  }

  const splitter = (4 * DUNGEON_50_XP) / base;
  return Math.floor(base) + Math.pow((xp - DUNGEON_50_XP) / splitter, 0.968);
}

function senitherSlayer(type, xp) {
  const group = SENITHER_SLAYERS[type];
  if (xp <= 1000000) {
    return xp / group.divider;
  }

  let remaining = xp - 1000000;
  let modifier = group.modifier;
  let overflow = 0;
  while (remaining > 0) {
    const left = Math.min(remaining, 1000000);
    overflow += Math.pow(left / (group.divider * (1.5 + modifier)), 0.942);
    modifier += group.modifier;
    remaining -= left;
  }

  return 1000000 / group.divider + overflow;
}

function getSenitherWeight(profile) {
  const { dungeonExperienceTable } = require("./lily/constants.json");
  const dungeonTable = dungeonExperienceTable.slice(0, 51);

  const skill = Object.keys(SENITHER_SKILLS).reduce((sum, name) => sum + senitherSkill(name, skillXp(profile, name)), 0);
  const slayer = Object.keys(SENITHER_SLAYERS).reduce(
    (sum, name) => sum + senitherSlayer(name, Number(profile?.slayer?.slayer_bosses?.[name]?.xp ?? profile?.slayer_bosses?.[name]?.xp) || 0),
    0
  );

  const dungeons = profile?.dungeons ?? {};
  const dungeon =
    senitherDungeon("catacombs", Number(dungeons.dungeon_types?.catacombs?.experience) || 0, dungeonTable) +
    ["healer", "mage", "berserk", "archer", "tank"].reduce(
      (sum, cls) => sum + senitherDungeon(cls, Number(dungeons.player_classes?.[cls]?.experience) || 0, dungeonTable),
      0
    );

  return { total: skill + slayer + dungeon, skill, slayer, dungeon };
}

// ---- Lily -------------------------------------------------------------------------------------------------

function lilyLevel(xp) {
  let added = 0;
  for (let i = 0; i < 61; i++) {
    added += skillXPPerLevel[i];
    if (xp < added) {
      return Math.floor(i - 1 + (xp - (added - skillXPPerLevel[i])) / skillXPPerLevel[i]);
    }
  }
  return 60;
}

function getLilyWeight(profile) {
  // Same skill order as lilyweight's skillNames (enchanting, taming, alchemy, mining, farming, foraging, combat, fishing).
  const xp = Object.keys(skillNames).map((key) => skillXp(profile, key.replace("experience_skill_", "")));
  const levels = xp.map(lilyLevel);

  const bosses = profile?.slayer?.slayer_bosses ?? profile?.slayer_bosses ?? {};
  const slayerXp = ["zombie", "spider", "wolf", "enderman", "blaze"].map((name) => Number(bosses[name]?.xp) || 0);

  const types = profile?.dungeons?.dungeon_types ?? {};
  // Hypixel adds a "total" entry to tier_completions; lilyweight only knows the floor numbers.
  const floorsOnly = (completions) =>
    Object.fromEntries(Object.entries(completions ?? {}).filter(([floor, amount]) => /^\d+$/.test(floor) && Number.isFinite(Number(amount))));

  const [skillBase, skillOverflow] = getSkillWeight(levels, xp);
  const [completion, masterCompletion] = getDungeonCompletionWeight(
    floorsOnly(types.catacombs?.tier_completions),
    floorsOnly(types.master_catacombs?.tier_completions)
  );
  const dungeonXp = getDungeonExpWeight(Number(types.catacombs?.experience) || 0);
  const slayer = getSlayerWeight(slayerXp);

  const skill = skillBase + skillOverflow;
  const dungeon = completion + masterCompletion + dungeonXp;
  return { total: skill + dungeon + slayer, skill, slayer, dungeon };
}

// ---- Coleweight -------------------------------------------------------------------------------------------

/** @returns {Promise<{ coleweight: number, rank: number | null } | null>} */
async function getColeweight(username) {
  try {
    const { data } = await get(`https://ninjune.dev/api/coleweight?username=${encodeURIComponent(username)}`, { timeout: 15000 });
    if (typeof data?.coleweight !== "number") {
      return null;
    }
    return { coleweight: data.coleweight, rank: typeof data.rank === "number" ? data.rank : null };
  } catch {
    return null;
  }
}

// ---- Elite farming weight ---------------------------------------------------------------------------------

// Elite API terms: identify the project in the User-Agent and credit eliteskyblock.com where the data is shown.
const ELITE_HEADERS = { "User-Agent": "BridgeBridgeBridge/1.0 (+https://github.com/Conan2402/BridgeBridgeBridge)" };

/** @returns {Promise<{ weight: number, rank: number | null } | null>} */
async function getEliteWeight(uuid, profileId) {
  const ids = `${uuid.replace(/-/g, "")}/${profileId.replace(/-/g, "")}`;
  const options = { headers: ELITE_HEADERS, timeout: 15000 };
  const [weight, rank] = await Promise.all([
    get(`https://api.elitebot.dev/weight/${ids}`, options).then(({ data }) => data).catch(() => null),
    get(`https://api.elitebot.dev/leaderboard/farmingweight/${ids}`, options).then(({ data }) => data).catch(() => null)
  ]);
  if (typeof weight?.totalWeight !== "number") {
    return null;
  }
  return { weight: weight.totalWeight, rank: typeof rank?.rank === "number" && rank.rank > 0 ? rank.rank : null };
}

module.exports = { getSenitherWeight, getLilyWeight, getColeweight, getEliteWeight };
