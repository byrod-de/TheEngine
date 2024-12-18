const { readConfig } = require('../helper/misc');
const { cipher } = readConfig().secureConf;

/**
 * Abbreviates a large number and adds a suffix (k, m, b, t, wtf).
 *
 * @param {number} value - The number to be abbreviated
 * @return {string} The abbreviated number with suffix
 */
function abbreviateNumber(value) {
  value = Math.abs(value);
  var newValue = value;
  if (value >= 1000) {
    value = Math.round(value);
    var suffixes = ["", "k", "m", "b", "t", "wtf"];
    var suffixNum = Math.floor(("" + value).length / 3);
    var shortValue = '';
    for (var precision = 2; precision >= 1; precision--) {
      shortValue = parseFloat((suffixNum != 0 ? (value / Math.pow(1000, suffixNum)) : value).toPrecision(precision));
      var dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g, '');
      if (dotLessShortValue.length <= 2) { break; }
    }
    if (shortValue % 1 != 0) shortValue = shortValue.toFixed(1);
    newValue = shortValue + suffixes[suffixNum];
  } else {
    if (newValue % 1 != 0) newValue = newValue.toFixed(2);
  }

  return newValue;
}

/**
 * Function to add a sign to a value if it is positive.
 *
 * @param {number} value - the input value
 * @return {string} the value with a sign added
 */
function addSign(value) {
  if (value < 0) return value;
  else return '+ ' + value;
}

/**
 * Adds commas to a number for every three digits.
 *
 * @param {number} x - the number to add commas to
 * @return {string} the number with commas added
 */
function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Formats the Discord time with the given offset.
 *
 * @param {number} apiTime - The time from the API
 * @param {number} offset - The offset to apply to the API time
 * @return {Object} An object containing formattedTime and relativeTime
 */
function formatDiscordTimeWithOffset(apiTime, offset) {
  const discordTime = apiTime + offset;
  const ts = new Date(discordTime * 1000);
  const formattedTime = `<t:${discordTime}:f>`;
  const relativeTime = `<t:${discordTime}:R>`;
  return { formattedTime, relativeTime };
}

/**
 * Calculates the remaining time until the projected end time based on the start time, current target score,
 * lead score, and current time.
 *
 * @param {number} startTime - The start time in seconds
 * @param {number} currentTargetScore - The current target score
 * @param {number} leadScore - The lead score
 * @param {number} currentTime - The current time in seconds
 * @return {number} The projected end time in seconds
 */
function getRemainingTime(startTime, currentTargetScore, leadScore, currentTime) {
  let elapsedTime = Math.floor((currentTime - startTime) / 3600);
  let initialTargetScore;

  if (elapsedTime <= 23) {
    initialTargetScore = currentTargetScore;
    elapsedTime = 23;
  } else {
    initialTargetScore = currentTargetScore / (1 - ((elapsedTime - 23) * 0.01));
  }
  const scoreDecay = initialTargetScore * 0.01;

  const hoursToGo = Math.floor((currentTargetScore - leadScore) / scoreDecay) + 1;

  let projectedEndTime = Math.floor(startTime + elapsedTime * 3600 + hoursToGo * 3600);

  return projectedEndTime;
}



/**
 * A simple encoding function that reverses the characters of the API key and encodes it in base64.
 *
 * @param {string} apiKey - The API key to be encoded
 * @returns {string} The base64 encoded API key
 */
function encodeApiKey(apiKey) {
  // Simple encoding: reverse the characters of the API key
  return Buffer.from(apiKey).toString('base64');
}

/**
 * Simple decoding: reverse the characters of the encoded API key
 *
 * @param {string} encodedApiKey - the encoded API key to decode
 * @return {string} the decoded API key
 */
function decodeApiKey(encodedApiKey) {
  // Simple decoding: reverse the characters of the encoded API key
  return Buffer.from(encodedApiKey, 'base64').toString('utf-8');
}

// Function to encode an API key before writing to file
function encodeApiKeyWithCypher(apiKey, cipherKey = cipher) {
  let encodedKey = '';
  for (let i = 0; i < apiKey.length; i++) {
    const char = apiKey.charAt(i);
    const index = cipherKey.indexOf(char);
    if (index !== -1) {
      encodedKey += cipherKey.charAt((index + 10) % cipherKey.length); // Shifting by 10 characters
    } else {
      encodedKey += char; // Leave non-alphanumeric characters unchanged
    }
  }
  return `0=${encodedKey}`;
}

