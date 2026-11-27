// One Discord message with the boosted dyes of the current SkyBlock year, in the channel set as
// config.discord.channels.calendarChannel. The bot posts it once and then edits that same message whenever
// it has read the new year's dyes in game. Which message it is gets saved in data/dyes-message.json.
const fs = require("fs");
const { EmbedBuilder } = require("discord.js");
const config = require("../../../config.json");

const MESSAGE_FILE = "./data/dyes-message.json";
// 3D head icons of every dye (made with tools/renderDyeEmojis.js), uploaded once as the bot's own
// application emojis named like "dye_fossil" (they don't use the server's emoji slots).
const EMOJI_DIR = "./assets/dye-emojis";
const EMBED_COLOR = 0xe0569b;
const MULTIPLIER_ICON = { 3: "🔥", 2: "✨" };

/** "Fossil Dye" -> "DYE_FOSSIL" (file name) */
function dyeId(name) {
  return `DYE_${name.replace(/\s*Dye$/i, "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

/**
 * The bot's emoji for each dye ("<:dye_fossil:123>"), uploading the missing ones from EMOJI_DIR.
 * @returns {Promise<Record<string, string>>} dye name -> emoji text
 */
async function dyeEmojis(dyes) {
  const result = {};
  const application = global.client?.application;
  if (!application) {
    return result;
  }

  try {
    const existing = await application.emojis.fetch();

    for (const dye of dyes) {
      const id = dyeId(dye.name);
      const emojiName = id.toLowerCase();
      let emoji = existing.find((entry) => entry.name === emojiName);

      const file = `${EMOJI_DIR}/${id}.png`;
      if (!emoji && fs.existsSync(file)) {
        emoji = await application.emojis.create({ attachment: file, name: emojiName });
        console.discord(`Uploaded emoji ${emojiName}`);
      }

      if (emoji) {
        result[dye.name] = `<:${emoji.name}:${emoji.id}>`;
      }
    }
  } catch (error) {
    console.warn(`Discord > Could not load the dye emojis: ${error.message || error}`);
  }

  return result;
}

function loadMessageInfo() {
  try {
    return JSON.parse(fs.readFileSync(MESSAGE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveMessageInfo(info) {
  try {
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data", { recursive: true });
    }
    fs.writeFileSync(MESSAGE_FILE, JSON.stringify(info, null, 2));
  } catch (error) {
    console.warn(`Discord > Could not save ${MESSAGE_FILE}: ${error.message || error}`);
  }
}

/**
 * @param {{ year: number, dyes: { name: string, multiplier: number }[], fetchedAt?: string }} data
 * @param {number} nextYearStart ms
 */
function buildEmbed(data, nextYearStart, emojis = {}) {
  const lines = data.dyes.map((dye) => `${emojis[dye.name] ?? MULTIPLIER_ICON[dye.multiplier] ?? "•"} ${dye.name} **${dye.multiplier}x**`);
  const resetUnix = Math.floor(nextYearStart / 1000);

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`Dyes for SkyBlock Year ${data.year}`)
    .setDescription(`${lines.join("\n")}\n\n⏳ Dyes reset <t:${resetUnix}:R>`)
    .setFooter({ text: "Read from /dyes in game" });

  if (data.fetchedAt) {
    embed.setTimestamp(new Date(data.fetchedAt));
  }

  return embed;
}

/** The year the saved message shows, or null. */
function postedYear() {
  return loadMessageInfo()?.year ?? null;
}

/**
 * Posts the dyes message, or edits the one posted before. Does nothing without a calendar channel.
 * @returns {Promise<boolean>} true if the message now shows this year
 */
async function updateDyesEmbed(data, nextYearStart) {
  const channelId = config.discord?.channels?.calendarChannel;
  if (!/^\d+$/.test(String(channelId ?? "")) || !global.client?.isReady?.()) {
    return false;
  }

  try {
    const channel = await global.client.channels.fetch(channelId);
    if (!channel?.isTextBased?.()) {
      console.warn(`Discord > calendarChannel ${channelId} is not a text channel`);
      return false;
    }

    const embed = buildEmbed(data, nextYearStart, await dyeEmojis(data.dyes));
    const saved = loadMessageInfo();

    if (saved?.channelId === channelId && saved.messageId) {
      try {
        const message = await channel.messages.fetch(saved.messageId);
        await message.edit({ embeds: [embed] });
        saveMessageInfo({ ...saved, year: data.year });
        return true;
      } catch {
        // deleted or not ours anymore: post a new one below
      }
    }

    const message = await channel.send({ embeds: [embed] });
    saveMessageInfo({ channelId, messageId: message.id, year: data.year });
    return true;
  } catch (error) {
    console.warn(`Discord > Could not update the dyes message: ${error.message || error}`);
    return false;
  }
}

module.exports = { updateDyesEmbed, postedYear, buildEmbed };
