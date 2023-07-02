const fs = require('fs');

let fetch;
(async () => {
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default;
})();

const { EmbedBuilder } = require('discord.js');
const { printLog } = require('../helper/misc');
const { callTornApi } = require('../functions/api');
const { homeFaction } = require('../config.json');

const NodeCache = require("node-cache");
const myCache = new NodeCache();
const timestampCache = new NodeCache();

const moment = require('moment');
const os = require('os');
const hostname = os.hostname();

async function send_msg(statusChannel, apiKey, comment) {
    let currentDate = moment().format().replace('T', ' ');
    let statusMessage = `${currentDate} > Still running on ${hostname}!`;

    let result = await callTornApi('torn', 'timestamp');

    statusChannel.send(`\`\`\`${statusMessage}\n${result[1]}\`\`\``);
}


async function checkTerritories(territoryChannel, apiKey, comment) {

    let tornParamsFile = fs.readFileSync('./tornParams.json');

    let tornParams = JSON.parse(tornParamsFile);

    let territorywars =  await callTornApi('torn', 'territorywars');
    let territoriesInWar;
    if (territorywars[0]) {
        let territoryWarJson = territorywars[2];
        territoriesInWar = territoryWarJson ? Object.keys(territoryWarJson.territorywars).sort() : null;
    }


    for (let key in tornParams.ttFactionIDs) {
        let faction_id = tornParams.ttFactionIDs[key];

        let response = await callTornApi('faction', 'territory,basic', faction_id);
        if (response[0]) {
            let territoryJson = response[2];

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
                    territoryEmbed.addFields({ name: `${faction_name} abandoned:`, value: `${diffInCache.toString()}`, inline: false })

                let diffInTTs = territories.filter(x => !cachedTTs.includes(x));
                if (diffInTTs.length > 0)
                    territoryEmbed.addFields({ name: `${faction_name} claimed:`, value: `${diffInTTs.toString()}`, inline: false })

                let factionTTInAssault = territories.filter(x => territoriesInWar.includes(x));
                if (factionTTInAssault.length > 0) {
                    territoryEmbed.addFields({ name: `${faction_name} is defending:`, value: `${factionTTInAssault}.`, inline: false })                        
                } 

                if (diffInCache.length > 0 || diffInTTs.length > 0) {
                    territoryEmbed.addFields({ name: `${faction_name} holds now:`, value: `${territories}.`, inline: false })
                    territoryChannel.send({ embeds: [territoryEmbed], ephemeral: false })
                };

            } else {
                printLog('Territory cache empty');
            }

            

            if (myCache.set(faction_id, territories, 120)) printLog(`Cache updated for ${faction_name} [${faction_id}] with ${territories}`);
        }

    }
}