// Function to decode an API key after reading from file
function decodeApiKeyWithCypher(encodedApiKey, cipherKey = cipher) {
  let decodedKey = '';
  if (encodedApiKey.startsWith("0=")) {
    encodedApiKey = encodedApiKey.substring(2);

    for (let i = 0; i < encodedApiKey.length; i++) {
      const char = encodedApiKey.charAt(i);
      const index = cipherKey.indexOf(char);
      if (index !== -1) {
        decodedKey += cipherKey.charAt((index - 10 + cipherKey.length) % cipherKey.length); // Shifting back by 10 characters
      } else {
        decodedKey += char; // Leave non-alphanumeric characters unchanged
      }
    }
  } else {
    decodedKey = encodedApiKey;
  }
  return decodedKey;
}

/**
 * Cleans up the input string by escaping markdown characters at the beginning and end of the string.
 *
 * @param {string} inputString - The string to be cleaned up.
 * @return {string} The cleaned up string with escaped markdown characters at the beginning and end.
 */
function cleanUpString(inputString) {
  const specialCharacters = ['\\', '*', '_', '~', '`'];
  for (const char of specialCharacters) {
    if (inputString.startsWith(char) && inputString.endsWith(char)) {
      const escapedChar = `\\${char}`;
      const regex = new RegExp(`(^${char}|${char}$)`, 'g');
      inputString = inputString.replace(regex, escapedChar);
    }
  }
  inputString = inputString.replaceAll('\\_', '＿');
  return inputString;
}

/**
 * Creates a progress bar based on the current and maximum values, with optional formatting and bar length.
 *
 * @param {number} current - The current value for the progress bar.
 * @param {number} max - The maximum value for the progress bar.
 * @param {string} format - The format of the progress bar ('default', 'circle', 'scale').
 * @param {number} barLength - The length of the progress bar.
 * @return {string} The generated progress bar.
 */
function createProgressBar(current, max, format = 'default', barLength = 18) {
  const centerChar = '|';
  const circleChar = ':beginner:';
  const scaleSymbolPos = ':large_orange_diamond:';
  const scaleSymbolNeg = ':large_blue_diamond:';

  if (format === 'circle') {
    const progress = (current / max) * barLength;
    const filledCount = Math.min(barLength, Math.max(0, Math.floor(progress)));
    return '▬'.repeat(filledCount) + circleChar + '▬'.repeat(Math.max(0, barLength - filledCount - 1));
  } else if (format === 'scale') {

    let progressBar = '';

    let centerIndex = Math.floor(barLength / 2);

    if (current === 0) {
      progressBar = '▬'.repeat(centerIndex) + scaleSymbolPos + '▬'.repeat(centerIndex);

    } else if (current > 0) {
      const progress = ((current / max) * centerIndex) - 1;
      const filledCount = Math.min(centerIndex, Math.max(0, Math.floor(progress)));
      const positiveHalf = '▬'.repeat(filledCount) + 'X' + '▬'.repeat(Math.max(0, centerIndex - filledCount - 1));
      progressBar = '▬'.repeat(centerIndex) + centerChar + positiveHalf;
      progressBar = progressBar.replace('X', scaleSymbolPos);
    } else {
      const progress = (current * -1 / max) * centerIndex - 1;
      const filledCount = Math.min(centerIndex, Math.max(0, Math.floor(progress)));
      const negativeHalf = '▬'.repeat(filledCount) + 'X' + '▬'.repeat(Math.max(0, centerIndex - filledCount - 1));
      progressBar = reverseString(negativeHalf) + centerChar + '▬'.repeat(centerIndex);
      progressBar = progressBar.replace('X', scaleSymbolNeg);
    }
    return progressBar;
  } else {
    const filledLength = Math.floor((current / max) * barLength);
    const emptyLength = barLength - filledLength;
    return '▰'.repeat(filledLength) + '▱'.repeat(emptyLength);
  }
}


/**
 * Reverses a string.
 *
 * @param {string} str - The input string to be reversed.
 * @return {string} The reversed string.
 */
function reverseString(str) {
  return [...str].reverse().join('');
}

