const axios = require('axios');
const { apiKey, comment } = require('../config.json');
const { printLog } = require('../helper/misc');

async function callTornApi(endpoint, selections, criteria = '', fromTS = 0, toTS = 0, timestampTS = 0, stats = '') {
    let statusMessage;
    let apiJson = '';
    let status = false;

    let from = '', to = '', timestamp = '';

    if (toTS > 0) to = `&to=${toTS}`;
    if (fromTS > 0) from = `&from=${fromTS}`;
    if (timestampTS > 0) timestamp = `&timestamp=${timestampTS}`;
    if (stats.length > 0) stats = `&stat=${stats}`;

    let apiURL = `https://api.torn.com/${endpoint}/${criteria}?selections=${selections}${stats}${from}${to}${timestamp}&key=${apiKey}&comment=${comment}`;
    printLog(apiURL);

    try {
        const apiResponse = await axios.get(apiURL);

        if (apiResponse.status >= 200 && apiResponse.status < 300) {
            apiJson = apiResponse.data;

            if (apiJson.hasOwnProperty('error')) {
                statusMessage = `Error Code ${apiJson['error'].code},  ${apiJson['error'].error}.`;
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

module.exports = { callTornApi };
