const fs = require('fs');
const axios = require('axios');

const { EmbedBuilder } = require('discord.js');
const { printLog, getFlagIcon, sortByUntil, updateOrDeleteEmbed, calculateMonthTimestamps } = require('../helper/misc');
const { getRemainingTime } = require('../helper/formattings');

const { callTornApi } = require('../functions/api');
const { homeFaction } = require('../conf/config.json');
const apiConfigPath = './conf/apiConfig.json';

const NodeCache = require("node-cache");
const myCache = new NodeCache();
const timestampCache = new NodeCache();

const moment = require('moment');
const os = require('os');
const hostname = os.hostname();

/**
 * Asynchronously sends a message to the specified status channel. 
 *
 * @param {type} statusChannel - the status channel to send the message to
 * @return {type} the result of sending the message
 */
async function sendStatusMsg(statusChannel, statusUpdateInterval, statusMessage = undefined) {
    const now = moment();
    const currentDate = now.format().replace('T', ' ');

    if (statusMessage === undefined) {
        statusMessage = `Still running on ${hostname}!`;
    }

    printLog(statusMessage);

    let result = await callTornApi('torn', 'timestamp');

    const botStatusEmbed = new EmbedBuilder()
    .setColor(0xdf691a)
    .setTitle('Bot Status')
    .setTimestamp()
    .setDescription(`Status check interval: every ${statusUpdateInterval} minutes.\nNext status check: <t:${now.unix() + (statusUpdateInterval * 60)}:R>`)
    .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

    botStatusEmbed.addFields({ name: 'Bot Status', value: `\`${currentDate} > ${statusMessage}\``, inline: false });
    botStatusEmbed.addFields({ name: 'API Status', value: `\`${result[1]}\``, inline: false });

    await updateOrDeleteEmbed(statusChannel, 'botStatus', botStatusEmbed);
}

/**
 * Asynchronously checks territories for a given territory channel.
 *
 * @param {Object} territoryChannel - the channel to check territories in
 * @return {Promise} a Promise that resolves to the result of the function
 */
