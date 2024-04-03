const { readConfig } = require('../helper/misc');
const cipher = readConfig().secureConf.cipher;

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
 * Cleans up the input string by escaping markdown characters.
 *
 * @param {string} inputString - The string to be cleaned up.
 * @return {string} The cleaned up string with escaped markdown characters.
 */
function cleanUpString(inputString) {
  return inputString.replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~")
    .replace(/`/g, "\\`");
}

module.exports = { abbreviateNumber, numberWithCommas, addSign, formatDiscordTimeWithOffset, getRemainingTime, encodeApiKeyWithCypher, decodeApiKeyWithCypher, cleanUpString };