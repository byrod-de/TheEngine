const moment = require('moment');
const fs = require('fs');
const yaml = require('yaml');
const messageIdFile = './conf/messageIds.json';
const configFilename = './conf/config.yaml';

/**
 * Function to check the validity of an API key.
 *
 * @param {string} apikey - The API key to be checked.
 * @return {string} The status message indicating the validity of the API key.
 */
function checkAPIKey(apikey) {

    if (apikey.length != 16)
        return 'Error, key length not valid.';

    if (!apikey.match(/^[a-z0-9]+$/i))
        return 'Error, key contains invalid characters.'

    return 'Okay';
}

/**
 * Prints the log text along with the current date and time, and logs it to the console.
 *
 * @param {string} logtext - The text to be logged
 * @return {string} The logged message
 */
function printLog(logtext) {
    let currentDate = moment().format().replace('T', ' ');
    let message = currentDate + ' > ' + logtext
    console.log(message);
    return message;
}

/**
 * Read the content of the JSON file
 *
 * @param {string} key - the key to look for in the JSON data
 * @return {string} the value associated with the specified key, or null if there's an error
 */
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

/**
 * Delete a stored message ID from the JSON file based on the provided key.
 *
 * @param {string} key - The key of the message ID to be deleted
 * @return {void} 
 */
function deleteStoredMessageId(key) {
    // Read the content of the JSON file
    const data = fs.readFileSync(messageIdFile, 'utf8');

    try {
        // Parse the JSON data
        const messageIds = JSON.parse(data);

        // Check if the key exists in the messageIds object
        if (messageIds.hasOwnProperty(key)) {
            // Delete the message ID associated with the key
            delete messageIds[key];

            // Write the updated JSON data back to the file
            fs.writeFileSync(messageIdFile, JSON.stringify(messageIds, null, 2), 'utf8');
            printLog(`Message ID associated with key '${key}' has been deleted.`);
        } else {
            printLog(`Key '${key}' does not exist in the stored message IDs.`);
        }
    } catch (error) {
        // Handle JSON parsing errors
        console.error('Error deleting stored message ID:', error.message);
    }
}


/**
 * Write a new message ID to the JSON file.
 *
 * @param {string} key - The key to update in the JSON data
 * @param {string} newMessageId - The new message ID to write
 * @return {void} 
 */
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

/**
 * Returns a flag icon based on the travel status and destination text.
 *
 * @param {string} travelStatus - the travel status
 * @param {string} destinationText - the destination text
 * @return {string} the flag icon
 */
function getFlagIcon(travelStatus, destinationText) {

    let direction = '>';

    if (travelStatus == 'Abroad') direction = '=';
    if (destinationText.includes('Returning')) direction = '<';

    let flag = `:flag_black: \` ${direction} \``;

    if (destinationText.includes('Argentina')) flag = `:flag_ar: \` ${direction} \``;
    if (destinationText.includes('Canada')) flag = `:flag_ca: \` ${direction} \``;
    if (destinationText.includes('Cayman')) flag = `:flag_ky: \` ${direction} \``;
    if (destinationText.includes('China')) flag = `:flag_cn: \` ${direction} \``;
    if (destinationText.includes('Hawaii')) flag = `:flag_us: \` ${direction} \``;
    if (destinationText.includes('Japan')) flag = `:flag_jp: \` ${direction} \``;
    if (destinationText.includes('Mexico')) flag = `:flag_mx: \` ${direction} \``;
    if (destinationText.includes('Africa')) flag = `:flag_za: \` ${direction} \``;
    if (destinationText.includes('Switzerland')) flag = `:flag_ch: \` ${direction} \``;
    if (destinationText.includes('UAE')) flag = `:flag_ae: \` ${direction} \``;
    if (destinationText.includes('Kingdom')) flag = `:flag_gb: \` ${direction} \``;

    return flag;

}

