const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
const fs = require('fs');
const yaml = require('yaml');
const { compileFunction } = require('vm');
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
    let message = currentDate + ' | ' + logtext
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
        console.log(`Message ID associated with key '${key}' has been updated to '${newMessageId}'.`);
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
function getFlagIcon(travelStatus, destinationText = '') {

    let direction = '`> `';

    if (travelStatus == 'Abroad' || destinationText.includes('In a')) direction = '`= `';
    if (destinationText.includes('Returning')) direction = '`< `';

    let flag = `:flag_black:`;

    if (destinationText.includes('Argentina') || destinationText.includes('Argentinian')) flag = `:flag_ar:`;
    if (destinationText.includes('Canada') || destinationText.includes('Canadian')) flag = `:flag_ca:`;
    if (destinationText.includes('Cayman') || destinationText.includes('Caymanian ')) flag = `:flag_ky:`;
    if (destinationText.includes('China') || destinationText.includes('Chinese')) flag = `:flag_cn:`;
    if (destinationText.includes('Hawaii') || destinationText.includes('Hawaiian')) flag = `:flag_us:`;
    if (destinationText.includes('Japan') || destinationText.includes('Japanese')) flag = `:flag_jp:`;
    if (destinationText.includes('Mexico') || destinationText.includes('Mexican')) flag = `:flag_mx:`;
    if (destinationText.includes('Africa') || destinationText.includes('African')) flag = `:flag_za:`;
    if (destinationText.includes('Switzerland') || destinationText.includes('Swiss')) flag = `:flag_ch:`;
    if (destinationText.includes('UAE') || destinationText.includes('Emirati')) flag = `:flag_ae:`;
    if (destinationText.includes('Kingdom') || destinationText.includes('British')) flag = `:flag_gb:`;

    return { flag, direction };

}


