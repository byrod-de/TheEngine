function checkAPIKey(apikey) {

    if (apikey.length != 16)
        return 'Error, key length not valid.';

    if (!apikey.match(/^[a-z0-9]+$/i))
        return 'Error, key contains invalid characters.'

    return 'Okay';
}

function storeJSON(jsonText) {
    let keyinfo = JSON.parse(jsonText).keyinfo;
    console.log(keyinfo.userID);

    const fs = require('fs');

    fs.writeFile("tmp/keys.csv", `${keyinfo.userID};${keyinfo.tornUser};${keyinfo.tornId};${keyinfo.mykey};${keyinfo.access_level};${keyinfo.access_type}`, function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}



module.exports = { checkAPIKey, storeJSON };