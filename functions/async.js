const fs = require('fs');

let fetch;
(async () => {
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default;
})();

const { EmbedBuilder } = require('discord.js');
const { printLog } = require('../helper/misc');

const NodeCache = require("node-cache");
const myCache = new NodeCache();
const timestampCache = new NodeCache();

async function send_msg(statusChannel, apiKey, comment) {
    let currentDate = moment().format().replace('T', ' ');
    let statusMessage = `Still running on ${hostname}! ${currentDate}`;

    let apiURL = `https://api.torn.com/torn/?selections=timestamp&key=${apiKey}&comment=${comment}`;
    printLog(apiURL);

    let apiResponse = await fetch(apiURL);

    if (apiResponse.ok) { // if HTTP-status is 200-299

        let apiJson = await apiResponse.json();

        if (apiJson.hasOwnProperty('error')) {
            statusMessage = statusMessage + `\nError Code ${apiJson['error'].code},  ${apiJson['error'].error}.`;
        } else {
            statusMessage = statusMessage + `\nTorn API available!`;
        }
    } else {
        statusMessage = statusMessage + `\nGeneral http error.`;
    }

    statusChannel.send(`\`\`\`${statusMessage}\`\`\``);
}


async function checkTerritories(territoryChannel, apiKey, comment) {

    let tornParamsFile = fs.readFileSync('./tornParams.json');

    let tornParams = JSON.parse(tornParamsFile);

    for (let key in tornParams.ttFactionIDs) {
        let faction_id = tornParams.ttFactionIDs[key];

        let territoryURL = `https://api.torn.com/faction/${faction_id}?selections=territory,basic&key=${apiKey}&comment=${comment}`;
        printLog(territoryURL);

        let territoryResponse = await fetch(territoryURL);

        if (territoryResponse.ok) { // if HTTP-status is 200-299

            let territoryJson = await territoryResponse.json();

            if (territoryJson.hasOwnProperty('error')) {
                territoryChannel.send(`Error Code ${territoryJson['error'].code},  ${territoryJson['error'].error}.`);
                let cachedTTs = myCache.get(faction_id);
                if (cachedTTs !== undefined) {
                    if (myCache.set(faction_id, cachedTTs, 120)) printLog(`Cache refreshed for ${faction_id}`);
                }
            } else {
                let faction_name = territoryJson['name'];
                let faction_tag = territoryJson['tag'];
                let faction_icon = `https://factiontags.torn.com/` + territoryJson['tag_image'];


                let territoryEmbed = new EmbedBuilder()
                    .setColor(0xdf691a)
                    .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                    .setTimestamp()
                    .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                let territories = territoryJson ? Object.keys(territoryJson.territory).sort() : null;
                if (!territories || territories.length <= 0) {
                    continue;
                }

                let cachedTTs = myCache.get(faction_id);
                if (cachedTTs !== undefined) {

                    let diffInCache = cachedTTs.filter(x => !territories.includes(x));

                    if (diffInCache.length > 0)
                        territoryEmbed.addFields({ name: 'Abandoned', value: `${faction_name} abandoned ${diffInCache.toString()}.`, inline: false })

                    let diffInTTs = territories.filter(x => !cachedTTs.includes(x));
                    if (diffInTTs.length > 0)
                        territoryEmbed.addFields({ name: 'Claimed', value: `${faction_name} claimed ${diffInTTs.toString()}.`, inline: false })


                    if (diffInCache.length > 0 || diffInTTs.length > 0) {
                        territoryChannel.send({ embeds: [territoryEmbed], ephemeral: false })
                    };

                } else {
                    .printLog('Cache empty');
                }

                if (myCache.set(faction_id, territories, 120)) printLog(`Cache updated for ${faction_name} [${faction_id}] with ${territories}`);
            }
        } else {
            territoryChannel.send(`General http error.`);
        }
    }
}

async function checkArmoury(armouryChannel, apiKey, comment) {

    let tornParamsFile = fs.readFileSync('./tornParams.json');

    let tornParams = JSON.parse(tornParamsFile);
    printLog(tornParams.armouryFilter.toString());

    let currentTimestamp = Math.floor(Date.now() / 1000);
    let timestamp = currentTimestamp;

    let lastTimestamp = timestampCache.get('lastexecution');
    if (lastTimestamp !== undefined) {
        timestamp = lastTimestamp;
    } else {
        printLog('Timestamp cache empty');
    }

    let armouryURL = `https://api.torn.com/faction/?selections=armorynews,basic&from=${timestamp}&key=${apiKey}&comment=${comment}`;
    printLog(armouryURL);

    try {
        const armouryResponse = await fetch(armouryURL);

        if (armouryResponse.ok) {
            const armouryJson = await armouryResponse.json();

            if (armouryJson.hasOwnProperty('error')) {
                armouryChannel.send(`Error Code ${armouryJson['error'].code},  ${armouryJson['error'].error}.`);
                let lastTimestamp = timestampCache.get('lastexecution');

                if (lastTimestamp !== undefined && timestampCache.set('lastexecution', currentTimestamp, 120)) {
                    printLog(`Cache refreshed: ${currentTimestamp}`);
                }
            } else {

                let faction_name = armouryJson['name'];
                let faction_tag = armouryJson['tag'];
                let faction_id = armouryJson['ID'];
                let faction_icon = `https://factiontags.torn.com/` + armouryJson['tag_image'];

                let armouryNews = armouryJson['armorynews'];

                for (let newsID in armouryNews) {

                    let news = armouryNews[newsID].news;
                    let timestamp = armouryNews[newsID].timestamp;

                    let player_url = news.substring(news.indexOf('"') + 1, news.lastIndexOf('"'));
                    let tornId = player_url.substring(player_url.indexOf('=') + 1, player_url.length);
                    let tornUser = news.substring(news.lastIndexOf('"') + 2, news.lastIndexOf('/') - 1);
                    let newstext = news.substring(news.lastIndexOf('>') + 2, news.lastIndexOf('.'));
                    let item = newstext.substring(newstext.lastIndexOf('faction\'s') + 10, newstext.lastIndexOf('items') - 1);
                    if (newstext.includes('loaned')) {
                        item = newstext.substring(newstext.indexOf('loaned') + 7, newstext.lastIndexOf('to') - 1);
                    }

                    if (tornParams.armouryFilter.some(i => item.includes(i))) {
                        let armouryEmbed = new EmbedBuilder()
                            .setColor(0xdf691a)
                            .setTitle(`${tornUser} [${tornId}]`)
                            .setURL(`https://www.torn.com/profiles.php?XID=${tornId}`)
                            .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                            .setTimestamp(timestamp * 1000)
                            .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });


                        armouryEmbed.addFields({ name: `${item}`, value: `${tornUser} [${tornId}] ${newstext}`, inline: false });


                        if (armouryChannel) {
                            armouryChannel.send({ embeds: [armouryEmbed], ephemeral: false });
                        } else {
                            printLog('armouryChannel is undefined');
                        }
                    } else {
                        printLog(`Item not displayed: ${item}`);
                    }
                }

                if (timestampCache.set('lastexecution', currentTimestamp, 120)) printLog(`Cache updated for 'lastexecution' with ${currentTimestamp}`);

            }
        } else {
            throw new Error('General http error.');
        }
    } catch (error) {
        console.log("Catched:" + error.message);
        //armouryChannel.send(error.message);
    }

}

module.exports = { checkTerritories, checkArmoury, send_msg };