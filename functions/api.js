const axios = require('axios');
const fs = require('fs');
const moment = require('moment');

const { printLog, readConfig, updateOrDeleteEmbed, initializeEmbed } = require('../helper/misc');
const { decodeApiKeyWithCypher } = require('../helper/formattings');

const apiConfigPath = './conf/apiConfig.json';

const { apiKey, comment, homeFaction } = readConfig().apiConf;


/**
 * An asynchronous function to call the Torn API with specified parameters and key usage.
 *
 * @param {string} endpoint - the API endpoint to be called
 * @param {string} selections - the data to be selected from the API response
 * @param {string} [criteria=''] - the search criteria for the API request
 * @param {number} [fromTS=0] - the starting timestamp for the API request
 * @param {number} [toTS=0] - the ending timestamp for the API request
 * @param {number} [timestampTS=0] - the specific timestamp for the API request
 * @param {string} [stats=''] - the additional stats to be included in the request
 * @param {string} [keyUsage='default'] - the usage type of the API key
 * @param {string} [externalApIKey=''] - the external API key to use
 * @param {string} [version=''] - the version of the API to use
 * @param {string} [urlParams=''] - the additional URL parameters to include in the request
 * @return {Array} an array containing the status, status message, and API response JSON
 */
async function callTornApi(endpoint, selections, criteria = '', fromTS = 0, toTS = 0, timestampTS = 0, stats = '', keyUsage = 'default', externalApIKey = '', version = '', urlParams = '', homeFactionId = '') {
    let apiKeys;
    let apiConfig; // Define apiConfig outside the try block

    let statusMessage;
    let apiJson = '';
    let status = false;

    try {
        apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));
        apiKeys = apiConfig.apiKeys;
    } catch (error) {
        statusMessage = "Error reading apiKeys from file system.";
        return [status, statusMessage, apiJson];
    }

    let from = '', to = '', timestamp = '';

    if (toTS > 0) to = `&to=${toTS}`;
    if (fromTS > 0) from = `&from=${fromTS}`;
    if (timestampTS > 0) timestamp = `&timestamp=${timestampTS}`;
    if (stats.length > 0) stats = `&stat=${stats}`;

    let selectedKey;

    if (apiKey.includes(';')) {
      const keys = apiKey.split(';');
      selectedKey = keys[Math.floor(Math.random() * keys.length)];
    } else {
      selectedKey = apiKey;
    }
    
    let seletedID = 'default';

    if (keyUsage === 'rotate') {
        const activeKeys = apiKeys.filter(key => key.active);
        
        if (activeKeys.length === 0) {
            statusMessage = "No active keys available.";
            printLog(statusMessage, 'warn');
            return [status, statusMessage, apiJson];
        }
        const randomIndex = Math.floor(Math.random() * activeKeys.length);
        selectedKey = activeKeys[randomIndex].key;
        seletedID = activeKeys[randomIndex].id;

    } else if (keyUsage === 'revive') {
        const activeReviverKeys = apiKeys.filter(key => key.active && key.reviver);
        
        if (activeReviverKeys.length === 0) {
            statusMessage = "No active keys available.";
            printLog(statusMessage, 'warn');
            return [status, statusMessage, apiJson];
        }
        const randomIndex = Math.floor(Math.random() * activeReviverKeys.length);
        selectedKey = activeReviverKeys[randomIndex].key;
        seletedID = activeReviverKeys[randomIndex].id;
        
    } else if (keyUsage === 'faction') {
        const activeFationKeys = apiKeys.filter(key => key.active && key.factionAccess);
        
        if (activeFationKeys.length === 0) {
            statusMessage = "No active keys available.";
            printLog(statusMessage, 'warn');
            return [status, statusMessage, apiJson];
        }
        const randomIndex = Math.floor(Math.random() * activeFationKeys.length);
        selectedKey = activeFationKeys[randomIndex].key;
        seletedID = activeFationKeys[randomIndex].id;
        
    } else if (keyUsage === 'external') {
        selectedKey = externalApIKey;
    } else if (keyUsage === 'default') {
        if (homeFactionId.length > 0) {
            selectedKey = readConfig().factions[homeFactionId].apiKey;
        } else {
            selectedKey = selectedKey;    
        }
        
    }

    selectedKey = decodeApiKeyWithCypher(selectedKey);

    if (version.length > 0) version = `${version}/`;
    if (version.includes('v2')) urlParams += `&id=${criteria}`;

    let apiURL = `https://api.torn.com/${version}${endpoint}/${criteria}?selections=${selections}${stats}${from}${to}${timestamp}${urlParams}&key=${selectedKey}&comment=${comment}`;
    printLog(`Key usage = ${keyUsage} (${seletedID}) >> ${apiURL}`);

    try {
        const apiResponse = await axios.get(apiURL);

        if (apiResponse.status >= 200 && apiResponse.status < 300) {
            apiJson = apiResponse.data;

            if (apiJson.hasOwnProperty('error')) {
                statusMessage = `Error Code ${apiJson['error'].code} >> ${apiJson['error'].error}.`;

                const errorCodes = apiConfig.apiErrorCodes[0];
                const errorCodeToCheck = apiJson['error'].code;
            
                if (errorCodes[errorCodeToCheck] && errorCodes[errorCodeToCheck].active) {
                    // Find the key object by ID and set it to inactive
                    printLog(`Key ${selectedKey} set to inactive.`, 'warn');
                    const errorKeyIndex = apiKeys.findIndex(key => key.key === selectedKey);
                    if (errorKeyIndex !== -1) {
                        apiConfig.apiKeys[errorKeyIndex].active = false;
                        apiConfig.apiKeys[errorKeyIndex].errorReason = `${apiJson['error'].code} = ${apiJson['error'].error}`;
                        statusMessage += ` Key of user with ID ${seletedID} set to inactive.`;
                        
                        // Write the updated apiKeys array back to the configuration file
                        fs.writeFileSync(apiConfigPath, JSON.stringify(apiConfig, null, 4));
                    }
                }
            } else {
                statusMessage = `Torn API available! ${endpoint} - ${selections}`;
                status = true;
            }
        } else {
            statusMessage = `HTTP error with status code ${apiResponse.status}`;
        }

        if (!status) printLog(statusMessage, 'warn');

        return [status, statusMessage, apiJson];
    } catch (error) {
        statusMessage = `An error occurred: ${error.message}`;
        printLog(statusMessage, 'error');
        return [status, statusMessage, apiJson];
    }
}

