const { apiKey, storeMethod } = require('../conf/config.json');
const moment = require('moment');
const fs = require('fs');

function checkAPIKey(apikey) {

    if (apikey.length != 16)
        return 'Error, key length not valid.';

    if (!apikey.match(/^[a-z0-9]+$/i))
        return 'Error, key contains invalid characters.'

    return 'Okay';
}

function storeAPIKey(jsonText) {
    let keyinfo = JSON.parse(jsonText).keyinfo;
    printLog(keyinfo.userID);

    if (storeMethod === "File") {

        const fs = require('fs');

        fs.writeFile("tmp/keys.csv", `${keyinfo.userID};${keyinfo.tornUser};${keyinfo.tornId};${keyinfo.mykey};${keyinfo.access_level};${keyinfo.access_type}`, function (err) {
            if (err) {
                return printLog(err);
            }
            printLog("The file was saved!");
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
            printLog('Finished reading the file.');
        });
    } else {
        return apiKey;
    } 

}

function printLog(logtext) {
    let currentDate = moment().format().replace('T', ' ');
    let message = currentDate + ' > '  + logtext
    console.log(message);
    return message;
}

const messageIdFile = './conf/messageIds.json';

function readStoredMessageId(key) {
    // Read the content of the JSON file
    const data = fs.readFileSync(messageIdFile, 'utf8');
    
    try {
        // Parse the JSON data
        const messageIds = JSON.parse(data);
        // Return the value associated with the key "statusMessageID"
        return messageIds[key];
    } catch (error) {
        // Handle JSON parsing errors or missing key
        console.error('Error reading stored message ID:', error.message);
        return null;
    }
}



function writeNewMessageId(key, newMessageId) {
    try {
        // Read the content of the JSON file
        const data = fs.readFileSync(messageIdFile, 'utf8');
        // Parse the JSON data
        const messageIds = JSON.parse(data);
        // Update the value associated with the key "statusMessageID"
        messageIds[key] = newMessageId;
        // Write the updated data back to the file
        fs.writeFileSync(messageIdFile, JSON.stringify(messageIds, null, 2), 'utf8');
    } catch (error) {
        // Handle JSON parsing or writing errors
        console.error('Error writing new message ID:', error.message);
    }
}

function getFlagIcon(travelStatus, destinationText) {
    
    let direction = '>';
    
    if (travelStatus == 'Abroad') direction = '=';

    let flag = `:flag_black: \` ${direction} \``;

    if (destinationText.includes('Argentina'))   flag = `:flag_ar: \` ${direction} \``;
    if (destinationText.includes('Canada'))      flag = `:flag_ca: \` ${direction} \``;
    if (destinationText.includes('Cayman'))      flag = `:flag_ky: \` ${direction} \``;
    if (destinationText.includes('China'))       flag = `:flag_cn: \` ${direction} \``;
    if (destinationText.includes('Hawaii'))      flag = `:flag_us: \` ${direction} \``;
    if (destinationText.includes('Japan'))       flag = `:flag_jp: \` ${direction} \``;
    if (destinationText.includes('Mexico'))      flag = `:flag_mx: \` ${direction} \``;
    if (destinationText.includes('Africa'))      flag = `:flag_za: \` ${direction} \``;
    if (destinationText.includes('Switzerland')) flag = `:flag_ch: \` ${direction} \``;
    if (destinationText.includes('UAE'))         flag = `:flag_ae: \` ${direction} \``;
    if (destinationText.includes('Kingdom'))     flag = `:flag_gb: \` ${direction} \``;
    if (destinationText.includes('Returning'))   flag = `:pirate_flag: \` < \``;

    return flag;

}

function sortByUntil(a, b) {
    if (a.status.until < b.status.until) {
        return 1;
    } else if (a.status.until > b.status.until) {
        return -1;
    } else {
        return 0;
    }
}


module.exports = { checkAPIKey, storeAPIKey, getAPIKey, printLog, readStoredMessageId, writeNewMessageId, getFlagIcon, sortByUntil };