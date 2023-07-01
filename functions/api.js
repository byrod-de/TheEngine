const { apiKey, comment } = require('../config.json');
const { printLog } = require('../helper/misc');

let fetch;
(async () => {
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default;
})();


async function callTornApi(endpoint, selections, criteria = '', from = 0, to = 0, timestamp = 0, stats = '') {

    let statusMessage;
    let apiJson = '';
    let status = false;

    if (to > 0) to = `&to=${to}`;
    if (from > 0) from = `&from=${from}`;
    if (timestamp > 0) timestamp = `&timestamp=${timestamp}`;
    if (stats.length > 0) stats = `&stat=${stats}`;

    let apiURL = `https://api.torn.com/${endpoint}/${criteria}?selections=${selections}${stats}${from}${to}${timestamp}&key=${apiKey}&comment=${comment}`;
    printLog(apiURL);

    let apiResponse = await fetch(apiURL);

    if (apiResponse.ok) { // if HTTP-status is 200-299

        apiJson = await apiResponse.json();

        if (apiJson.hasOwnProperty('error')) {
            statusMessage = `Error Code ${apiJson['error'].code},  ${apiJson['error'].error}.`;
        } else {
            statusMessage = `Torn API available!`;
            status = true;
        }
    } else {
        statusMessage = `General http error.`;
    }

    statusMessage = printLog(statusMessage);

    return [status, statusMessage, apiJson];
}

module.exports = { callTornApi };