/**
 * Verifies API keys in the given configuration, updates their status, and sends a verification message.
 *
 * @param {string} statusChannel - The channel where the verification status message will be sent.
 * @param {number} verificationInterval - The interval in hours at which the API keys are verified.
 * @param {boolean} [manualMode=false] - A flag to indicate if the function is running in manual mode.
 */
async function verifyKeys(statusChannel, verificationInterval, manualMode = false) {
    const now = moment();
    const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));

    let verificationCount = 0;
    const totalKeys = apiConfig.apiKeys.length;

    for (const apiKey of apiConfig.apiKeys) {
        if (apiKey.active || !apiKey.hasOwnProperty('active')) {
            await verifyAPIKey(apiKey, apiConfig.comment);
            printLog(`Verified API Key: ${apiKey.key}, active: ${apiKey.active}`);
            verificationCount++;
        }
    }

    fs.writeFileSync(apiConfigPath, JSON.stringify(apiConfig, null, 4));
    const statusMessage = `API Key verification executed for ${verificationCount} active of ${totalKeys} total keys!`;
    printLog(statusMessage);

    const verifyEmbed = initializeEmbed('API Key Status');

    if (manualMode) {

        verifyEmbed.addFields({ name: 'Check result', value: `\`${statusMessage}\``, inline: false });

        return verifyEmbed;
    }

    verifyEmbed.setDescription(`_Verification interval: every ${verificationInterval} hours._\nNext status check: <t:${now.unix() + (verificationInterval) * 60 * 60}:R>`)
    verifyEmbed.addFields({ name: 'Last check result', value: `\`${statusMessage}\``, inline: false });
    await updateOrDeleteEmbed(statusChannel, 'verifyStatus', verifyEmbed);
}