async function checkArmoury(armouryChannel, apiKey, comment) {

    let tornParamsFile = fs.readFileSync('./tornParams.json');

    let tornParams = JSON.parse(tornParamsFile);

    let currentTimestamp = Math.floor(Date.now() / 1000);
    let timestamp = currentTimestamp;

    let lastTimestamp = timestampCache.get('armouryExecTime');
    if (lastTimestamp !== undefined) {
        timestamp = lastTimestamp;
    } else {
        printLog('Armoury timestamp cache empty');
    }

    let response = await callTornApi('faction', 'armorynews,basic', '', timestamp);

    if (response[0]) {
        let armouryJson = response[2];

        let faction_name = armouryJson['name'];
        let faction_tag = armouryJson['tag'];
        let faction_id = armouryJson['ID'];
        let faction_icon = `https://factiontags.torn.com/` + armouryJson['tag_image'];

        let armouryNews = armouryJson['armorynews'];

        for (let newsID in armouryNews) {

            let news = armouryNews[newsID].news;
            let timestamp = armouryNews[newsID].timestamp;

            if (!news.includes('deposited') && !news.includes('returned')) {

                let player_url = news.substring(news.indexOf('"') + 1, news.lastIndexOf('"'));
                let tornId = player_url.substring(player_url.indexOf('=') + 1, player_url.length);
                let tornUser = news.substring(news.lastIndexOf('"') + 2, news.lastIndexOf('/') - 1);
                let newstext = news.substring(news.lastIndexOf('>') + 2, news.lastIndexOf('.'));
                let item = newstext.substring(newstext.lastIndexOf('faction\'s') + 10, newstext.lastIndexOf('items') - 1);
                if (newstext.includes('loaned')) {
                    item = newstext.substring(newstext.indexOf('loaned') + 7, newstext.lastIndexOf('to') - 1);
                }
                if (newstext.includes('gave')) {
                    item = newstext.substring(newstext.indexOf('gave') + 7, newstext.lastIndexOf('to') - 1);
                }
                if (newstext.includes('refill their energy')) {
                    item = 'Energy refill (25 points)';
                }

                if (tornParams.armouryFilter.some(i => item.includes(i))) {
                    let armouryEmbed = new EmbedBuilder()
                        .setColor(0xdf691a)
                        // .setTitle(`${tornUser} [${tornId}]`)
                        // .setURL(`https://www.torn.com/profiles.php?XID=${tornId}`)
                        .setAuthor({ name: `${tornUser} [${tornId}]`, iconURL: faction_icon, url: `https://www.torn.com/profiles.php?XID=${tornId}` })
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
        }

        if (timestampCache.set('armouryExecTime', currentTimestamp, 120)) printLog(`Cache updated for 'armouryExecTime' with ${currentTimestamp}`);

    }
}

async function checkRetals(retalChannel, apiKey, comment) {

    let currentTimestamp = Math.floor(Date.now() / 1000);
    let timestamp = currentTimestamp;

    let lastTimestamp = timestampCache.get('retalExecTime');
    if (lastTimestamp !== undefined) {
        timestamp = lastTimestamp;
    } else {
        printLog('Retal timestamp cache empty');
    }

    let response = await callTornApi('faction', 'attacks,basic', '', timestamp);

    if (response[0]) {
        let attacksJson = response[2];
        let faction_name = attacksJson['name'];
        let faction_tag = attacksJson['tag'];
        let faction_id = attacksJson['ID'];
        let faction_icon = `https://factiontags.torn.com/` + attacksJson['tag_image'];

        let attacks = attacksJson['attacks'];

        for (let attackID in attacks) {

            let timestamp_ended = attacks[attackID].timestamp_ended;
            let attacker_id = attacks[attackID].attacker_id;
            let attacker_name = attacks[attackID].attacker_name;
            let attacker_faction = attacks[attackID].attacker_faction;
            let attacker_factionname = attacks[attackID].attacker_factionname;
            let defender_id = attacks[attackID].defender_id;
            let defender_name = attacks[attackID].defender_name;
            let deadline = moment.unix(timestamp_ended).add(5, 'm') / 1000;
            let stealthed = attacks[attackID].stealthed;
            let respect = attacks[attackID].respect;

            if (attacker_faction.toString() != homeFaction.toString() && stealthed === 0 && respect > 0) {

                let attackEmbed = new EmbedBuilder()
                    .setColor(0xdf691a)
                    .setTitle(`Retal on ${attacker_name} [${attacker_id}]`)
                    .setURL(`https://www.torn.com/loader.php?sid=attack&user2ID=${attacker_id}`)
                    .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                    .setDescription(`Retal deadline <t:${deadline}:R>`)
                    .setTimestamp()
                    .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });;


                attackEmbed.addFields({ name: `Defender`, value: `${defender_name} [${defender_id}]`, inline: false });
                attackEmbed.addFields({ name: `Attacker`, value: `${attacker_name} [${attacker_id}] of ${attacker_factionname}`, inline: false });
                printLog(`Defender ${defender_name} [${defender_id}] < Attacker ${attacker_name} [${attacker_id}] of ${attacker_factionname}`);


                if (retalChannel) {
                    retalChannel.send({ embeds: [attackEmbed], ephemeral: false });
                } else {
                    printLog('retalChannel is undefined');
                }
            }
        }

        if (timestampCache.set('retalExecTime', currentTimestamp, 120)) printLog(`Cache updated for 'retalExecTime' with ${currentTimestamp}`);

    }
}

module.exports = { checkTerritories, checkArmoury, checkRetals, send_msg };