async function checkTerritories(territoryChannel, territoryUpdateInterval) {

    let tornParamsFile = fs.readFileSync('./conf/tornParams.json');

    let tornParams = JSON.parse(tornParamsFile);

    let territorywars = await callTornApi('torn', 'territorywars', '', undefined, undefined, undefined, undefined, 'rotate');

    let territoriesInWar;
    if (territorywars[0]) {
        let territoryWarJson = territorywars[2];
        territoriesInWar = territoryWarJson && territoryWarJson.territorywars !== null ? Object.keys(territoryWarJson.territorywars).sort() : null;
    }


    for (let key in tornParams.ttFactionIDs) {
        let faction_id = tornParams.ttFactionIDs[key];

        let response = await callTornApi('faction', 'territory,basic', faction_id, undefined, undefined, undefined, undefined, 'rotate');
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

                if (territoriesInWar) {
                    factionTTInAssault = territories.filter(x => territoriesInWar.includes(x));
                } else {
                    factionTTInAssault = []; // Handle the case when territoriesInWar is null or undefined
                }

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

/**
 * Asynchronously checks the armoury for news and updates, and sends the information to the specified channel if available.
 *
 * @param {string} armouryChannel - The channel to send the armoury information to
 * @return {Promise<void>} A promise that resolves once the armoury information has been processed and sent
 */
async function checkArmoury(armouryChannel, armouryUpdateInterval) {

    let tornParamsFile = fs.readFileSync('./conf/tornParams.json');

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
                    item = newstext.substring(newstext.indexOf('gave') + 5, newstext.lastIndexOf('to') - 1);
                }
                if (newstext.includes('refill their energy')) {
                    item = 'Energy refill (25 points)';
                }

                if (tornParams.armouryFilter.some(i => item.includes(i))) {
                    let armouryEmbed = new EmbedBuilder()
                        .setColor(0xdf691a)
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

/**
 * Asynchronously checks and handles retaliations based on a given timestamp.
 *
 * @param {Object} retalChannel - The channel for sending retaliation notifications
 * @return {Promise} A Promise representing the completion of the function
 */
async function checkRetals(retalChannel, retalUpdateInterval) {

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
            let overseas = false;
            if (attacks[attackID].modifiers.overseas > 1) overseas = true;

            if (attacker_faction.toString() != homeFaction.toString() && stealthed === 0 && respect > 0) {

                let attackEmbed = new EmbedBuilder()
                    .setColor(0xdf691a)
                    .setTitle(`Retal on ${attacker_name} [${attacker_id}]`)
                    .setURL(`https://www.torn.com/loader.php?sid=attack&user2ID=${attacker_id}`)
                    .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                    .setDescription(`Retal deadline <t:${deadline}:R>`)
                    .setTimestamp(timestamp_ended * 1000)
                    .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });;


                attackEmbed.addFields({ name: `Defender`, value: `${defender_name} [${defender_id}]`, inline: false });
                attackEmbed.addFields({ name: `Attacker`, value: `${attacker_name} [${attacker_id}] of ${attacker_factionname}`, inline: false });
                printLog(`Defender ${defender_name} [${defender_id}] < Attacker ${attacker_name} [${attacker_id}] of ${attacker_factionname}`);


                if (overseas) attackEmbed.addFields({ name: `Additional Info`, value: `Attack was abroad.`, inline: false });


                if (retalChannel) {
                    const message = await retalChannel.send({ embeds: [attackEmbed], ephemeral: false });

                    setTimeout(() => {
                        attackEmbed.setDescription('Retal expired')
                            .setTitle(`~~Retal on ${attacker_name} [${attacker_id}]~~`)
                            .setURL();
                        attackEmbed.spliceFields(0, 2);
                        message.edit({ embeds: [attackEmbed] });
                    }, 5 * 60 * 1000); // Update after 5 minutes

                    setTimeout(() => {
                        message.delete();
                    }, 15 * 60 * 1000); // Delete after 15 minutes

                } else {
                    printLog('retalChannel is undefined');
                }
            }
        }

        if (timestampCache.set('retalExecTime', currentTimestamp, 120)) printLog(`Cache updated for 'retalExecTime' with ${currentTimestamp}`);

    }
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
                printLog(`Error Code ${verificationJson['error'].code},  ${v['error'].error}.`);
                if (verificationJson['error'].code === 1  || // 1 => Key is empty : Private key is empty in current request.
                    verificationJson['error'].code === 2  || // 2 => Incorrect Key : Private key is wrong/incorrect format.
                    verificationJson['error'].code === 10 || //10 => Key owner is in federal jail : Current key can't be used because owner is in federal jail.
                    verificationJson['error'].code === 13 ||   //13 => The key is temporarily disabled due to owner inactivity : The key owner hasn't been online for more than 7 days.
                    verificationJson['error'].code === 14 ||   //14 => Monthly read limit reached : Too many records have been pulled in total from our cloud services.
                    verificationJson['error'].code === 18    //18 => API key has been paused by the owner.
                ) {
                    apiKey.active = false;
                    apiKey.errorReason = `${verificationJson['error'].code} = ${verificationJson['error'].error}`;
                }
            } else {
                apiKey.access_level = verificationJson.access_level;
                apiKey.access_type = verificationJson.access_type;
                apiKey.active = true;
            }
        } else {
            apiKey.active = false;
        }
    } catch (error) {
        apiKey.active = false;
    }
}


/**
 * Asynchronously verifies API keys and updates the status message in the provided channel.
 *
 * @param {Object} statusChannel - the channel where the status message will be sent
 * @return {Promise<void>} a promise that resolves once the keys are verified and status message is updated
 */
async function verifyKeys(statusChannel, verificationInterval) {
    const now = moment();
    const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));

    let verificationCount = 0;
    const totalKeys = apiConfig.apiKeys.length;

    for (const apiKey of apiConfig.apiKeys) {
        if (apiKey.active || !apiKey.hasOwnProperty('active')) {
            await verifyAPIKey(apiKey, apiConfig.comment);
            printLog(`Verified API Key: ${apiKey.key}.`);
            verificationCount++;
        }
    }

    fs.writeFileSync(apiConfigPath, JSON.stringify(apiConfig, null, 4));
    const statusMessage = `API Key verification executed for ${verificationCount} active of ${totalKeys} total keys!`;
    printLog(statusMessage);

    const verifyEmbed = new EmbedBuilder()
    .setColor(0xdf691a)
    .setTitle('APE Key Status')
    .setTimestamp()
    .setDescription(`API Key veritifaction interval: every ${verificationInterval} hours.\nNext status check: <t:${now.unix() + (verificationInterval) * 60 * 60}:R>`)
    .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

    verifyEmbed.addFields({ name: 'Last check result', value: `\`${statusMessage}\``, inline: false });

    await updateOrDeleteEmbed(statusChannel, 'verifyStatus', verifyEmbed);
}


