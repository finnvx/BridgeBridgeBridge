// Nicknames that commands treat as the real player name, e.g. "!networth noob5" = "!networth suq5".
// Keys are lowercase.
const PLAYER_ALIASES = {
  noob5: "suq5",
  baguette: "SoutifDeLuxe"
};

/** The real name for a nickname, otherwise the word unchanged. */
function resolvePlayerAlias(word) {
  if (typeof word !== "string") {
    return word;
  }
  return PLAYER_ALIASES[word.toLowerCase()] ?? word;
}

module.exports = { PLAYER_ALIASES, resolvePlayerAlias };