function getTravelTimes(travelStatus, destinationText = '') {

    let location = '';
    if (destinationText.includes('Argentina') || destinationText.includes('Argentinian')) location = `Argentina`;
    if (destinationText.includes('Canada') || destinationText.includes('Canadian')) location = `Canada`;
    if (destinationText.includes('Cayman') || destinationText.includes('Caymanian ')) location = `Cayman Islands`;
    if (destinationText.includes('China') || destinationText.includes('Chinese')) location = `China`;
    if (destinationText.includes('Hawaii') || destinationText.includes('Hawaiian')) location = `Hawaii`;
    if (destinationText.includes('Japan') || destinationText.includes('Japanese')) location = `Japan`;
    if (destinationText.includes('Mexico') || destinationText.includes('Mexican')) location = `Mexico`;
    if (destinationText.includes('Africa') || destinationText.includes('African')) location = `South Africa`;
    if (destinationText.includes('Switzerland') || destinationText.includes('Swiss')) location = `Switzerland`;
    if (destinationText.includes('UAE') || destinationText.includes('Emirati')) location = `UAE`;
    if (destinationText.includes('Kingdom') || destinationText.includes('British')) location = `United Kingdom`;

    const travelJson = fs.readFileSync('./resources/travelTimes.json');
    const travelTimes = JSON.parse(travelJson);

    // Filter travelTimes based on location
    const filteredTravelTimes = travelTimes[location];

    return filteredTravelTimes;

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
 * Sorts the given objects by their name in descending order.
 *
 * @param {Object} a - The first object to compare
 * @param {Object} b - The second object to compare
 * @return {number} 1 if a.name < b.name, -1 if a.name > b.name, 0 if equal
 */
function sortByName(a, b) {
    const lowercaseA = a.name.toLowerCase();
    const lowercaseB = b.name.toLowerCase();

    if (lowercaseA < lowercaseB) {
        return 1;
    } else if (lowercaseA > lowercaseB) {
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
async function updateOrDeleteEmbed(channel, embedType, embed, method = 'edit', factionId = '') {
    if (factionId != '') factionId = `_${factionId}`;

    const messageIdName = `${embedType}EmbedMessageId${factionId}`;
    const embedMessageId = readStoredMessageId(messageIdName);

    try {
        if (embedMessageId) {
            const originalMessage = await channel.messages.fetch(embedMessageId);
            await originalMessage[method]({ embeds: [embed], ephemeral: false });
        } else {
            const newMessage = await channel.send({ embeds: [embed], ephemeral: false });
            writeNewMessageId(messageIdName, newMessage.id);
        }
    } catch (error) {
        if (method !== 'delete') {
            const newMessage = await channel.send({ embeds: [embed], ephemeral: false });
            writeNewMessageId(messageIdName, newMessage.id);
        } else {
            //deleteStoredMessageId(`${embedType}EmbedMessageId`);
        }
    }

}


/**
 * Function to calculate Unix timestamps for the first and last day of a selected month.
 *
 * @param {number} selectedMonth - The selected month for which to calculate timestamps.
 * @param {number} [offsetInHours=0] - The offset in hours to adjust the timestamps.
 * @return {Object} An object containing the Unix timestamps of the first and last day.
 */
function calculateMonthTimestamps(selectedMonth, offsetInHours = 0) {
    // Get the year
    var currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    if (selectedMonth > currentMonth) {
        currentYear--;
    }

    var firstDayOfMonth = new Date(currentYear, selectedMonth, 1).getTime() / 1000;
    var lastDayOfMonth = new Date(currentYear, selectedMonth + 1, 0, 23, 59, 59).getTime() / 1000;
    if (offsetInHours > 0) {
        firstDayOfMonth -= (offsetInHours + 36) * 60 * 60;
        //  lastDayOfMonth -= offsetInHours * 60 * 60;
    }
    return { firstDay: firstDayOfMonth, lastDay: lastDayOfMonth };
}

/**
 * Calculate Unix timestamps for the first and last day of the last X days.
 *
 * @param {number} numDays - The number of days to go back
 * @param {number} [offsetInHours=0] - The offset in hours to adjust the timestamps
 * @return {Object} An object containing the Unix timestamps of the first and last day
 */
function calculateLastXDaysTimestamps(numDays, offsetInHours = 0) {
    const currentDate = new Date();
    const lastDayOfXDays = new Date(currentDate.getTime());
    lastDayOfXDays.setDate(lastDayOfXDays.getDate());

    const firstDayOfXDays = new Date(currentDate.getTime());
    firstDayOfXDays.setDate(firstDayOfXDays.getDate() - (numDays - 1));

    let firstDayTimestamp = firstDayOfXDays.getTime() / 1000;
    let lastDayTimestamp = lastDayOfXDays.getTime() / 1000;

    if (offsetInHours > 0) {
        firstDayTimestamp -= (offsetInHours + 36) * 60 * 60;
        //lastDayTimestamp -= offsetInHours * 60 * 60;
    }

    return { firstDay: firstDayTimestamp.toFixed(0), lastDay: lastDayTimestamp.toFixed(0) };
}


/**
 * Verifies the access of a user in a specific channel or category based on the provided interaction.
 *
 * @param {Object} interaction - The interaction object representing the user's interaction.
 * @param {boolean} [limitChannel=false] - Whether to limit the access based on channel.
 * @param {boolean} [limitCategory=false] - Whether to limit the access based on category.
 * @return {boolean} Whether the user has access or not.
 * @deprecated Use verifyRoleAccess instead
 */
async function verifyChannelAccess(interaction, limitChannel = false, limitCategory = false) {

    let accessGranted = false;
    let accessList = '';

    const { categories, channelIds, adminChannelId } = readConfig().limitedAccessConf;

    if (limitChannel) {
        if (!channelIds.includes(interaction.channelId)) {
            if (channelIds.length > 0) {
                accessList += '\n- ' + channelIds.map(id => `<#${id}>`).join(' or ');
            }
        } else {
            accessGranted = true;
        }
    }

    if (limitCategory) {
        if (!categories.includes(interaction.channel.parentId)) {
            if (categories.length > 0) {
                accessList += '\n- the ' + categories.map(id => `**<#${id}>**`).join(' or ') + ' category';
            }
        } else {
            accessGranted = true;
        }
    }

    if (!accessGranted) {
        accessList += `\n- the **admin channel** <#${adminChannelId}>`;
    }

    if (adminChannelId.includes(interaction.channelId)) {
        accessGranted = true;
    }

    if (!accessGranted) {
        const notificationEmbed = initializeEmbed(`Error 418 - You're a teapot`, 'error');
        notificationEmbed.setDescription(`:teapot: Nice try!\nThis command can only be used in ${accessList}.`);
        await interaction.reply({ embeds: [notificationEmbed], ephemeral: true });
    }

    return accessGranted;
}

/**
 * Checks if the user has at least one of the allowed roles to execute the command.
 * If the user does not have permission, sends an ephemeral error message with the allowed roles.
 * @param {Interaction} interaction - The interaction object.
 * @param {Object} factionData - The faction data from the configuration file.
 * @return {boolean} If the user has permission to execute the command.
 */
async function verifyRoleAccess(interaction, factionData) {
    const allowedRoles = factionData.discordConf.allowedRoles || [];
    const userRoles = interaction.member.roles.cache; // Get the user's roles

    console.log(`User roles: ${userRoles.map(role => role.name).join(', ')}`);
    console.log(`User roles: ${userRoles.map(role => role.id).join(', ')}`);
    console.log(`Allowed roles: ${allowedRoles.join(', ')}`);

    // Check if user has at least one of the allowed roles
    const hasRole = allowedRoles.some(roleId => userRoles.has(roleId));

    const allowedRolesMentions = allowedRoles.map(roleId => `<@&${roleId}>`);

    const allowedRolesString = allowedRolesMentions.join(", ");


    if (!hasRole) {
        const notificationEmbed = initializeEmbed(`Error 418 - You're a teapot`, 'error');
        notificationEmbed.setDescription(`:no_entry: You do not have permission to use this command in this channel.\nAllowed roles: ${allowedRolesString}`);
        await interaction.reply({ embeds: [notificationEmbed], ephemeral: true });
    }

    return hasRole;
}

/**
 * Verifies if the user is in the admin channel.
 *
 * @param {Object} interaction - The interaction object representing the user's interaction.
 * @param {Object} limitedAccessConf - The config containing the admin channel ID.
 * @return {boolean} True if the user is in the admin channel, false otherwise.
 */
async function verifyAdminAccess(interaction, limitedAccessConf) {
    // Check if the user is in the admin channel
    const isInAdminChannel = interaction.channelId === limitedAccessConf.adminChannelId;

    if (!isInAdminChannel) {
        const notificationEmbed = initializeEmbed(`Error 418 - You're a teapot`, 'error');
        notificationEmbed.setDescription(`:teapot: Nice try!\nThis command can only be used in the **admin channel** <#${limitedAccessConf.adminChannelId}>.`);
        await interaction.reply({ embeds: [notificationEmbed], ephemeral: true });
    }

    return isInAdminChannel; // Admin access granted if user is in the admin channel
}

/**
 * Verifies if the command is executed in a valid category (family or faction).
 *
 * @param {Object} interaction - The interaction object representing the user's interaction.
 * @param {Object} limitedAccessConf - The config containing the family category ID.
 * @param {Object} factions - The config containing faction categories.
 * @return {boolean} True if the user is in an allowed category (family or faction), false otherwise.
 */async function verifyCategoryAccess(interaction, limitedAccessConf, factions) {
    const categoryId = interaction.channel?.parentId; // Get the category ID of the channel

    // Check if the user is in the family category or one of its subcategories
    if (Array.isArray(limitedAccessConf.familyCategoryId)) {
        if (limitedAccessConf.familyCategoryId.includes(categoryId)) {
            return true; // Access allowed if in one of the family categories
        }
    } else if (categoryId === limitedAccessConf.familyCategoryId) {
        return true; // Access allowed if it's a single family category
    }

    // Check if the category is one of the faction categories
    for (const factionId in factions) {
        const faction = factions[factionId];
        const factionCategories = Array.isArray(faction.channels.factionCategoryId)
            ? faction.channels.factionCategoryId
            : [faction.channels.factionCategoryId]; // Normalize to array

        if (factionCategories.includes(categoryId)) {
            return true; // Access allowed if in one of the faction categories
        }
    }

    return false; // Access denied if not in a valid category
}


/**
 * Reads the configuration file and parses it into a JavaScript object.
 *
 * @return {Object|null} The parsed configuration object or null if an error occurred.
 */
function readConfig() {
    try {
        return yaml.parse(fs.readFileSync(configFilename, 'utf8'));
    } catch (e) {
        console.log(e);
        return null;
    }
}

/**
 * Initializes an embed with the given title and category.
 *
 * @param {string} title - The title of the embed.
 * @param {string} [category='default'] - The category of the embed. Defaults to 'default'.
 * @return {EmbedBuilder} The initialized embed.
 */
function initializeEmbed(title, category = 'default', colorCode = '') {
    const { embedColor, successColor, errorColor } = readConfig().discordConf;
    let color = 0x2695d1;
    switch (category.toLowerCase()) {
        case 'success': color = successColor; break;
        case 'error': color = errorColor; break;
        case 'overwrite': if (colorCode) color = colorCode; else color = embedColor; break;
        default: color = embedColor;
    }

    const embed = new EmbedBuilder().setColor(color)
        .setTitle(title)
        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' })
        .setTimestamp();

    return embed;
}

/**
 * Cleans the specified channel by deleting messages and threads.
 *
 * @param {Object} channel - The channel to be cleaned.
 * @return {void} This function does not return a value.
 */
async function cleanChannel(channel) {
    if (!channel) {
        console.log(`Channel with ID ${channelId} does not exist.`);
        return;
    }

    try {
        const fetchedMessages = await channel.messages.fetch();
        const messageIDs = fetchedMessages.map((msg) => msg.id);

        for (const id of messageIDs) {
            await channel.messages.delete(id);
        }

        printLog(`<${channel.name}> emptied from messaged!`);
    } catch (err) {
        console.error('Error deleting messages:', err);
    }

    try {
        await deleteThreads(channel);
        printLog(`<${channel.name}> emptied from threads!`);
    } catch (err) {
        console.error('Error deleting threads:', err);
    }
}
/**
 * Deletes all threads in a given channel.
 *
 * @param {Object} channel - The channel from which to delete threads.
 * @return {Promise<void>} A Promise that resolves when all threads have been deleted.
 */
async function deleteThreads(channel) {
    if (!channel) {
        console.log(`Channel with ID ${channelId} does not exist.`);
        return;
    }
    channel.threads.cache.forEach(thread => {
        if (thread.name != 'Flight Tracker') {
            thread.delete();
            printLog(`Thread ${thread.name} deleted!`);
        }
    });
}

/**
 * Retrieves the faction configuration based on the interaction's channel or category.
 *
 * @param {Object} interaction - The interaction object representing the user's interaction.
 * @return {string|null} The faction ID if found and enabled, otherwise null.
 */
function getFactionConfigFromChannel(interaction) {
    const guild = interaction.guild;
    const channelId = interaction.channelId || null;
    const channel = guild.channels.cache.get(channelId);

    if (!channel) {
        console.warn(`Channel not found for ID: ${channelId}`);
        return null;
    }

    // Traverse to find the effective category
    const parentChannelId = channel.parentId; // Parent channel (if it's a thread)
    const categoryChannel = parentChannelId
        ? guild.channels.cache.get(parentChannelId)?.parent // Category of the parent channel
        : channel.parent; // Category directly if it's a channel

    const effectiveCategoryId = categoryChannel?.id || parentChannelId || channelId;

    const factionsConfig = readConfig().factions;

    for (const factionId in factionsConfig) {
        const faction = factionsConfig[factionId];
        const factionChannels = faction.channels || {};
        const factionCategories = factionChannels.factionCategoryId || [];

        // Normalize factionCategoryId to an array
        const categories = Array.isArray(factionCategories) ? factionCategories : [factionCategories];

        // Check if the effectiveCategoryId matches any faction categories
        if (faction.enabled && categories.includes(effectiveCategoryId)) {
            console.log(
                `Faction ${faction.name} (${factionId}) matched by effective category: "${guild.channels.cache.get(effectiveCategoryId)?.name || 'Unknown'}" (ID: ${effectiveCategoryId}).`
            );
            return { id: factionId, ...faction };
        }
    }

    console.warn(
        `No enabled faction found for channel: "${channel.name || 'Unknown'}" (ID: ${channelId}), effective category: "${guild.channels.cache.get(effectiveCategoryId)?.name || 'Unknown'}" (ID: ${effectiveCategoryId}).`
    );
    return null;
}



module.exports = { deleteThreads, cleanChannel, checkAPIKey, printLog, readStoredMessageId, writeNewMessageId, getFlagIcon, sortByUntil, sortByName, updateOrDeleteEmbed, calculateMonthTimestamps, calculateLastXDaysTimestamps, verifyRoleAccess, readConfig, initializeEmbed, getTravelTimes, getFactionConfigFromChannel, verifyAdminAccess, verifyCategoryAccess };