/**
 * Check the status of a war and update the war channel with relevant information.
 *
 * @param {string} warChannel - The channel where the war information will be updated
 * @param {string} memberChannel - The channel where the member information will be updated
 * @return {Promise<void>} - A promise that resolves when the war and member information are updated
 */
async function checkWar(warChannel, memberChannel, warUpdateInterval) {

    if (warChannel) {

        const responseRW = await callTornApi('faction', 'basic,timestamp');

        if (responseRW[0]) {
            const factionJson = responseRW[2];
            const ownFactionName = factionJson['name'];
            const ownFactionTag = factionJson['tag'];
            const ownFactionID = factionJson['ID'];
            const ownFactionIcon = `https://factiontags.torn.com/` + factionJson['tag_image'];

            const rankedWars = factionJson['ranked_wars'];

            const rwEmbed = new EmbedBuilder();
            const travelEmbed = new EmbedBuilder();
            const hospitalEmbed = new EmbedBuilder();
            const statusEmbed = new EmbedBuilder();
            const ownTravelEmbed = new EmbedBuilder();
            const ownHospitalEmbed = new EmbedBuilder();
            const ownStatusEmbed = new EmbedBuilder();

            const memberLimitForEmbed = 10;


            const rankedWar = Object.values(rankedWars)[0];

            if (rankedWar) {

                const rankedWar = Object.values(rankedWars)[0];
                const factionIDs = Object.keys(rankedWar.factions);

                const faction1ID = factionIDs[0];
                const faction2ID = factionIDs[1];

                const faction1 = rankedWar.factions[faction1ID];
                const faction2 = rankedWar.factions[faction2ID];

                const war = rankedWar.war;

                let fieldFaction1 = '';
                let fieldFaction2 = '';

                let faction1StatusIcon = ':hourglass:';
                let faction2StatusIcon = ':hourglass:';

                let faction1StatusText = '*waiting to start*';
                let faction2StatusText = '*waiting to start*';

                let lead = '';

                let isActive = false;
                let hasEnded = false;
                const timestamp = factionJson.timestamp;

                //start 30 min before
                if (war.start - 1800 < timestamp) {
                    isActive = true;
                    if (war.end > 0) {
                        isActive = false;
                        hasEnded = true;
                    }
                }

                if (faction1.score > faction2.score) {
                    lead = faction1.score - faction2.score;
                    if (isActive) {
                        faction1StatusIcon = ':green_circle:';
                        faction2StatusIcon = ':red_circle:';
                        faction1StatusText = '**winning**';
                        faction2StatusText = '**losing**';
                    }

                    if (hasEnded) {
                        faction1StatusIcon = ':trophy:';
                        faction2StatusIcon = ':skull_crossbones:';
                        faction1StatusText = '**Winner!**';
                        faction2StatusText = '**Loser!**';
                    }


                }

                if (faction1.score < faction2.score) {
                    lead = faction2.score - faction1.score;
                    if (isActive) {
                        faction1StatusIcon = ':red_circle:';
                        faction2StatusIcon = ':green_circle:';
                        faction1StatusText = '**losing**';
                        faction2StatusText = '**winning**';
                    }
                    if (hasEnded) {
                        faction1StatusIcon = ':skull_crossbones:';
                        faction2StatusIcon = ':trophy:';
                        faction1StatusText = '**Loser!**';
                        faction2StatusText = '**Winner!**';
                    }

                }

                let description = `**Starttime:** <t:${war.start}:f> (<t:${war.start}:R>)`;
                if (isActive && !hasEnded && lead > 0) {
                    let remainingTime = getRemainingTime(war.start, war.target, lead, timestamp);
                    description += `\n**Projected End:** <t:${remainingTime}:f> (<t:${remainingTime}:R>)`;
                }
                description += `\n**Target:** ${war.target}`;

                if ((isActive || hasEnded) && lead > 0) {
                    description += `\n**Lead:** ${lead}`;
                }

                fieldFaction1 = `${faction1StatusIcon} ${faction1StatusText}\n**Score:** ${faction1.score}`;
                fieldFaction2 = `${faction2StatusIcon} ${faction2StatusText}\n**Score:** ${faction2.score}`;

                if (hasEnded) {
                    let rwId = Object.keys(rankedWars)[0];

                    let responseReport = await callTornApi('torn', 'rankedwarreport', rwId, undefined, undefined, undefined, undefined, 'rotate');

                    if (responseReport[0]) {
                        let jsonRwReportResponse = responseReport[2];

                        let rankedWarReport = jsonRwReportResponse['rankedwarreport'];

                        let faction1Items = '';
                        let faction2Items = '';


                        for (let itemsId in rankedWarReport.factions[faction1ID].rewards.items) {
                            if (faction1Items == '') {
                                faction1Items = rankedWarReport.factions[faction1ID].rewards.items[itemsId].quantity.toString().padStart(3) + 'x ' + rankedWarReport.factions[faction1ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                            } else {
                                faction1Items = faction1Items + rankedWarReport.factions[faction1ID].rewards.items[itemsId].quantity.toString().padStart(11) + 'x ' + rankedWarReport.factions[faction1ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                            }
                        }

                        for (let itemsId in rankedWarReport.factions[faction2ID].rewards.items) {
                            if (faction2Items == '') {
                                faction2Items = rankedWarReport.factions[faction2ID].rewards.items[itemsId].quantity.toString().padStart(3) + 'x ' + rankedWarReport.factions[faction2ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                            } else {
                                faction2Items = faction2Items + rankedWarReport.factions[faction2ID].rewards.items[itemsId].quantity.toString().padStart(11) + 'x ' + rankedWarReport.factions[faction2ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                            }
                        }

                        description += `\n**Ended:** <t:${war.end}:f> (<t:${war.end}:R>)`;

                        fieldFaction1 += `\n**Rewards:**\n${faction1Items}`;
                        fieldFaction2 += `\n**Rewards:**\n${faction2Items}`;
                    }

                } else {
                    fieldFaction1 += `\n**Chain:**  ${faction1.chain}`;
                    fieldFaction2 += `\n**Chain:**  ${faction2.chain}`;
                }

                rwEmbed.setColor(0xdf691a)
                    .setTitle(`Ranked war between ${faction1.name} and ${faction2.name}`)
                    .setURL(`https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}#/war/rank`)
                    .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` })
                    .setDescription(description)
                    .setTimestamp(timestamp * 1000)
                    .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                rwEmbed.addFields({ name: faction1.name, value: fieldFaction1, inline: true });
                rwEmbed.addFields({ name: faction2.name, value: fieldFaction2, inline: true });

                await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed);

                if (isActive && !hasEnded) {

                    travelEmbed.setColor(0xdf691a)
                        .setTitle(`:airplane: Members traveling`)
                        .setDescription(`List of opponent members, which are traveling`)
                        .setTimestamp(timestamp * 1000)
                        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                    hospitalEmbed.setColor(0xdf691a)
                        .setTitle(`:hospital: Members in hospital`)
                        .setDescription(`List of the next ${memberLimitForEmbed} members which will be out of hospital`)
                        .setTimestamp(timestamp * 1000)
                        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                    statusEmbed.setColor(0xdf691a)
                        .setTitle(`:bar_chart: Member Overview`)
                        .setDescription(`Some details about the member status of each faction`)
                        .setTimestamp(timestamp * 1000)
                        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });


                    ownTravelEmbed.setColor(0xdf691a)
                        .setTitle(`:airplane: Members traveling`)
                        .setDescription(`List of ${ownFactionName} members, which are traveling`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` })
                        .setTimestamp(timestamp * 1000)
                        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                    ownHospitalEmbed.setColor(0xdf691a)
                        .setTitle(`:hospital: Members in hospital`)
                        .setDescription(`List of the next ${memberLimitForEmbed} members which will be out of hospital`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` })
                        .setTimestamp(timestamp * 1000)
                        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                    ownStatusEmbed.setColor(0xdf691a)
                        .setTitle(`:bar_chart: Member Overview`)
                        .setDescription(`Some details about the member status of ${ownFactionName}`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` })
                        .setTimestamp(timestamp * 1000)
                        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                    for (var factionID in rankedWar.factions) {
                        const responseMembers = await callTornApi('faction', 'basic', factionID, undefined, undefined, undefined, undefined, 'rotate');

                        if (responseMembers[0]) {
                            let travelingMembers = '';
                            let hospitalMembers = '';
                            let hospitalMemberCount = 0;
                            let okayMemberCount = 0;
                            let travelingMemberCount = 0;
                            let abroadMemberCount = 0;
                            let jailMembersCount = 0;
                            let federalMembersCount = 0;
                            let membersOnline = 0;
                            let membersOffline = 0;
                            let membersIdle = 0;

                            const faction = responseMembers[2];
                            const membersList = faction.members;
                            const memberCount = Object.keys(membersList).length;


                            let memberIndex = {}

                            for (var id in membersList) {
                                memberIndex[membersList[id].name] = id;
                            }

                            const sortedMembers = Object.values(membersList).sort(sortByUntil).reverse();

                            for (var id in sortedMembers) {

                                let member = sortedMembers[id];
                                let memberStatusState = member.status.state;
                                let lastActionStatus = member.last_action.status;


                                //check Traveling status
                                if (memberStatusState == 'Traveling' || memberStatusState == 'Abroad') {

                                    if (memberStatusState == 'Traveling') {
                                        travelingMemberCount++;
                                    } else {
                                        abroadMemberCount++;
                                    }

                                    if (travelingMemberCount + abroadMemberCount < memberLimitForEmbed) {
                                        const flagIcon = getFlagIcon(memberStatusState, member.status.description);
                                        const entry = `${flagIcon} [${member.name}](https://www.torn.com/profiles.php?XID=${memberIndex[member.name]})\n`;
                                        travelingMembers += entry;
                                    }
                                }

                                //check Hospital status
                                if (memberStatusState == 'Hospital') {
                                    let timeDifference = (member.status.until - timestamp) / 60;

                                    if (timeDifference < 60) {
                                        hospitalMemberCount++;
                                        if (hospitalMemberCount < memberLimitForEmbed) {
                                            const entry = `:syringe: [${member.name}](https://www.torn.com/loader.php?sid=attack&user2ID=${memberIndex[member.name]}) <t:${member.status.until}:R>\n`;
                                            hospitalMembers += entry;
                                        }
                                    }
                                }

                                if (memberStatusState == 'Okay') {
                                    okayMemberCount++;
                                }

                                if (memberStatusState == 'Jail') {
                                    jailMembersCount++;
                                }

                                if (memberStatusState == 'Federal') {
                                    federalMembersCount++;
                                }

                                switch (lastActionStatus) {
                                    case 'Online': membersOnline++; break;
                                    case 'Offline': membersOffline++; break;
                                    case 'Idle': membersIdle++; break;
                                    default: break;
                                }

                            }

                            if (travelingMembers == '') travelingMembers = '*none*';
                            if (hospitalMembers == '') hospitalMembers = '*none*';

                            statusEmbed.addFields({ name: `${faction.name}`, value: `:ok_hand: Okay: ${okayMemberCount}\n:airplane: Traveling: ${travelingMemberCount}\n:golf: Abroad: ${abroadMemberCount}\n:syringe: Hospital: ${hospitalMemberCount}\n:oncoming_police_car: Jail: ${jailMembersCount}\n:no_entry_sign: Federal: ${federalMembersCount}\n\n:green_circle: Online: ${membersOnline}\n:yellow_circle: Idle: ${membersIdle}\n:black_circle: Offline: ${membersOffline}`, inline: true });

                            if (factionID != ownFactionID) {
                                travelEmbed.addFields({ name: `${faction.name}\nTraveling: (${travelingMemberCount}/${memberCount})\nAbroad: (${abroadMemberCount}/${memberCount})`, value: `${travelingMembers}`, inline: true });
                                hospitalEmbed.addFields({ name: `${faction.name}\nIn hospital: (${hospitalMemberCount}/${memberCount})`, value: `${hospitalMembers}`, inline: true });
                            }

                            if (factionID == ownFactionID) {
                                ownTravelEmbed.addFields({ name: `${faction.name}\nTraveling: (${travelingMemberCount}/${memberCount})\nAbroad: (${abroadMemberCount}/${memberCount})`, value: `${travelingMembers}`, inline: true });
                                ownHospitalEmbed.addFields({ name: `${faction.name}\nIn hospital: (${hospitalMemberCount}/${memberCount})`, value: `${hospitalMembers}`, inline: true });
                                ownStatusEmbed.addFields({ name: `${faction.name}`, value: `:airplane: Traveling: ${travelingMemberCount}\n:syringe: Hospital: ${hospitalMemberCount}\n:golf: Abroad: ${abroadMemberCount}\n:ok_hand: Okay: ${okayMemberCount}`, inline: true });
                            }
                        }
                    }

                    if (warChannel) {
                        await updateOrDeleteEmbed(warChannel, 'status', statusEmbed); // Defaults to 'edit'
                        await updateOrDeleteEmbed(warChannel, 'hospital', hospitalEmbed); // Defaults to 'edit'
                        await updateOrDeleteEmbed(warChannel, 'travel', travelEmbed); // Defaults to 'edit'
                    }

                    if (memberChannel) {
                        //await updateOrDeleteEmbed(memberChannel, 'ownStatus', ownStatusEmbed); // Defaults to 'edit'
                        await updateOrDeleteEmbed(memberChannel, 'ownTravel', ownTravelEmbed); // Defaults to 'edit'
                        await updateOrDeleteEmbed(memberChannel, 'ownHospital', ownHospitalEmbed); // Defaults to 'edit'
                    }

                } else {
                    if (warChannel) {
                        await updateOrDeleteEmbed(warChannel, 'status', statusEmbed, 'delete');
                        await updateOrDeleteEmbed(warChannel, 'hospital', hospitalEmbed, 'delete');
                        await updateOrDeleteEmbed(warChannel, 'travel', travelEmbed, 'delete');
                    }

                    if (memberChannel) {
                        //await updateOrDeleteEmbed(memberChannel, 'ownStatus', ownStatusEmbed, 'delete');
                        await updateOrDeleteEmbed(memberChannel, 'ownTravel', ownTravelEmbed, 'delete');
                        await updateOrDeleteEmbed(memberChannel, 'ownHospital', ownHospitalEmbed, 'delete');
                    }
                }
            } else {

                const responseMainNews = await callTornApi('faction', 'mainnews,timestamp', undefined, undefined, undefined, undefined, undefined, 'default');

                if (responseMainNews[0]) {
                    const newsJson = responseMainNews[2];
                    const mainnews = newsJson['mainnews'];
                    const timestamp = newsJson.timestamp;
                    let isEnlisted = false;
                    let enlistedTimestamp = 0;
                    let description = '';
                    for (var newsID in mainnews) {
                        let news = mainnews[newsID];

                        if (news['news'].includes(' could not be matched with a suitable opponent')) {
                            description = `:warning: **${ownFactionName}** could not be matched with a suitable opponent - we remain enlisted for priority matchmaking.\n\n`;
                        }

                        if (news['news'].includes(' enlisted the faction')) {
                            isEnlisted = true;
                            enlistedTimestamp = `<t:${news['timestamp']}:f>`;
                            description += `:ballot_box_with_check: Faction is enlisted since ${enlistedTimestamp}`;
                            break;
                        }

                        if (news['news'].includes(' unenlisted the faction')) {
                            break;
                        }

                        if (news['news'].includes('defeated') && news['news'].includes('in a ranked war')) {
                            break;
                        }
                    }

                    if (isEnlisted) {

                        printLog('Faction is enlisted!');

                        rwEmbed.setColor(0xdf691a)
                            .setTitle(`Faction is currently enlisted!`)
                            .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` })
                            .setDescription(description)
                            .setTimestamp(timestamp * 1000)
                            .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                        if (warChannel) {
                            await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed);
                        }

                    } else {
                        if (warChannel) {
                            await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed, 'delete');
                        }
                    }
                } else {
                    if (warChannel) {
                        await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed, 'delete');
                    }
                }

            }
        }

    } else {
        printLog('warChannel is undefined');
    }
}


/**
 * Function to check faction members in jail and update or delete the embed in the given memberChannel.
 *
 * @param {Object} memberChannel - The Discord channel to update or delete the embed in.
 * @return {Promise} A promise that resolves when the embed is updated or deleted.
 */
async function checkMembers(memberChannel, memberUpdateInterval) {

    if (memberChannel) {

        const response = await callTornApi('faction', 'basic,timestamp', homeFaction);
        let jailEmbed = new EmbedBuilder();
        let ownStatusEmbed = new EmbedBuilder();

        if (response[0]) {
            const factionJson = response[2];
            const ownFactionName = factionJson['name'];
            const ownFactionTag = factionJson['tag'];
            const ownFactionId = factionJson['ID'];
            const ownFactionIcon = `https://factiontags.torn.com/` + factionJson['tag_image'];
            const timestamp = factionJson['timestamp'];
            const members = factionJson['members'];

            let hospitalMemberCount = 0;
            let okayMemberCount = 0;
            let travelingMemberCount = 0;
            let abroadMemberCount = 0;
            let jailMembersCount = 0;
            let federalMembersCount = 0;
            let jailMembers = '';

            let membersOnline = 0;
            let membersOffline = 0;
            let membersIdle = 0;

            const faction = response[2];
            const membersList = faction.members;

            let memberIndex = {}

            for (var id in membersList) {
                memberIndex[membersList[id].name] = id;
            }
            const sortedMembers = Object.values(membersList).sort(sortByUntil);


            for (var id in sortedMembers) {

                let member = sortedMembers[id];
                let memberStatusState = member.status.state;
                let lastActionStatus = member.last_action.status;

                if (memberStatusState == 'Jail') {
                    const entry = `:oncoming_police_car: [${member.name}](https://www.torn.com/profiles.php?XID=${memberIndex[member.name]}) out <t:${member.status.until}:R>\n`;
                    jailMembers += entry;
                }

                switch (memberStatusState) {
                    case 'Hospital': hospitalMemberCount++; break;
                    case 'Okay': okayMemberCount++; break;
                    case 'Traveling': travelingMemberCount++; break;
                    case 'Abroad': abroadMemberCount++; break;
                    case 'Jail': jailMembersCount++; break;
                    case 'Federal': federalMembersCount++; break;
                    default: break;
                }

                switch (lastActionStatus) {
                    case 'Online': membersOnline++; break;
                    case 'Offline': membersOffline++; break;
                    case 'Idle': membersIdle++; break;
                    default: break;
                }

            }
            if (jailMembers) {
                jailEmbed.setColor(0xdf691a)
                    .setTitle(':oncoming_police_car: Bust a fox!')
                    .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionId}` })
                    .setTimestamp(timestamp * 1000)
                    .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                const MAX_FIELD_LENGTH = 1024; // Maximum allowed length for field value

                // Split jailMembers into multiple chunks
                const chunks = [];
                let currentChunk = '';
                const lines = jailMembers.split('\n');
                for (const line of lines) {
                    if ((currentChunk + line).length > MAX_FIELD_LENGTH) {
                        chunks.push(currentChunk);
                        currentChunk = line + '\n';
                    } else {
                        currentChunk += line + '\n';
                    }
                }
                if (currentChunk !== '') {
                    chunks.push(currentChunk);
                }

                // Add each chunk as a separate field
                chunks.forEach((chunk, index) => {
                    jailEmbed.addFields({ name: `Members in jail (${index + 1}/${chunks.length})`, value: chunk, inline: true });
                });
                await updateOrDeleteEmbed(memberChannel, 'jail', jailEmbed);
            } else {
                await updateOrDeleteEmbed(memberChannel, 'jail', jailEmbed, 'delete');
            }

            ownStatusEmbed.setColor(0xdf691a)
                .setTitle(`:bar_chart: Member Overview`)
                .setDescription(`Some details about the member status of ${ownFactionName}`)
                .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionId}` })
                .setTimestamp(timestamp * 1000)
                .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

            ownStatusEmbed.addFields({ name: `Member Status`, value: `:ok_hand: Okay: ${okayMemberCount}\n:airplane: Traveling: ${travelingMemberCount}\n:golf: Abroad: ${abroadMemberCount}\n:syringe: Hospital: ${hospitalMemberCount}\n:oncoming_police_car: Jail: ${jailMembersCount}\n:no_entry_sign: Federal: ${federalMembersCount}`, inline: true });
            ownStatusEmbed.addFields({ name: `Online Status`, value: `:green_circle: Online: ${membersOnline}\n:yellow_circle: Idle: ${membersIdle}\n:black_circle: Offline: ${membersOffline}`, inline: true });

            await updateOrDeleteEmbed(memberChannel, 'ownStatus', ownStatusEmbed);
        }
    }
}

async function getOCStats(selectedMonthValue) {

    var today = new Date();
    var firstDayOfMonth, lastDayOfMonth;
    let title = '';
    
    if (!selectedMonthValue) {
        selectedMonthValue = today.getMonth();
        title = `*Current Month*`;
    } else {
        selectedMonthValue--;
    }

    // Calculate timestamps using the offset
    var timestamps = calculateMonthTimestamps(selectedMonthValue, 192);

    var firstDayOfMonth = timestamps.firstDay;
    var lastDayOfMonth = timestamps.lastDay;

    const response = await callTornApi('faction', 'basic,crimes,timestamp', undefined, firstDayOfMonth, lastDayOfMonth);

    if (!response[0]) {
        await interaction.reply({ content: response[1], ephemeral: true });
        return;
    }

    const factionJson = response[2];

    const members = factionJson?.members || [];
    const crimeData = factionJson?.crimes || [];


    if (members.length === 0) {
        await interaction.reply({ content: 'No members found!', ephemeral: false });
        return;
    }

    const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson;

    const faction_icon_URL = `https://factiontags.torn.com/${factionJson['tag_image']}`;
    const crimeList = [8];

    const lastDateFormatted = (new Date(lastDayOfMonth * 1000)).toISOString().replace('T', ' ').replace('.000Z', '');

    if (title === '') {
        title = `*${lastDateFormatted.substring(0, 7)}*`;
    }

    const ocEmbed = new EmbedBuilder()
        .setColor(0xdf691a)
        .setTitle(`OC Overview for ${title}`)
        .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
        .setTimestamp()
        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });


    const crimeSummary = {};


    for (const id in crimeData) {

        const crime = crimeData[id];


        if (crimeList.includes(crime.crime_id)) {

            if (crime.initiated === 1) {

                var ts = new Date(crime.time_completed * 1000);
                var formatted_date = ts.toISOString().replace('T', ' ').replace('.000Z', '');

                if (crime.time_completed >= firstDayOfMonth && crime.time_completed <= lastDayOfMonth) {
                    printLog("---> " + formatted_date + " " + crime.crime_name + " " + crime.respect_gain);

                    if (!crimeSummary[crime.crime_name]) {
                        crimeSummary[crime.crime_name] = {
                            total: 0,
                            success: 0,
                            failed: 0,
                            money_gain: 0
                        };
                    }

                    crimeSummary[crime.crime_name].total++;
                    crimeSummary[crime.crime_name].money_gain += crime.money_gain;

                    if (crime.success === 1) {
                        crimeSummary[crime.crime_name].success++;
                    } else {
                        crimeSummary[crime.crime_name].failed++;
                    }
                }
            }
        }
    }

    for (const crimeName in crimeSummary) {
        const { total, success, failed } = crimeSummary[crimeName];
        const successRate = (success / total) * 100;

        ocEmbed.addFields({ name: crimeName, value: `:blue_circle: \`${'Total'.padEnd(12, ' ')}:\` ${total}\n:green_circle: \`${'Success'.padEnd(12, ' ')}:\` ${success}\n:red_circle: \`${'Failed'.padEnd(12, ' ')}:\` ${failed}\n:chart_with_upwards_trend: \`${'Success rate'.padEnd(12, ' ')}:\` **${successRate.toFixed(2)}%**\n:moneybag: \`${'Money gained'.padEnd(12, ' ')}:\` $${crimeSummary[crimeName].money_gain.toLocaleString('en')}`, inline: true });
    }

    return ocEmbed;
    
}

async function checkOCs(memberChannel, memberUpdateInterval) {

    const ownStatusEmbed = await getOCStats();

    await updateOrDeleteEmbed(memberChannel, 'ocStatus', ownStatusEmbed);
}

module.exports = { checkTerritories, checkArmoury, checkRetals, checkWar, checkMembers, sendStatusMsg, verifyKeys, verifyAPIKey, getOCStats, checkOCs };