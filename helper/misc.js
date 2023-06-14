const { apiKey, comment, storeMethod } = require('../config.json');

function checkAPIKey(apikey) {

    if (apikey.length != 16)
        return 'Error, key length not valid.';

    if (!apikey.match(/^[a-z0-9]+$/i))
        return 'Error, key contains invalid characters.'

    return 'Okay';
}

function storeAPIKey(jsonText) {
    let keyinfo = JSON.parse(jsonText).keyinfo;
    console.log(keyinfo.userID);

    if (storeMethod === "File") {

        const fs = require('fs');

        fs.writeFile("tmp/keys.csv", `${keyinfo.userID};${keyinfo.tornUser};${keyinfo.tornId};${keyinfo.mykey};${keyinfo.access_level};${keyinfo.access_type}`, function (err) {
            if (err) {
                return console.log(err);
            }
            console.log("The file was saved!");
        });
    }
}

function getAPIKey(userID) {

    var userApiKey = '';

    if (storeMethod === "File") {

        const fs = require('fs');
        const readline = require('readline');

        const fileStream = fs.createReadStream('tmp/keys.csv');

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });


        rl.on('line', (line) => {
            var csv = line.split(";");
            if (csv[0] === userID || csv[2] === userID) {
                userApiKey = csv[3];
                return userApiKey;
            }

        });

        rl.on('close', () => {
            console.log('Finished reading the file.');
        });
    } else {
        return apiKey;
    } 

}

module.exports = { checkAPIKey, storeAPIKey, getAPIKey };