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

module.exports = { abbreviateNumber, numberWithCommas, addSign };