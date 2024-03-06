const axios = require('axios');
const fs = require('fs');

const { apiKey, comment } = require('../conf/config.json');
const { printLog } = require('../helper/misc');
const { apiKeys } = require('../conf/apiConfig.json');
const apiConfigPath = './conf/apiConfig.json';
const errorCodesToDeactivate = [1, 2, 10, 13]

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
 * @return {Array} an array containing the status, status message, and API response JSON
 */
async function callTornApi(endpoint, selections, criteria = '', fromTS = 0, toTS = 0, timestampTS = 0, stats = '', keyUsage = 'default', externalApIKey = '') {
    let statusMessage;
    let apiJson = '';
    let status = false;

    let from = '', to = '', timestamp = '';

    if (toTS > 0) to = `&to=${toTS}`;
    if (fromTS > 0) from = `&from=${fromTS}`;
    if (timestampTS > 0) timestamp = `&timestamp=${timestampTS}`;
    if (stats.length > 0) stats = `&stat=${stats}`;

    let selectedKey = apiKey;
    let seletedID = 'default';

    if (keyUsage === 'rotate') {
        const activeKeys = apiKeys.filter(key => key.active);
        
        if (activeKeys.length === 0) {
            statusMessage = "No active keys available.";
            return [status, statusMessage, apiJson];
        }
        const randomIndex = Math.floor(Math.random() * activeKeys.length);
        selectedKey = activeKeys[randomIndex].key;
        seletedID = activeKeys[randomIndex].id;
    } else if (keyUsage === 'external') {
        selectedKey = externalApIKey;
    } else if (keyUsage === 'default') {
        selectedKey = apiKey;
    }

    let apiURL = `https://api.torn.com/${endpoint}/${criteria}?selections=${selections}${stats}${from}${to}${timestamp}&key=${selectedKey}&comment=${comment}`;
    printLog(`Key usage = ${keyUsage} (${seletedID}) >> ${apiURL}`);

    try {
        const apiResponse = await axios.get(apiURL);

        if (apiResponse.status >= 200 && apiResponse.status < 300) {
            apiJson = apiResponse.data;

            if (apiJson.hasOwnProperty('error')) {
                statusMessage = `Error Code ${apiJson['error'].code},  ${apiJson['error'].error}.`;
            
                if (errorCodesToDeactivate.includes(apiJson['error'].code)) {
                    // Find the key object by ID and set it to inactive
                    const errorKey = apiKeys.find(key => key.id === seletedID);
                    if (errorKey) {
                        errorKey.active = false;
                        errorKey.errorReason = `${apiJson['error'].code} = ${apiJson['error'].error}`;
                        statusMessage += ` Key ${seletedID} set to inactive.`;
            
                        // Write the updated apiKeys array back to the configuration file
                        fs.writeFileSync(apiConfigPath, JSON.stringify({ apiKeys }, null, 4));
                    }
                }
            } else {
                statusMessage = `Torn API available! ${endpoint} - ${selections}`;
                status = true;
            }
        } else {
            statusMessage = `HTTP error with status code ${apiResponse.status}`;
        }

        statusMessage = printLog(statusMessage);

        return [status, statusMessage, apiJson];
    } catch (error) {
        statusMessage = `An error occurred: ${error.message}`;
        statusMessage = printLog(statusMessage);
        return [status, statusMessage, apiJson];
    }
}

/**
 * Retrieves the key associated with the given id from the apiKeys array.
 *
 * @param {number} id - The id of the key to retrieve
 * @return {string|null} The key associated with the given id, or null if not found
 */
function getKeyById(id) {
  const keyObj = apiKeys.find(key => key.id === id);
  return keyObj ? keyObj.key : null;
}

module.exports = { callTornApi, getKeyById };
