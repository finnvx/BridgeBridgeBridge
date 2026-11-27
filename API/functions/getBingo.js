/* eslint-disable no-throw-literal */
// Bingo data: a player's past bingo cards (needs the API key) and the current event (public).
const config = require("../../config.json");
// @ts-ignore
const { get } = require("axios");

const MAX_AGE = 5 * 60 * 1000;
const playerCache = new Map();
let eventCache = null;

/**
 * @param {string} uuid
 * @returns {Promise<{ key: number, points: number, completed_goals: string[] }[]>} events the player took part in
 */
async function getPlayerBingo(uuid) {
  const cached = playerCache.get(uuid);
  if (cached && Date.now() - cached.at < MAX_AGE) {
    return cached.events;
  }

  const { data } = await get(`https://api.hypixel.net/v2/skyblock/bingo?uuid=${uuid}`, {
    headers: { "API-Key": config.minecraft.API.hypixelAPIkey }
  }).catch((error) => {
    // Hypixel answers 404 for players who never played bingo.
    if (error?.response?.status === 404) {
      return { data: { success: true, events: [] } };
    }
    throw error?.response?.data?.cause ?? "Request to Hypixel API failed. Please try again!";
  });

  if (data?.success === false) {
    throw "Request to Hypixel API failed. Please try again!";
  }

  const events = Array.isArray(data?.events) ? data.events : [];
  playerCache.set(uuid, { at: Date.now(), events });
  return events;
}

/** @returns {Promise<{ id: number, name: string, start: number, end: number, modifier: string, goals: any[] }>} */
async function getCurrentBingo() {
  if (eventCache && Date.now() - eventCache.at < MAX_AGE) {
    return eventCache.data;
  }

  const { data } = await get("https://api.hypixel.net/v2/resources/skyblock/bingo").catch(() => {
    throw "Request to Hypixel API failed. Please try again!";
  });

  if (!data?.success) {
    throw "Request to Hypixel API failed. Please try again!";
  }

  eventCache = { at: Date.now(), data };
  return data;
}

module.exports = { getPlayerBingo, getCurrentBingo };