/**
 * Splits a list of members into multiple chunks based on the specified entry format.
 *
 * @param {Array} membersList - The list of members to be split into chunks.
 * @param {string} entryFormat - The format for each entry containing placeholders to be replaced.
 * @return {Array} An array of strings representing the split chunks.
 */
function splitIntoChunks(membersList, entryFormat) {
  const MAX_FIELD_LENGTH = 1023; // Maximum allowed length for field value

  // Split jailMembers into multiple chunks
  const memberChunks = [];
  let currentChunk = [];
  for (const member of membersList) {
    const entry = entryFormat
    .replace(/{{id}}/g, member.id)
    .replace(/{{name}}/g, cleanUpString(member.name))
    .replace(/{{statusUntil}}/g, member.statusUntil)
    .replace(/{{direction}}/g, member.direction)
    .replace(/{{flag}}/g, member.flag)
    .replace(/{{statusIcon}}/g, member.statusIcon)
    .replace(/{{hospital}}/g, member.hospital)
    .replace(/{{attackswon}}/g, (member.attackswon || 0).toString().padStart(5, ' '))
    .replace(/{{level}}/g, '`' + (member.level?.toString().padStart(3, ' ') || 'N/A') + '`')
    .replace(/{{totalStats}}/g, (member.totalStats === 0) ? '' : `> ${abbreviateNumber(member.totalStats)}`);

    if (currentChunk.length === 0 || (currentChunk.join('').length + entry.length) > MAX_FIELD_LENGTH) {
      if (currentChunk.length > 0) {
        memberChunks.push(currentChunk.join(''));
        currentChunk = [];
      }
    }

    currentChunk.push(entry);
  }

  if (currentChunk.length > 0) {
    memberChunks.push(currentChunk.join(''));
  }

  return memberChunks;
}

/**
 * Extracts a specific pattern from the input string using the provided regex.
 *
 * @param {string} inputString - The input string to extract from.
 * @param {RegExp} regex - The regular expression pattern to match against.
 * @return {string | null} The extracted pattern or null if no match is found.
 */
function extractFromRegex(inputString, regex) {
  const match = inputString.match(regex);
  return match ? match[1] : null;
}

/**
 * Converts a string to title case, by splitting it into words and capitalizing
 * the first letter of each word. Replaces underscores with spaces.
 *
 * @param {string} str - The input string to convert.
 * @return {string} The title-case string.
 */
function capitalize(str) {
  return str
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Converts a number of seconds to a string in the format "X days Y hours".
 *
 * @param {number} seconds - The number of seconds to convert.
 * @return {string} The converted string.
 */
function convertSecondsToDaysHours(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  return `${days}d ${hours}h`;
}

/**
 * Converts a Torn rank ID to its corresponding rank name.
 *
 * @param {string} rankId - The rank ID to convert.
 * @return {string} The rank name corresponding to the provided rank ID, or "Unknown Rank" if no match is found.
 */
function getRankNameById(rankId) {
  const rankData = {
    "1": "Absolute beginner",
    "2": "Beginner",
    "3": "Inexperienced",
    "4": "Rookie",
    "5": "Novice",
    "6": "Below Average",
    "7": "Average",
    "8": "Reasonable",
    "9": "Above Average",
    "10": "Competent",
    "11": "Highly competent",
    "12": "Veteran",
    "13": "Distinguished",
    "14": "Highly distinguished",
    "15": "Professional",
    "16": "Star",
    "17": "Master",
    "18": "Outstanding",
    "19": "Celebrity",
    "20": "Supreme",
    "21": "Idolized",
    "22": "Champion",
    "23": "Heroic",
    "24": "Legendary",
    "25": "Elite",
    "26": "Invincible",
    "27": "Invincible"
  };

  return rankData[rankId] || "Unknown Rank";
}

/**
 * Format a Torn timestamp into ISO 8601 format
 * @param {number} timestamp Torn timestamp
 * @returns {string} ISO 8601 formatted date string
 */
function formatTornDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const formattedDate = date.toISOString();
  return formattedDate.replace('Z', '+00:00').replace('T', ' ').replace('.000', '');
}

module.exports = { formatTornDate, getRankNameById, convertSecondsToDaysHours, capitalize, extractFromRegex, abbreviateNumber, numberWithCommas, addSign, formatDiscordTimeWithOffset, getRemainingTime, encodeApiKeyWithCypher, decodeApiKeyWithCypher, cleanUpString, createProgressBar, splitIntoChunks };