/**
 * Verifies the API key by making a request to the Torn API server with the provided 
 * API key and comment.
 *
 * @param {object} apiKey - The API key object containing the key value.
 * @param {string} comment - The comment to pass along with the API key for verification.
 * @return {Promise<void>} The function does not return a value directly, but it updates 
 * the state of the apiKey object.
 */
async function verifyAPIKey(apiKey, comment) {
    const verificationURL = `https://api.torn.com/key/?selections=info&key=${apiKey.key}&comment=${comment}`;
    printLog(`verificationURL >> ${verificationURL}`);
    
    try {
        const response = await axios.get(verificationURL);
        
        if (response.status === 200) {
            const verificationJson = response.data;
            
            if (verificationJson.hasOwnProperty('error')) {
                
                const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));
                const errorCodes = apiConfig.apiErrorCodes[0];

                const errorCodeToCheck = verificationJson['error'].code;

                printLog(`Error Code ${errorCodeToCheck},  ${verificationJson['error'].error}.`, 'error');
                if (errorCodes[errorCodeToCheck] && errorCodes[errorCodeToCheck].active) {
                    apiKey.active = false;
                    apiKey.errorReason = `${verificationJson['error'].code} = ${verificationJson['error'].error}`;
                }
            } else {
                apiKey.access_level = verificationJson.access_level;
                apiKey.access_type = verificationJson.access_type;
                apiKey.active = true;
                await getAdditionalKeyInfo(apiKey);
            }
        } else {
            apiKey.active = false;
        }
    } catch (error) {
        apiKey.active = false;
        console.error(error);
    }
}


/**
 * Retrieves additional key information from the Torn API using the provided API key.
 *
 * @param {Object} apiKey - The API key object containing the key value
 * @return {Promise} A promise that resolves once the additional key information is retrieved
 */
async function getAdditionalKeyInfo(apiKey) {
    const response = await callTornApi('user', 'basic,discord', undefined, undefined, undefined, undefined, undefined, "external", apiKey.key);

    if (response[0]) {
        const playerJson = response[2];
        const tornUser = playerJson['name'];
        const tornId = playerJson['player_id'];
        const discordId = playerJson.discord['discordID'];

        //Check if key owner is reviver
        const reviveResponse = await callTornApi('user', 'profile', '2', undefined, undefined, undefined, undefined, "external", apiKey.key);
        if (reviveResponse[0]) {
            const reviveJson = reviveResponse[2];
            if (reviveJson.revivable == 1) {
                apiKey.reviver = true;
            } else {
                apiKey.reviver = false;
            }
            
            apiKey.id = tornId;
            apiKey.discordId = discordId;
            apiKey.name = tornUser;
        }

        //check if key owner has faction API access
        const factionResponse = await callTornApi('faction', 'currency', undefined, undefined, undefined, undefined, undefined, "external", apiKey.key);
        if (factionResponse[0]) {
            const factionJson = factionResponse[2];
            const faction = readConfig().factions;

            const homeFactions = Object.keys(faction);
            if (homeFactions.includes(factionJson.faction_id.toString())) {
                apiKey.factionAccess = true;
                apiKey.factionId = factionJson.faction_id;
            } else {
                apiKey.factionAccess = false;
            }
        }
    }
}

/**
 * Retrieves the key associated with the given id from the apiKeys array.
 *
 * @param {number} id - The id of the key to retrieve
 * @return {string|null} The key associated with the given id, or null if not found
 */
/*function getKeyById(id) {
  const keyObj = apiKeys.find(key => key.id === id);
  return keyObj ? keyObj.key : null;
}*/

module.exports = { callTornApi, verifyKeys, verifyAPIKey };
