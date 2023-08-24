const axios = require('axios');
const fs = require('fs');

const { apiKey, comment } = require('../conf/config.json');
const { printLog } = require('../helper/misc');
const { apiKeys } = require('../conf/apiConfig.json');
const apiConfigPath = './conf/apiConfig.json';
const errorCodesToDeactivate = [1, 2, 10, 13]

async function callTornApi(endpoint, selections, criteria = '', fromTS = 0, toTS = 0, timestampTS = 0, stats = '', keyUsage = 'default') {
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
                statusMessage = `Torn API available!`;
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

function getKeyById(id) {
  const keyObj = apiKeys.find(key => key.id === id);
  return keyObj ? keyObj.key : null;
}

module.exports = { callTornApi, getKeyById };
