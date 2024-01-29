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

function addSign(value) {
  if (value < 0 ) return value;
  else return '+ ' + value;
}

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Function to create formatted cooldown time strings
function formatDiscordTimeWithOffset(apiTime, offset) {
  const discordTime = apiTime + offset;
  const ts = new Date(discordTime * 1000);
  const formattedTime = `<t:${discordTime}:f>`;
  const relativeTime = `<t:${discordTime}:R>`;
  return { formattedTime, relativeTime };
}

function getRemainingTime(startTime, currentTargetScore, leadScore, currentTime) {
  let elapsedTime = Math.floor((currentTime - startTime) / 3600);
  let initialTargetScore;

  if (elapsedTime <= 23) {
    initialTargetScore = currentTargetScore;
  } else {
    initialTargetScore = currentTargetScore / (1 - ((elapsedTime - 23 ) * 0.01));
  }
  const scoreDecay = initialTargetScore * 0.01;

  const hoursToGo = Math.floor((currentTargetScore - leadScore) / scoreDecay) + 1;

  let projectedEndTime =Math.floor(startTime + elapsedTime * 3600 + hoursToGo * 3600);

  return projectedEndTime;
}



module.exports = { abbreviateNumber, numberWithCommas, addSign, formatDiscordTimeWithOffset, getRemainingTime };