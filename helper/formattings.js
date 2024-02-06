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
  if (value < 0 ) return value;
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
    initialTargetScore = currentTargetScore / (1 - ((elapsedTime - 23 ) * 0.01));
  }
  const scoreDecay = initialTargetScore * 0.01;

  const hoursToGo = Math.floor((currentTargetScore - leadScore) / scoreDecay) + 1;

  let projectedEndTime =Math.floor(startTime + elapsedTime * 3600 + hoursToGo * 3600);

  return projectedEndTime;
}

module.exports = { abbreviateNumber, numberWithCommas, addSign, formatDiscordTimeWithOffset, getRemainingTime };