/**
 * Sorts the input objects based on the 'until' property of their 'status' object.
 *
 * @param {Object} a - The first input object
 * @param {Object} b - The second input object
 * @return {number} 1 if a.until < b.until, -1 if a.until > b.until, 0 otherwise
 */
function sortByUntil(a, b) {
    if (a.status.until < b.status.until) {
        return 1;
    } else if (a.status.until > b.status.until) {
        return -1;
    } else {
        return 0;
    }
}

/**
 * Updates or deletes an embed message in a war channel.
 *
 * @param {Object} channel - The war channel to update or delete the embed message in.
 * @param {string} embedType - The type of the embed message.
 * @param {Object} embed - The embed message to update or delete.
 * @param {string} [method='edit'] - The method to use for updating or deleting the embed message.
 */
async function updateOrDeleteEmbed(channel, embedType, embed, method = 'edit') {

    const embedMessageId = readStoredMessageId(`${embedType}EmbedMessageId`);
    if (embedMessageId) {
        try {
            const originalMessage = await channel.messages.fetch(embedMessageId);
            await originalMessage[method]({ embeds: [embed], ephemeral: false });
        } catch (error) {
            if (method !== 'delete') {
                const newMessage = await channel.send({ embeds: [embed], ephemeral: false });
                writeNewMessageId(`${embedType}EmbedMessageId`, newMessage.id);
            } else {
                //deleteStoredMessageId(`${embedType}EmbedMessageId`);
            }
        }
    }
}


// Function to calculate Unix timestamps for the first and last day of a selected month
function calculateMonthTimestamps(selectedMonth, offsetInHours = 0) {
    // Get the year
    var currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    if (selectedMonth > currentMonth) {
        currentYear--;
    }

    var firstDayOfMonth = new Date(currentYear, selectedMonth, 1).getTime() / 1000;
    let dummy = new Date(currentYear, selectedMonth, 1);
    var lastDayOfMonth = new Date(currentYear, selectedMonth + 1, 0, 23, 59, 59).getTime() / 1000;
    let dummy2 = new Date(currentYear, selectedMonth + 1, 0, 23, 59, 59);
    if (offsetInHours > 0) {
        firstDayOfMonth -= (offsetInHours + 36) * 60 * 60;
        //  lastDayOfMonth -= offsetInHours * 60 * 60;
    }
    return { firstDay: firstDayOfMonth, lastDay: lastDayOfMonth };
}


async function verifyChannelAccess(interaction, limitChannel = false, limitCategory = false) {

    let accessGranted = false;
    let accessList = '';

    const limitedAccessConf = readConfig().limitedAccessConf;

    if (limitChannel) {
        if (!limitedAccessConf.channelIds.includes(interaction.channelId)) {
            if (limitedAccessConf.channelIds.length > 0) {
                accessList = limitedAccessConf.channelIds.map(id => `<#${id}>`).join(' or ');
            }
        } else {
            accessGranted = true;
        }
    }

    if (limitCategory) {
        if (!limitedAccessConf.categories.includes(interaction.channel.parentId)) {
            if (limitedAccessConf.categories.length > 0) {
                if (accessList) {
                    accessList += ' or the ';
                }
                accessList += limitedAccessConf.categories.map(id => `**<#${id}>**`).join(' or ') + ' category';
            }
        } else {
            accessGranted = true;
        }
    }

    if (!accessGranted) {
        await interaction.reply({ content: `Nice try! This command can only be used in ${accessList}. If you cannot see the channel or category, you are not meant to use this command :wink:`, ephemeral: true });
    }

    return accessGranted;
}


function readConfig() {
    try {
        return yaml.parse(fs.readFileSync(configFilename, 'utf8'));
    } catch (e) {
        console.log(e);
        return null;
    }
}

module.exports = { checkAPIKey, printLog, readStoredMessageId, writeNewMessageId, getFlagIcon, sortByUntil, updateOrDeleteEmbed, calculateMonthTimestamps, verifyChannelAccess, readConfig };