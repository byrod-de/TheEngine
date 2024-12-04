const fs = require('node:fs');

const { printLog, getFlagIcon, sortByUntil, sortByName, updateOrDeleteEmbed, readConfig, calculateMonthTimestamps, calculateLastXDaysTimestamps, initializeEmbed, getTravelTimes, cleanChannel, deleteThreads } = require('../helper/misc');
const { abbreviateNumber, numberWithCommas, extractFromRegex, cleanUpString, createProgressBar, splitIntoChunks, capitalize, formatTornDate } = require('../helper/formattings');

const { importCsvToSheet } = require('../functions/google');

const { callTornApi, callTornStatsApi } = require('../functions/api');

const NodeCache = require("node-cache");
const timestampCache = new NodeCache();
const messageIdCache = new NodeCache();
const memberCache = new NodeCache();
const itemCache = new NodeCache();

const moment = require('moment');
const os = require('os');
const { error } = require('node:console');

const hostname = os.hostname();

const { minDelay } = readConfig().apiConf;
const { exportAttacks, exportContributors } = readConfig().exportConf;
const { embedColor, successColor, errorColor } = readConfig().discordConf;

const tornParamsFile = fs.readFileSync('./conf/tornParams.json');
const tornParams = JSON.parse(tornParamsFile);

const apiConfigPath = './conf/apiConfig.json';

/**
 * Send a status message to the specified channel at regular intervals.
 *
 * @param {Object} statusChannel - The channel to send the status message to
 * @param {number} statusUpdateInterval - The interval at which to send status updates, in minutes
 * @param {string} statusMessage - The message to include in the status update
 * @return {Promise<void>} A promise that resolves once the status message is sent
 */
async function sendStatusMsg(statusChannel, statusUpdateInterval, statusMessage = undefined, startUpTime = undefined) {
    const now = moment();
    const currentDate = now.format().replace('T', ' ');

    if (statusMessage === undefined) {
        statusMessage = `Still running on ${hostname}!`;
    }

    let result = await callTornApi('torn', 'timestamp');

    const botStatusEmbed = initializeEmbed('Bot Status');
    botStatusEmbed.setDescription(`_Check interval: every ${statusUpdateInterval} minutes._\nNext status check: <t:${now.unix() + (statusUpdateInterval * 60)}:R>`);

    if (startUpTime === undefined) startUpTime = timestampCache.get('startUpTime');
    if (timestampCache.set('startUpTime', startUpTime, 120 * statusUpdateInterval)) printLog(`Cache updated for 'startUpTime' with ${startUpTime}`);

    botStatusEmbed.addFields({ name: 'Start Up Time', value: `\`${startUpTime}\``, inline: false });
    botStatusEmbed.addFields({ name: 'Bot Status', value: `\`${currentDate} > ${statusMessage}\``, inline: false });
    botStatusEmbed.addFields({ name: 'API Status', value: `\`${result[1]}\``, inline: false });

    await updateOrDeleteEmbed(statusChannel, 'botStatus', botStatusEmbed);
}



/**
 * Checks the faction's armoury news and sends a message to the specified channel
 * if a user has used an item from the armoury.
 *
 * @param {Object} armouryChannel - The channel to send the message to
 * @param {number} homeFactionId - The ID of the faction to check
 * @return {Promise<void>} A promise that resolves once the message is sent
 */
async function checkArmoury(armouryChannel, homeFactionId, factionConfig) {
    const tornParamsFile = fs.readFileSync('./conf/tornParams.json');
    const tornParams = JSON.parse(tornParamsFile);

    const currentTimestamp = Math.floor(Date.now() / 1000);
    let timestamp = currentTimestamp;

    let lastTimestamp = timestampCache.get('armouryExecTime_' + homeFactionId);
    if (lastTimestamp !== undefined) {
        timestamp = lastTimestamp;
    } else {
        printLog(homeFactionId + ' > Armoury timestamp cache empty');
    }

    let response = await callTornApi('faction', 'armorynews,basic', homeFactionId, timestamp, undefined, undefined, undefined, undefined, undefined, undefined, undefined, homeFactionId);

    if (response[0]) {
        let armouryJson = response[2];

        let faction_icon = `https://factiontags.torn.com/` + armouryJson['tag_image'];

        let armouryNews = armouryJson['armorynews'];

        for (let newsID in armouryNews) {

            let news = armouryNews[newsID].news;

            if (!news.includes('deposited') && !news.includes('returned')) {

                let player_url = news.substring(news.indexOf('"') + 1, news.lastIndexOf('"'));
                let tornId = player_url.substring(player_url.indexOf('=') + 1, player_url.length);
                let tornUser = news.substring(news.lastIndexOf('"') + 2, news.lastIndexOf('/') - 1);
                let newstext = news.substring(news.lastIndexOf('>') + 2, news.length);
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
                    const armouryEmbed = initializeEmbed('Armoury Usage', 'overwrite', factionConfig.embedColor)
                    armouryEmbed.setAuthor({ name: `${cleanUpString(tornUser)} [${tornId}]`, iconURL: faction_icon, url: `https://byrod.cc/p/${tornId}` });

                    armouryEmbed.addFields({ name: `${item}`, value: `${tornUser} [${tornId}] ${newstext}`, inline: false });


                    if (armouryChannel) {
                        armouryChannel.send({ embeds: [armouryEmbed], ephemeral: false });
                    } else {
                        printLog(homeFactionId + ' > armouryChannel is undefined', 'warn');
                    }
                }
            }
        }

        if (timestampCache.set('armouryExecTime_' + homeFactionId, currentTimestamp, 120)) printLog(homeFactionId + ` > Cache updated for 'armouryExecTime_${homeFactionId}' with ${currentTimestamp}`);

    }
}


/**
 * Asynchronously checks the retals for the faction and updates the retal channel.
 *
 * @param {Object} retalChannel - The retal channel to check for retals
 * @param {number} homeFactionId - The ID of the faction to check
 * @return {Promise<void>} A Promise that resolves once the embed is updated or deleted
 */
async function checkRetals(retalChannel, homeFactionId, factionConfig) {

    const currentTimestamp = Math.floor(Date.now() / 1000);
    let timestamp = currentTimestamp;

    let lastTimestamp = timestampCache.get('retalExecTime_' + homeFactionId);
    if (lastTimestamp !== undefined) {
        timestamp = lastTimestamp;
    } else {
        printLog(homeFactionId + ' > Retal timestamp cache empty');
    }

    let response = await callTornApi('faction', 'attacks,basic', homeFactionId, timestamp, undefined, undefined, undefined, undefined, undefined, undefined, undefined, homeFactionId);

    if (response[0]) {
        let attacksJson = response[2];

        let faction_name = attacksJson['name'];
        let faction_tag = attacksJson['tag'];
        let faction_id = attacksJson['ID'];
        let faction_icon = `https://factiontags.torn.com/` + attacksJson['tag_image'];

        let attacks = attacksJson['attacks'];

        //save json to file
        if (exportAttacks && Object.keys(attacks).length > 0) fs.writeFileSync(`./exports/attacks_${faction_id}_${timestamp}.json`, JSON.stringify(attacks, null, 2));

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

            if (attacker_faction.toString() != homeFactionId.toString() && stealthed === 0 && respect > 0) {
                const attackEmbed = initializeEmbed(`Retal on ${cleanUpString(attacker_name)} [${attacker_id}]`, 'overwrite', factionConfig.embedColor);

                attackEmbed.setURL(`https://byrod.cc/a/${attacker_id}`)
                    .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://byrod.cc/f/${faction_id}` })
                    .setDescription(`Retal deadline <t:${deadline}:R>`);

                attackEmbed.addFields({ name: `Defender`, value: `[${cleanUpString(defender_name)}](https://byrod.cc/p/${defender_id}) [${defender_id}]`, inline: false });
                attackEmbed.addFields({ name: `Attacker`, value: `[${cleanUpString(attacker_name)}](https://byrod.cc/p/${attacker_id}) [${attacker_id}] of ${attacker_factionname}`, inline: false });

                if (overseas) attackEmbed.addFields({ name: `Additional Info`, value: `:golf: Attack was abroad.`, inline: false });


                if (retalChannel) {
                    const message = await retalChannel.send({ embeds: [attackEmbed], ephemeral: false });

                    setTimeout(() => {
                        attackEmbed.setDescription('Retal expired')
                            .setTitle(`~~Retal on ${cleanUpString(attacker_name)} [${attacker_id}]~~`)
                            .setURL();
                        attackEmbed.spliceFields(0, 2);
                        message.edit({ embeds: [attackEmbed] });
                    }, 5 * 60 * 1000); // Update after 5 minutes

                    setTimeout(() => {
                        message.delete();
                    }, 15 * 60 * 1000); // Delete after 15 minutes

                } else {
                    printLog(homeFactionId + ' > retalChannel is undefined', 'warn');
                }
            }
        }

        if (timestampCache.set('retalExecTime_' + homeFactionId, currentTimestamp, 120)) printLog(`${homeFactionId} > Cache updated for 'retalExecTime_${homeFactionId}' with ${currentTimestamp}`);

    }
}

/**
 * Asynchronously checks the war status and updates the war-related information in the specified warChannel and memberChannel.
 *
 * @param {string} warChannel - The channel for displaying war-related information.
 * @param {string} memberChannel - The channel for displaying member-related information.
 * @param {number} warUpdateInterval - The interval for updating war-related information.
 * @return {Promise} A promise that resolves when the war status is checked and the information is updated.
 */
async function checkWar(warChannel, memberChannel, warUpdateInterval, travelChannel = undefined, homeFactionId = undefined, factionConfig = undefined) {

    if (warChannel) {

        const responseRW = await callTornApi('faction', 'basic,timestamp', homeFactionId, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, homeFactionId);

        if (responseRW[0]) {
            const factionJson = responseRW[2];
            const ownFactionName = factionJson['name'];
            const ownFactionTag = factionJson['tag'];
            const ownFactionID = factionJson['ID'];
            const ownFactionIcon = `https://factiontags.torn.com/` + factionJson['tag_image'];

            const rankedWars = factionJson['ranked_wars'];
            const raidWars = factionJson['raid_wars'];

            const rwEmbed = initializeEmbed(`Embed`, 'overwrite', factionConfig.embedColor);
            const travelEmbed = initializeEmbed(`Embed`, 'overwrite', factionConfig.embedColor);
            const abroadEmbed = initializeEmbed(`Embed`, 'overwrite', factionConfig.embedColor);
            const hospitalEmbed = initializeEmbed(`Embed`, 'overwrite', factionConfig.embedColor);
            const statusEmbed = initializeEmbed(`Embed`, 'overwrite', factionConfig.embedColor);
            const ownTravelEmbed = initializeEmbed(`Embed`, 'overwrite', factionConfig.embedColor);
            const ownAbroadEmbed = initializeEmbed(`Embed`, 'overwrite', factionConfig.embedColor);
            const ownHospitalEmbed = initializeEmbed(`Embed`, 'overwrite', factionConfig.embedColor);
            const ownStatusEmbed = initializeEmbed(`Embed`, 'overwrite', factionConfig.embedColor);

            const rankedWar = Object.values(rankedWars)[0];

            let isEnlisted = false;
            let rankedWarActive = false;
            let raidWarActive = false;

            if (rankedWar) {

                rankedWarActive = true;
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

                let rwIsActive = false;
                let rwHasEnded = false;
                const timestamp = factionJson.timestamp;

                //start x min before
                const preStart = 60 * 60;
                if (war.start - preStart < timestamp) {
                    rwIsActive = true;
                    if (war.end > 0) {
                        rwIsActive = false;
                        rwHasEnded = true;
                    }
                }

                if (faction1.score > faction2.score) {
                    lead = faction1.score - faction2.score;
                    if (rwIsActive) {
                        faction1StatusIcon = ':green_circle:';
                        faction2StatusIcon = ':red_circle:';
                        faction1StatusText = '**winning**';
                        faction2StatusText = '**losing**';
                    }

                    if (rwHasEnded) {
                        faction1StatusIcon = ':trophy:';
                        faction2StatusIcon = ':skull_crossbones:';
                        faction1StatusText = '**Winner!**';
                        faction2StatusText = '**Loser!**';
                    }


                }

                if (faction1.score < faction2.score) {
                    lead = faction2.score - faction1.score;
                    if (rwIsActive) {
                        faction1StatusIcon = ':red_circle:';
                        faction2StatusIcon = ':green_circle:';
                        faction1StatusText = '**losing**';
                        faction2StatusText = '**winning**';
                    }
                    if (rwHasEnded) {
                        faction1StatusIcon = ':skull_crossbones:';
                        faction2StatusIcon = ':trophy:';
                        faction1StatusText = '**Loser!**';
                        faction2StatusText = '**Winner!**';
                    }

                }

                let description = `**Start time:** <t:${war.start}:f> (<t:${war.start}:R>)`;

                description += `\n**Target:** \`${war.target.toString().padStart(6, ' ')}\` `;

                if ((rwIsActive || rwHasEnded) && lead > 0) {
                    description += `**Lead:** \`${lead.toString().padStart(6, ' ')}\``;
                    let currentLead = lead;
                    if (faction1StatusText.toLocaleLowerCase().includes('win')) {
                        currentLead = -1 * currentLead;
                    }
                    description += `\n${createProgressBar(currentLead, war.target, 'scale', 18)}`;
                }

                fieldFaction1 = `${faction1StatusIcon} ${faction1StatusText}\n:game_die: **Score:** ${faction1.score}`;
                fieldFaction2 = `${faction2StatusIcon} ${faction2StatusText}\n:game_die: **Score:** ${faction2.score}`;

                if (rwHasEnded) {
                    let rwId = Object.keys(rankedWars)[0];

                    let responseReport = await callTornApi('torn', 'rankedwarreport', rwId, undefined, undefined, undefined, undefined, 'rotate');

                    if (responseReport[0]) {
                        let jsonRwReportResponse = responseReport[2];

                        let rankedWarReport = jsonRwReportResponse['rankedwarreport'];

                        let faction1Items = '';
                        let faction2Items = '';

                        //get chache prices:
                        const cacheArray = ['1118', '1119', '1120', '1121', '1122'];
                        let market_prices = {};

                        for (let i = 0; i < cacheArray.length; i++) {

                            const cacheId = cacheArray[i];
                            const itemPrice = itemCache.get(cacheId);

                            if (itemPrice) {
                                market_prices[cacheId] = itemPrice;
                                continue;
                            }

                            const cacheInformation = await callTornApi('torn', 'items', cacheId, undefined, undefined, undefined, undefined, 'rotate');

                            if (cacheInformation[0]) {
                                const cacheJson = cacheInformation[2];
                                market_prices[cacheId] = cacheJson.items[cacheId].market_value;
                            }
                            const cacheTTL = 60 * 60;
                            itemCache.set(cacheId, market_prices[cacheId], cacheTTL);
                            printLog(`Item price ${cacheId} added to cache for ${cacheTTL} seconds.`);
                        }

                        let faction1ItemValue = 0;
                        let faction2ItemValue = 0;

                        faction1Items += '- ' + numberWithCommas(rankedWarReport.factions[faction1ID].rewards.respect) + ' Respect\n';
                        faction1Items += '- ' + numberWithCommas(rankedWarReport.factions[faction1ID].rewards.points) + ' Points\n';
                        faction2Items += '- ' + numberWithCommas(rankedWarReport.factions[faction2ID].rewards.respect) + ' Respect\n';
                        faction2Items += '- ' + numberWithCommas(rankedWarReport.factions[faction2ID].rewards.points) + ' Points\n';

                        for (let itemsId in rankedWarReport.factions[faction1ID].rewards.items) {
                            faction1ItemValue += market_prices[itemsId] * rankedWarReport.factions[faction1ID].rewards.items[itemsId].quantity;
                            faction1Items += '- ' + rankedWarReport.factions[faction1ID].rewards.items[itemsId].quantity.toString().padStart(3) + 'x ' + rankedWarReport.factions[faction1ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                        }

                        for (let itemsId in rankedWarReport.factions[faction2ID].rewards.items) {
                            faction2ItemValue += market_prices[itemsId] * rankedWarReport.factions[faction2ID].rewards.items[itemsId].quantity;
                            faction2Items += '- ' + rankedWarReport.factions[faction2ID].rewards.items[itemsId].quantity.toString().padStart(3) + 'x ' + rankedWarReport.factions[faction2ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                        }

                        description += `\n**Ended:** <t:${war.end}:f> (<t:${war.end}:R>)`;

                        fieldFaction1 += `\n:gift: **Rewards:**\n${faction1Items}`;
                        fieldFaction1 += `:dollar: **Estimated Cache value:** *${abbreviateNumber(faction1ItemValue)}*\n- \$${numberWithCommas(faction1ItemValue)}`;
                        fieldFaction2 += `\n:gift: **Rewards:**\n${faction2Items}`;
                        fieldFaction2 += `:dollar: **Estimated Cache value:** *${abbreviateNumber(faction2ItemValue)}*\n- \$${numberWithCommas(faction2ItemValue)}`;
                    }

                } else {
                    fieldFaction1 += `\n:link: **Chain:**  ${faction1.chain}`;
                    fieldFaction2 += `\n:link: **Chain:**  ${faction2.chain}`;
                }

                rwEmbed.setTitle(`Ranked war between _${faction1.name}_ and _${faction2.name}_`)
                    .setURL(`https://byrod.cc/f/${ownFactionID}#/war/rank`)
                    .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://byrod.cc/f/${ownFactionID}` })
                    .setDescription(`${description}\n_Update interval: every ${warUpdateInterval} minutes._`);

                const cachedMessageIdRw = messageIdCache.get(`${ownFactionID}-rw`);

                if (!cachedMessageIdRw) {
                    await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed, 'edit', homeFactionId);
                }
                messageIdCache.set(`${ownFactionID}-rw`, 'running', 3600);

                if (rwIsActive && !rwHasEnded) {

                    travelEmbed.setTitle(`:airplane: Members traveling`)
                        .setDescription(`List of members, which are traveling\n_Update interval: every ${warUpdateInterval} minutes._`);
                    abroadEmbed.setTitle(`:golf: Members Abroad`)
                        .setDescription(`List of members, which are abroad\n_Update interval: every ${warUpdateInterval} minutes._`);

                    hospitalEmbed.setTitle(`:hospital: Members in hospital`)
                        .setDescription(`List of the next members which will be out of hospital\n_Update interval: every ${warUpdateInterval} minutes._`);
                    statusEmbed.setTitle(`:bar_chart: Member Overview`)
                        .setDescription(`Some details about the member status of each faction\n_Update interval: every ${warUpdateInterval} minutes._`);

                    ownTravelEmbed.setTitle(`:airplane: Members traveling`)
                        .setDescription(`List of ${ownFactionName} members, which are traveling\n_Update interval: every ${warUpdateInterval} minutes._`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://byrod.cc/f/${ownFactionID}` });
                    ownAbroadEmbed.setTitle(`:golf: Members Abroad`)
                        .setDescription(`List of ${ownFactionName} members, which are abroad\n_Update interval: every ${warUpdateInterval} minutes._`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://byrod.cc/f/${ownFactionID}` });

                    ownHospitalEmbed.setTitle(`:hospital: Members in hospital`)
                        .setDescription(`List of the next members which will be out of hospital\n_Update interval: every ${warUpdateInterval} minutes._`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://byrod.cc/f/${ownFactionID}` });
                    ownStatusEmbed.setTitle(`:bar_chart: Member Overview`)
                        .setDescription(`Some details about the member status of ${ownFactionName}\n_Update interval: every ${warUpdateInterval} minutes._`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://byrod.cc/f/${ownFactionID}` });

                    for (var factionID in rankedWar.factions) {
                        const responseMembers = await callTornApi('faction', 'basic', factionID, undefined, undefined, undefined, undefined, 'rotate');

                        if (responseMembers[0]) {
                            let travelingMembersList = [];
                            let abroadMembersList = [];
                            let hospitalMembersList = [];
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
                                const flagIcon = getFlagIcon(memberStatusState, member.status.description);


                                //check Traveling status
                                if (memberStatusState == 'Traveling' || memberStatusState == 'Abroad' || member.status.description.includes('In a')) {

                                    let hospital = '';
                                    if (member.status.description.includes('In a')) hospital = ':syringe:';

                                    if (memberStatusState == 'Traveling') {
                                        travelingMemberCount++;

                                        travelingMembersList.push(
                                            {
                                                name: member.name,
                                                id: memberIndex[member.name],
                                                direction: flagIcon.direction,
                                                flag: flagIcon.flag,
                                                hospital: hospital
                                            }
                                        );
                                    } else {
                                        abroadMemberCount++;
                                        abroadMembersList.push(
                                            {
                                                name: member.name,
                                                id: memberIndex[member.name],
                                                direction: flagIcon.direction,
                                                flag: flagIcon.flag,
                                                hospital: hospital
                                            }
                                        );
                                    }
                                }

                                //check Hospital status
                                if (memberStatusState == 'Hospital') {
                                    hospitalMemberCount++;

                                    let flag = flagIcon.flag;
                                    if (flag == ':flag_black:') flag = '';

                                    hospitalMembersList.push(
                                        {
                                            name: member.name,
                                            id: memberIndex[member.name],
                                            direction: flagIcon.direction,
                                            flag: flag,
                                            statusUntil: member.status.until
                                        }
                                    );
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

                            statusEmbed.addFields({ name: `${faction.name} [${factionID}]`, value: `:ok_hand: Okay: ${okayMemberCount}\n:airplane: Traveling: ${travelingMemberCount}\n:golf: Abroad: ${abroadMemberCount}\n:syringe: Hospital: ${hospitalMemberCount}\n:oncoming_police_car: Jail: ${jailMembersCount}\n:no_entry_sign: Federal: ${federalMembersCount}\n\n:green_circle: Online: ${membersOnline}\n:yellow_circle: Idle: ${membersIdle}\n:black_circle: Offline: ${membersOffline}`, inline: true });

                            travelingMembersList.sort((a, b) => a.flag.localeCompare(b.flag));
                            abroadMembersList.sort((a, b) => a.flag.localeCompare(b.flag));
                            const travelingToList = travelingMembersList.filter(member => member.direction === '`> `');
                            const travelingFromList = travelingMembersList.filter(member => member.direction === '`< `');

                            const travelEntryFormat = `{{direction}} {{flag}} [{{name}}](https://byrod.cc/p/{{id}}) {{hospital}}\n`;
                            const travelToChunks = splitIntoChunks(travelingToList, travelEntryFormat);
                            const travelFromChunks = splitIntoChunks(travelingFromList, travelEntryFormat);
                            const abroadChunks = splitIntoChunks(abroadMembersList, travelEntryFormat);

                            const hospitalEntryFormat = `:syringe: [{{name}}](https://byrod.cc/a/{{id}}) <t:{{statusUntil}}:R> {{flag}}\n`;
                            const hospitalChunks = splitIntoChunks(hospitalMembersList, hospitalEntryFormat);

                            if (factionID == ownFactionID) {

                                travelToChunks.forEach((chunk, index) => {
                                    const travelToChunksLength = (chunk.match(/\n/g) || []).length;
                                    travelEmbed.addFields({ name: `${faction.name} [${factionID}]\n:arrow_forward: Traveling to: (${travelToChunksLength}/${travelingMemberCount})`, value: chunk, inline: true });
                                    ownTravelEmbed.addFields({ name: `${faction.name} [${factionID}]\n:arrow_forward: Traveling to: (${travelToChunksLength}/${travelingMemberCount})`, value: chunk, inline: true });
                                });

                                travelFromChunks.forEach((chunk, index) => {
                                    const travelFromChunksLength = (chunk.match(/\n/g) || []).length;
                                    travelEmbed.addFields({ name: `${faction.name} [${factionID}]\n:arrow_backward: Traveling fom: (${travelFromChunksLength}/${travelingMemberCount})`, value: chunk, inline: true });
                                    ownTravelEmbed.addFields({ name: `${faction.name} [${factionID}]\n:arrow_backward: Traveling from: (${travelFromChunksLength}/${travelingMemberCount})`, value: chunk, inline: true });
                                });

                                travelEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false });

                                abroadChunks.forEach((chunk, index) => {
                                    abroadEmbed.addFields({ name: `${faction.name} [${factionID}]\n:pause_button: Abroad: (${abroadMemberCount}/${memberCount})`, value: chunk, inline: true });
                                    ownAbroadEmbed.addFields({ name: `${faction.name} [${factionID}]\n:pause_button: Abroad: (${abroadMemberCount}/${memberCount})`, value: chunk, inline: true });
                                });

                                abroadEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false })

                                hospitalChunks.forEach((chunk, index) => {
                                    if (index < 2) ownHospitalEmbed.addFields({ name: `${faction.name} [${factionID}]\n:hospital: In hospital: (${hospitalMemberCount}/${memberCount})`, value: chunk, inline: true });
                                });

                                ownStatusEmbed.addFields({ name: `${faction.name} [${factionID}]`, value: `:airplane: Traveling: ${travelingMemberCount}\n:syringe: Hospital: ${hospitalMemberCount}\n:golf: Abroad: ${abroadMemberCount}\n:ok_hand: Okay: ${okayMemberCount}`, inline: true });

                                if (faction1ID == ownFactionID) {
                                    fieldFaction1 += `\n:ok_hand: **Okay:** ${okayMemberCount}`;
                                } else {
                                    fieldFaction2 += `\n:ok_hand: **Okay:** ${okayMemberCount}`;
                                }
                            }
                            let isOwnFaction = true;
                            if (factionID != ownFactionID) {
                                isOwnFaction = false;
                                travelToChunks.forEach((chunk, index) => {
                                    const travelToChunksLength = (chunk.match(/\n/g) || []).length;
                                    travelEmbed.addFields({ name: `${faction.name} [${factionID}]\n:arrow_forward: Traveling to: (${travelToChunksLength}/${travelingMemberCount})`, value: chunk, inline: true });
                                });

                                travelFromChunks.forEach((chunk, index) => {
                                    const travelFromChunksLength = (chunk.match(/\n/g) || []).length;
                                    travelEmbed.addFields({ name: `${faction.name} [${factionID}]\n:arrow_backward: Traveling fom: (${travelFromChunksLength}/${travelingMemberCount})`, value: chunk, inline: true });
                                });

                                travelEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false });

                                abroadChunks.forEach((chunk, index) => {
                                    abroadEmbed.addFields({ name: `${faction.name} [${factionID}]\n:pause_button: Abroad: (${abroadMemberCount}/${memberCount})`, value: chunk, inline: true });
                                });
                                abroadEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false });

                                hospitalChunks.forEach((chunk, index) => {
                                    if (index < 2) hospitalEmbed.addFields({ name: `${faction.name} [${factionID}]\n:hospital: In hospital: (${hospitalMemberCount}/${memberCount})`, value: chunk, inline: true });
                                });

                                if (faction1ID != ownFactionID) {
                                    fieldFaction1 += `\n:ok_hand: **Okay:** ${okayMemberCount}`;
                                } else {
                                    fieldFaction2 += `\n:ok_hand: **Okay:** ${okayMemberCount}`;
                                }
                            }

                            if (warChannel) {
                                await getTravelInformation(travelChannel, warUpdateInterval, factionID, isOwnFaction, factionConfig);
                            }
                        }
                    }

                    if (warChannel) {
                        await updateOrDeleteEmbed(warChannel, 'status', statusEmbed, 'edit', homeFactionId);
                        await updateOrDeleteEmbed(warChannel, 'hospital', hospitalEmbed, 'edit', homeFactionId);
                        await updateOrDeleteEmbed(warChannel, 'travel', travelEmbed, 'edit', homeFactionId);
                        await updateOrDeleteEmbed(warChannel, 'abroad', abroadEmbed, 'edit', homeFactionId);
                    }

                    if (memberChannel) {
                        //await updateOrDeleteEmbed(memberChannel, 'ownStatus', ownStatusEmbed);
                        await updateOrDeleteEmbed(memberChannel, 'ownHospital', ownHospitalEmbed, 'edit', homeFactionId);
                        await updateOrDeleteEmbed(memberChannel, 'ownTravel', ownTravelEmbed, 'edit', homeFactionId);
                        await updateOrDeleteEmbed(memberChannel, 'ownAbroad', ownAbroadEmbed, 'edit', homeFactionId);
                    }

                } else {
                    if (warChannel) {
                        await updateOrDeleteEmbed(warChannel, 'status', statusEmbed, 'delete', homeFactionId);
                        await updateOrDeleteEmbed(warChannel, 'hospital', hospitalEmbed, 'delete', homeFactionId);
                        await updateOrDeleteEmbed(warChannel, 'travel', travelEmbed, 'delete', homeFactionId);
                        await updateOrDeleteEmbed(warChannel, 'abroad', abroadEmbed, 'delete', homeFactionId);
                    }

                    if (memberChannel) {
                        //await updateOrDeleteEmbed(memberChannel, 'ownStatus', ownStatusEmbed, 'delete');
                        await updateOrDeleteEmbed(memberChannel, 'ownHospital', ownHospitalEmbed, 'delete', homeFactionId);
                        await updateOrDeleteEmbed(memberChannel, 'ownTravel', ownTravelEmbed, 'delete', homeFactionId);
                        await updateOrDeleteEmbed(memberChannel, 'ownAbroad', ownAbroadEmbed, 'delete', homeFactionId);
                    }
                }

                rwEmbed.addFields({ name: `${faction1.name} [${faction1ID}]`, value: fieldFaction1, inline: true });
                rwEmbed.addFields({ name: `${faction2.name} [${faction2ID}]`, value: fieldFaction2, inline: true });
                await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed, 'edit', homeFactionId);
            } else {

                const enlistedStatus = await callTornApi('faction', 'basic,timestamp', undefined, undefined, undefined, undefined, undefined, 'default', undefined, 'v2', undefined, homeFactionId);

                if (enlistedStatus[0]) {
                    const factionJson = enlistedStatus[2];
                    isEnlisted = factionJson['basic'].is_enlisted;

                    if (isEnlisted) {

                        rwEmbed.setTitle(`Faction is currently enlisted!`)
                            .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://byrod.cc/f/${ownFactionID}` })
                            .setDescription(`:ballot_box_with_check: Faction is enlisted`);

                        if (warChannel) {
                            await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed, 'edit', homeFactionId);
                        }
                    } else {
                        if (warChannel) {
                            //await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed, 'delete');
                        }
                    }
                } else {

                }
            }

            if (Array.isArray(raidWars) && raidWars.length > 0) {

                for (const raidWar of raidWars) {
                    raidWarActive = true;
                    const raiding_faction = raidWar['raiding_faction'];
                    const defending_faction = raidWar['defending_faction'];
                    const raider_score = raidWar['raider_score'];
                    const defender_score = raidWar['defender_score'];
                    let opponentFaction = 0;
                    let ownFactionScore = 0;
                    let opponendFactionScore = 0;

                    let ownFactionStatusIcon = ':hourglass:';
                    let opponentFactionStatusIcon = ':hourglass:';


                    if (raiding_faction === ownFactionID) {
                        ownFactionStatusIcon = ':fox:';
                        opponentFactionStatusIcon = ':skull_crossbones:';
                        opponentFaction = defending_faction;
                        ownFactionScore = raider_score;
                        opponendFactionScore = defender_score;

                    } else {
                        ownFactionStatusIcon = ':skull_crossbones:';
                        opponentFactionStatusIcon = ':fox:';
                        opponentFaction = raiding_faction;
                        ownFactionScore = defender_score;
                        opponendFactionScore = raider_score;
                    }

                    const responseMembers = await callTornApi('faction', 'basic', opponentFaction, undefined, undefined, undefined, undefined, 'rotate');

                    if (responseMembers) {
                        let hospitalMembersList = [];
                        let hospitalMemberCount = 0;

                        const faction = responseMembers[2];
                        const membersList = faction.members;
                        const memberCount = Object.keys(membersList).length;

                        let memberIndex = {};
                        for (var id in membersList) {
                            memberIndex[membersList[id].name] = id;
                        }

                        const sortedMembers = Object.values(membersList).sort(sortByUntil).reverse();

                        for (var id in sortedMembers) {
                            let member = sortedMembers[id];
                            let memberStatusState = member.status.state;
                            const flagIcon = getFlagIcon(memberStatusState, member.status.description);

                            if (memberStatusState === 'Hospital') {
                                hospitalMemberCount++;
                                let flag = flagIcon.flag;
                                if (flag == ':flag_black:') flag = '';
                                hospitalMembersList.push(
                                    {
                                        name: member.name,
                                        id: memberIndex[member.name],
                                        direction: flagIcon.direction,
                                        flag: flag,
                                        statusUntil: member.status.until
                                    }
                                );
                            }
                        }

                        let opponentFactionName = faction.name;
                        const hospitalEntryFormat = `:syringe: [{{name}}](https://byrod.cc/a/{{id}}) <t:{{statusUntil}}:R> {{flag}}\n`;
                        const hospitalChunks = splitIntoChunks(hospitalMembersList, hospitalEntryFormat);

                        hospitalEmbed.setTitle(`:hospital: Members in hospital`)
                            .setDescription(`List of the next members which will be out of hospital\n_Update interval: every ${warUpdateInterval} minutes._`);

                        hospitalChunks.forEach((chunk, index) => {
                            if (index < 2) hospitalEmbed.addFields({ name: `${opponentFactionName} [${opponentFaction}]\n:hospital: In hospital: (${hospitalMemberCount}/${memberCount})`, value: chunk, inline: true });
                        });

                        const description = '**RAID!!**'
                        rwEmbed.setTitle(`Raid between _${ownFactionName}_ and _${opponentFactionName}_`)
                            .setURL(`https://byrod.cc/f/${ownFactionID}`)
                            .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://byrod.cc/f/${ownFactionID}` })
                            .setDescription(`${description}\n_Update interval: every ${warUpdateInterval} minutes._`);


                        rwEmbed.addFields({ name: `${ownFactionStatusIcon} ${ownFactionName} [${ownFactionID}]`, value: `:game_die: **Score:** ${ownFactionScore}`, inline: true });
                        rwEmbed.addFields({ name: `${opponentFactionStatusIcon} ${opponentFactionName} [${opponentFaction}]`, value: `:game_die: **Score:** ${opponendFactionScore}`, inline: true });

                        if (warChannel) {

                            const threadName = `Raid between ${ownFactionName} and ${opponentFactionName}`;
                            const thread = await findOrCreateThread(warChannel, threadName);

                            const cachedMessageIdInfo = messageIdCache.get(`${thread.id}-info`);
                            const cachedMessageIdHosp = messageIdCache.get(`${thread.id}-hosp`);
                            if (cachedMessageIdInfo) {
                                const originalMessage = await thread.messages.fetch(cachedMessageIdInfo);
                                await originalMessage['edit']({ embeds: [rwEmbed], ephemeral: false });
                                messageIdCache.set(`${thread.id}-info`, originalMessage.id, 3600);
                            } else {
                                const newMessage = await thread.send({ embeds: [rwEmbed], ephemeral: false });
                                messageIdCache.set(`${thread.id}-info`, newMessage.id, 3600);
                            }

                            if (cachedMessageIdHosp) {
                                const originalMessage = await thread.messages.fetch(cachedMessageIdHosp);
                                await originalMessage['edit']({ embeds: [hospitalEmbed], ephemeral: false });
                                messageIdCache.set(`${thread.id}-hosp`, originalMessage.id, 3600);
                            } else {
                                const newMessage = await thread.send({ embeds: [hospitalEmbed], ephemeral: false });
                                messageIdCache.set(`${thread.id}-hosp`, newMessage.id, 3600);
                            }

                        }
                    }
                }
            }
            printLog('raidWarActive: ' + raidWarActive + ' > rankedWarActive: ' + rankedWarActive + ' > isEnlisted: ' + isEnlisted);

            if (!rankedWarActive && !isEnlisted) {
                if (warChannel) {
                    await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed, 'delete', homeFactionId);
                }
            }

            if (!raidWarActive) {
                if (warChannel) {
                    await deleteThreads(warChannel);
                }
            }

            if (!isEnlisted && !rankedWarActive && !raidWarActive) {
                if (warChannel) {
                    cleanChannel(warChannel);
                }
            }
        }
    } else {
        printLog('warChannel is undefined', 'warn');
    }
}


/**
 * Retrieves travel information for a given faction and sends it to a specified thread.
 *
 * @param {Channel} travelChannel - The channel where the travel information will be sent.
 * @param {number} travelUpdateInterval - The interval in minutes at which the travel information should be updated.
 * @param {number} factionId - The ID of the faction for which travel information is being retrieved. Defaults to the home faction ID.
 * @return {Promise<void>} A promise that resolves when the travel information has been retrieved and sent.
 */
async function getTravelInformation(travelChannel, travelUpdateInterval, factionId, isOwnFaction, factionConfig) {

    const threadName = 'Flight Tracker';
    const travelThread = await findOrCreateThread(travelChannel, threadName);

    if (travelThread) {

        const responseMembers = await callTornApi('faction', 'basic,timestamp', factionId, undefined, undefined, undefined, undefined, 'rotate');

        if (responseMembers[0]) {
            const factionJson = responseMembers[2];
            const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson;
            const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;

            const membersList = factionJson.members;
            let membersTraveling = [];
            let membersAbroad = [];
            const timestamp = factionJson.timestamp;

            const travelTimestampCache = timestampCache.get(`travelTimestamp_${faction_id}`);

            let firstRun = false;
            if (travelTimestampCache == undefined) {
                firstRun = true;
            }

            timestampCache.set(`travelTimestamp_${faction_id}`, timestamp, 120 * travelUpdateInterval)

            for (var memberId in membersList) {

                let member = membersList[memberId];
                let memberStatusState = member.status.state;

                const cachedTravelInfo = memberCache.get(memberId);
                const flagIcon = getFlagIcon(memberStatusState, member.status.description);

                let embedCategory = 'default';
                if (isOwnFaction) {
                    embedCategory = 'overwrite';
                }

                const travelEmbed = initializeEmbed(`${cleanUpString(member.name)} [${memberId}]`, embedCategory, factionConfig.embedColor);
                travelEmbed.setURL(`https://byrod.cc/p/${memberId}`)
                    .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${faction_id}` })
                    .setDescription(member.status.description + ' ' + flagIcon.flag);

                //check Traveling status
                if (memberStatusState == 'Traveling') {

                    let travelInfo = `<${memberStatusState}> [${member.status.description}]`;
                    membersTraveling.push(memberId);

                    if (cachedTravelInfo) {
                        const cachedStatusState = extractFromRegex(cachedTravelInfo, /<(.+)>/);
                        const cachedStatusDesc = extractFromRegex(cachedTravelInfo, /\[(.+)\]/);

                        if (member.status.description != cachedStatusDesc && cachedStatusState == 'Traveling') {
                            printLog(`>>> Member status changed: [${memberId}] - ${cachedTravelInfo}`);

                            try {
                                const messageID = extractFromRegex(cachedTravelInfo, /\((\d+)\)/);

                                try {
                                    const originalMessage = await travelThread.messages.fetch(messageID);

                                    try {
                                        const travelTimes = getTravelTimes(memberStatusState, member.status.description);

                                        const travelDetails =
                                            `:timer: \`Start   :\` ± <t:${timestamp}:f>\n`
                                            + `:airplane_small: \`Standard:\`<t:${timestamp + travelTimes.standard * 60}:R>\n`
                                            + `:airplane: \`Airstrip:\`<t:${timestamp + travelTimes.airstrip * 60}:R>\n`
                                            + `:earth_africa: \`WLT     :\`<t:${timestamp + travelTimes.wlt * 60}:R>\n`
                                            + `:ticket: \`BCT     :\`<t:${timestamp + travelTimes.bct * 60}:R>\n`;

                                        travelEmbed.addFields({ name: `:airplane_departure: Estimated time of arrival:`, value: `${travelDetails}`, inline: true });


                                        await originalMessage.edit({ embeds: [travelEmbed], ephemeral: false });
                                        printLog(`Message with ID ${messageID} has been edited.`);

                                    } catch (deleteError) {
                                        if (error.code === 10008) printLog('Message not found: ' + error);
                                        else printLog('Failed to edit the message: ' + error, 'error');
                                    }

                                } catch (fetchError) {
                                    if (fetchError.code === 10008) printLog('Message not found: ' + fetchError);
                                    else printLog('Failed to fetch the message: ' + fetchError, 'error');
                                }

                                travelInfo += ` (${messageID})`;

                                memberCache.set(memberId, travelInfo, 120);
                                printLog(`Member cache entry for ${member.name} has been updated.`);

                            } catch (error) {
                                printLog('Failed to process the message deletion or cache update: ' + error, 'error');
                            }

                        } else {
                            travelInfo = cachedTravelInfo;
                        }

                    } else {
                        if (firstRun) {
                            printLog(`>>> First Run, Member already traveling: ${memberId} - ${travelInfo}`);
                            travelEmbed.addFields({ name: `:airplane_departure: ${member.name} is already traveling`, value: `*No details available*`, inline: true });

                        } else {
                            printLog(`>>> Member started traveling: [${memberId}] - ${travelInfo}`);

                            const travelTimes = getTravelTimes(memberStatusState, member.status.description);

                            const travelDetails =
                                `:timer: \`Start   :\` ± <t:${timestamp}:f>\n`
                                + `:airplane_small: \`Standard:\`<t:${timestamp + travelTimes.standard * 60}:R>\n`
                                + `:airplane: \`Airstrip:\`<t:${timestamp + travelTimes.airstrip * 60}:R>\n`
                                + `:earth_africa: \`WLT     :\`<t:${timestamp + travelTimes.wlt * 60}:R>\n`
                                + `:ticket: \`BCT     :\`<t:${timestamp + travelTimes.bct * 60}:R>\n`;

                            travelEmbed.addFields({ name: `:airplane_departure: Estimated time of arrival:`, value: `${travelDetails}`, inline: true });
                        }

                        const message = await travelThread.send({ embeds: [travelEmbed], ephemeral: false });

                        travelInfo += ` (${message.id})`;
                    }

                    memberCache.set(memberId, travelInfo, 120);
                } else {
                    if (memberStatusState == 'Abroad') {
                        membersAbroad.push(memberId);
                    }
                    if (cachedTravelInfo) {
                        printLog(`>>> Member stopped traveling: [${memberId}] - ${cachedTravelInfo}`);

                        const messageID = extractFromRegex(cachedTravelInfo, /\((\d+)\)/);

                        if (messageID) {
                            const travelDetails =
                                `\`Landed  : \` around <t:${timestamp}:f>`;

                            travelEmbed.addFields({ name: `:airplane_arriving: ${member.name} stopped travelling:`, value: `${travelDetails}`, inline: true });
                            if (memberStatusState != 'Traveling' && memberStatusState != 'Abroad') {
                                travelEmbed.setDescription(flagIcon.flag + ' In Torn');
                            }

                            try {
                                const originalMessage = await travelThread.messages.fetch(messageID);

                                try {
                                    await originalMessage.edit({ embeds: [travelEmbed], ephemeral: false });

                                    const delMinutes = 5;

                                    printLog(`> Embed with message ID ${messageID} has been edited and will be deleted in ${delMinutes} minutes.`);

                                    setTimeout(() => {
                                        originalMessage.delete().catch(deleteError => {
                                            printLog('Failed to delete the message:' + deleteError, 'error');
                                        });
                                    }, delMinutes * 60 * 1000);

                                } catch (error) {
                                    if (error.code === 10008) printLog('Message not found: ' + error, 'error');
                                    else printLog('Failed to edit the message: ' + error);
                                }

                            } catch (fetchError) {
                                if (fetchError.code === 10008) printLog('Message not found: ' + fetchError, 'error');
                                else printLog('Failed to fetch the message: ' + fetchError, 'error');
                            }
                        }
                    }

                    memberCache.del(memberId);
                }
            }
            if (membersTraveling.length > 0) {
                printLog(`> Members which are traveling for ${faction_name} [${factionId}]: ${membersTraveling.join(', ')}`);
            }

            if (membersAbroad.length > 0) {
                printLog(`> Members which are abroad for ${faction_name} [${factionId}]: ${membersAbroad.join(', ')}`);
            }
        }
    }
}

/**
 * Asynchronously checks the members of a faction and updates their status and information in Discord embeds.
 *
 * @param {string} memberChannel - The Discord channel where the member status and information will be updated.
 * @param {number} memberUpdateInterval - The interval in milliseconds at which the member status and information will be updated.
 * @return {Promise<void>} A promise that resolves once the member status and information are updated in the Discord embeds.
 */
async function checkMembers(memberChannel, memberUpdateInterval, homeFactionId, factionConfig) {
    const memberTitle = readConfig().factions[homeFactionId].memberTitle;
    printLog(homeFactionId + ' > Checking members - ' + memberTitle);

    if (memberChannel) {

        const response = await callTornApi('faction', 'basic,timestamp', homeFactionId, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, homeFactionId);
        const jailEmbed = initializeEmbed(`:oncoming_police_car: Bust a ${memberTitle}!`, 'overwrite', factionConfig.embedColor);
        const ownStatusEmbed = initializeEmbed(`:bar_chart: Member Overview`, 'overwrite', factionConfig.embedColor);

        if (response[0]) {
            const factionJson = response[2];
            const ownFactionName = factionJson['name'];
            const ownFactionTag = factionJson['tag'];
            const ownFactionId = factionJson['ID'];
            const ownFactionIcon = `https://factiontags.torn.com/` + factionJson['tag_image'];
            const membersList = factionJson['members'];

            let hospitalMemberCount = 0;
            let okayMemberCount = 0;
            let travelingMemberCount = 0;
            let abroadMemberCount = 0;
            let jailMembersCount = 0;
            let federalMembersCount = 0;

            let membersOnline = 0;
            let membersOffline = 0;
            let membersIdle = 0;

            let jailMembersList = [];
            let offlineMembersList = [];


            for (var id in membersList) {

                let member = membersList[id];
                let memberStatusState = member.status.state;
                let lastActionStatus = member.last_action.status;
                let lastActionRelative = member.last_action.relative;

                if (memberStatusState === 'Jail') {
                    jailMembersList.push({
                        name: member.name,
                        id: id,
                        statusUntil: member.status.until
                    });
                }

                if (lastActionRelative.includes('day') && memberStatusState !== 'Fallen') {
                    offlineMembersList.push({
                        name: member.name,
                        id: id,
                        lastActionTimestamp: member.last_action.timestamp
                    });
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

            // Sort jailMembersList and offlineMembersList based on different timestamps
            jailMembersList.sort((a, b) => a.statusUntil - b.statusUntil);
            offlineMembersList.sort((a, b) => a.lastActionTimestamp - b.lastActionTimestamp);

            if (jailMembersList.length > 0) {
                jailEmbed.setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://byrod.cc/f/${ownFactionId}` })
                    .setDescription(`_Update interval: every ${memberUpdateInterval} minutes._`);

                const entryFormat = `:oncoming_police_car: [{{name}}](https://byrod.cc/p/{{id}}) out <t:{{statusUntil}}:R>\n`;
                const jailChunks = splitIntoChunks(jailMembersList, entryFormat);

                // Add each chunk as a separate field
                jailChunks.forEach((chunk, index) => {
                    jailEmbed.addFields({ name: `Members in jail (${index + 1}/${jailChunks.length})`, value: chunk, inline: true });
                });

                await updateOrDeleteEmbed(memberChannel, 'jail', jailEmbed, 'edit', homeFactionId);
            } else {
                await updateOrDeleteEmbed(memberChannel, 'jail', jailEmbed, 'delete', homeFactionId);
            }
            ownStatusEmbed.setDescription(`_Update interval: every ${memberUpdateInterval} minutes._`)
                .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://byrod.cc/f/${ownFactionId}` });

            ownStatusEmbed.addFields({ name: `Member Status`, value: `:ok_hand: Okay: ${okayMemberCount}\n:airplane: Traveling: ${travelingMemberCount}\n:golf: Abroad: ${abroadMemberCount}\n:syringe: Hospital: ${hospitalMemberCount}\n:oncoming_police_car: Jail: ${jailMembersCount}\n:no_entry_sign: Federal: ${federalMembersCount}`, inline: true });
            ownStatusEmbed.addFields({ name: `Online Status`, value: `:green_circle: Online: ${membersOnline}\n:yellow_circle: Idle: ${membersIdle}\n:black_circle: Offline: ${membersOffline}`, inline: true });
            if (offlineMembersList.length > 0) {
                let offlineMembersEntries = '';
                for (const member of offlineMembersList) {
                    const entry = `:zzz: [${cleanUpString(member.name)}](https://byrod.cc/p/${member.id}) last seen <t:${member.lastActionTimestamp}:R>\n`;
                    offlineMembersEntries += entry;
                }
                ownStatusEmbed.addFields({ name: 'Offline > 1 day', value: offlineMembersEntries, inline: false });
            }
            await updateOrDeleteEmbed(memberChannel, 'ownStatus', ownStatusEmbed, 'edit', homeFactionId);
        }
    }
}

/**
 * Asynchronously retrieves OC (Organized Crime) statistics for the specified month and generates an embed with the statistics.
 *
 * @param {number} selectedDateValue - The value representing the selected month.
 * @return An embed containing OC statistics for the specified month.
 */
async function getOCStats(selection, selectedDateValue, exportData = false, homeFactionId = undefined, factionConfig = undefined) {

    let timestamps;
    let title = '';
    let filenameSuffix = '';

    if (selection === 'months') {
        var today = new Date();
        var firstDay, lastDay;

        if (!selectedDateValue) {
            selectedDateValue = today.getMonth();
            title = `*Current Month*`;
        } else {
            selectedDateValue--;
        }

        // Calculate timestamps using the offset
        timestamps = calculateMonthTimestamps(selectedDateValue, 192);
    }

    if (selection === 'last-x-days') {
        title = `Last ${selectedDateValue} Days`;
        timestamps = calculateLastXDaysTimestamps(selectedDateValue, 192);
        filenameSuffix = formatTornDate(timestamps.lastDay).substring(0, 10) + ' -' + selectedDateValue + ' Days';
    }

    var firstDay = timestamps.firstDay;
    var lastDay = timestamps.lastDay;

    const response = await callTornApi('faction', 'basic,crimes,timestamp', homeFactionId, firstDay, lastDay, undefined, undefined, undefined, undefined, undefined, undefined, homeFactionId);

    if (!response[0]) {
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

    const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;
    const crimeList = [8, 7, 6, 5, 4, 3, 2, 1];

    const lastDateFormatted = (new Date(lastDay * 1000)).toISOString().replace('T', ' ').replace('.000Z', '');

    if (title === '') {
        title = lastDateFormatted.substring(0, 7);
        filenameSuffix = title;
    }

    const ocEmbed = initializeEmbed(`OC Overview for *${title}*`, 'overwrite', factionConfig.embedColor);
    const authorInfo = { name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${faction_id}` }
    ocEmbed.setAuthor(authorInfo);

    const crimeSummary = {};
    var entry = 'Crime Name;Date;Time;Success;Respect Gain;Money Gain;Spot1;Spot2;Spot3;Spot4;ID1;ID2;ID3;ID4\n';


    for (const id in crimeData) {

        const crime = crimeData[id];

        if (crimeList.includes(crime.crime_id)) {

            if (crime.initiated === 1) {

                var firstDayDate = new Date(firstDay * 1000);
                var newFirstDay = '';

                if (selection === 'months') newFirstDay = new Date(firstDayDate.getFullYear(), firstDayDate.getMonth() + 1, 1);
                if (selection === 'last-x-days') newFirstDay = firstDayDate;

                newFirstDay = newFirstDay.getTime() / 1000;

                if (crime.time_completed >= newFirstDay && crime.time_completed <= lastDay) {

                    //NEW STUFF
                    if (exportData) {
                        var memberList = '';
                        var memberIdList = '';
                        crime.participants.forEach(obj => {
                            Object.entries(obj).forEach(([key, value]) => {
                                const memberID = `${key}`;
                                if (members.hasOwnProperty(memberID)) {
                                    const memberName = members[memberID].name;
                                    memberList += `${memberName};`;
                                } else {
                                    memberList += `${key};`;
                                }
                                memberIdList += `${key};`;
                            })
                        });
                        const result = crime.success === 1 ? 'success' : 'failed';
                        entry += `${crime.crime_name};${formatTornDate(crime.time_completed)};${crime.time_completed};${result};${crime.respect_gain};${crime.money_gain};${memberList}${memberIdList}\n`;
                    }

                    if (!crimeSummary[crime.crime_name]) {
                        crimeSummary[crime.crime_name] = {
                            total: 0,
                            success: 0,
                            failed: 0,
                            money_gain: 0,
                            respect_gain: 0
                        };
                    }

                    crimeSummary[crime.crime_name].total++;
                    crimeSummary[crime.crime_name].money_gain += crime.money_gain;
                    crimeSummary[crime.crime_name].respect_gain += crime.respect_gain;

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
        printLog(homeFactionId + " > " + crimeName + " " + total + " " + successRate.toFixed(2) + "%");
        ocEmbed.addFields({ name: crimeName, value: `:blue_circle: \`${'Total'.padEnd(12, ' ')}:\` ${total}\n:green_circle: \`${'Success'.padEnd(12, ' ')}:\` ${success}\n:red_circle: \`${'Failed'.padEnd(12, ' ')}:\` ${failed}\n:chart_with_upwards_trend: \`${'Success rate'.padEnd(12, ' ')}:\` **${successRate.toFixed(2)}%**\n:moneybag: \`${'Money gained'.padEnd(12, ' ')}:\` $${crimeSummary[crimeName].money_gain.toLocaleString('en')}\n\n`, inline: false });
        //money per member
        const moneyPerMember = crimeSummary[crimeName].money_gain / total / 5;
        entry += `${crimeName};;;${successRate.toFixed(2)}%;${crimeSummary[crimeName].respect_gain};${crimeSummary[crimeName].money_gain};${moneyPerMember}\n`;
    }

    let returnResult = {};
    if (exportData) {

        const fileName = `./exports/PA_Overview_${homeFactionId}_${filenameSuffix}.csv`;
        fs.writeFileSync(fileName, entry);
        returnResult.csvFilePath = fileName;
        let year = new Date().getFullYear();

        await importCsvToSheet(fileName, undefined, 'PA_Overview' + year);
    }

    returnResult.embed = ocEmbed;
    returnResult.crimeData = crimeData;
    returnResult.members = members;
    returnResult.authorInfo = authorInfo;
    return returnResult;
}


/**
 * Checks the OC stats for a given faction and updates the OC status embed in the member channel.
 *
 * @param {Channel} ocChannel - The channel where the OC status embed will be updated.
 * @param {number} memberUpdateInterval - The interval in minutes at which the OC stats should be updated.
 * @param {number} homeFactionId - The ID of the faction for which the OC stats are being retrieved.
 * @return {Promise<void>} A promise that resolves once the OC status embed has been updated.
 */
async function checkOCs(ocChannel, memberUpdateInterval, homeFactionId, factionConfig) {
    printLog(homeFactionId + ' > Checking OCs');

    const currentTimestamp = Math.floor(Date.now() / 1000);
    let timestamp = currentTimestamp;

    let lastTimestamp = timestampCache.get('ocExecTime_' + homeFactionId);
    if (lastTimestamp !== undefined) {
        timestamp = lastTimestamp;
    } else {
        printLog(homeFactionId + ' > OC timestamp cache empty');
    }

    const ocConf = factionConfig.ocConf;

    // Get OC status
    const ocStatus = await getOCStats('months', undefined, false, homeFactionId, factionConfig);
    if (ocStatus === undefined) return;

    // Show OC Status
    if (ocConf.showStatus) {
        const ocStatusEmbed = ocStatus.embed;
        ocStatusEmbed.setDescription(`_Update interval: every ${(memberUpdateInterval).toFixed(0)} minutes._`);
        await updateOrDeleteEmbed(ocChannel, 'ocStatus', ocStatusEmbed, 'edit', homeFactionId);
    }

    // Process crimes
    if (ocConf.sendPing || ocConf.sendDetails) {
        const ocCrimeData = ocStatus.crimeData;
        const members = ocStatus.members;
        const authorInfo = ocStatus.authorInfo;

        for (const id in ocCrimeData) {
            const crime = ocCrimeData[id];
            const participants = crime.participants || [];

            // Check if all participants are "Okay"
            const allParticipantsOkay = participants.every((participant) => {
                const participantId = Object.keys(participant)[0]; // Extract the ID key
                return participant[participantId]?.state === "Okay" ?? null;
            });

            // Initialize embed
            const crimeEmbed = initializeEmbed(crime.crime_name, 'overwrite', factionConfig.embedColor);
            if (authorInfo) {
                crimeEmbed.setAuthor(authorInfo);
            }

            const planner = members[crime.planned_by]?.name || 'Unknown';
            const initiator = members[crime.initiated_by]?.name || 'Unknown';

            console.log('planner: ', planner);
            console.log('initiator: ', initiator);  

            if (planner !== 'Unknown') {
                crimeEmbed.addFields([
                    {
                        name: "Planned by",
                        value: `[${cleanUpString(planner)}](https://byrod.cc/p/${crime.planned_by})`,
                        inline: false,
                    },
                ]);
            }

            if (initiator !== 'Unknown') {
                crimeEmbed.addFields([
                    {
                        name: "Initiated by",
                        value: `[${cleanUpString(initiator)}](https://byrod.cc/p/${crime.initiated_by})`,
                        inline: false,
                    },
                ]);
            }

            crimeEmbed.addFields([
                {
                    name: 'Participants',
                    value: participants
                        .map((participant) => {
                            const id = Object.keys(participant)[0];
                            const memberName = members[id]?.name || 'Unknown';
                            return `- [${cleanUpString(memberName)}](https://byrod.cc/p/${id})`;
                        })
                        .join("\n"),
                    inline: false,
                },
                {
                    name: "Time ready",
                    value: `<t:${Math.floor(crime.time_ready)}:f>`,
                    inline: false,
                },
            ]);

            console.log(id, ocConf.sendPing, crime.initiated, crime.time_left, allParticipantsOkay);
            // Handle sendPing logic
            if (ocConf.sendPing && crime.initiated === 0) {
                if (crime.time_left === 0 && allParticipantsOkay) {
                    crimeEmbed.setDescription(`:information_source: **${crime.crime_name}** ready to be initiated!\n## » [link to initiate](https://www.torn.com/factions.php?step=your#/tab=crimes)`);
                    await ocChannel.send({ embeds: [crimeEmbed] });
                    continue;
                }
            }

            // Handle sendDetails logic
            if (ocConf.sendDetails) {
                if (crime.initiated === 0 && crime.time_left > 0) {
                    if (crime.time_started > timestamp) {
                        console.log(id, `:spy: **${crime.crime_name}** was planned.`);
                        crimeEmbed.setTitle(`:spy: **${crime.crime_name}** was planned.`);
                    } else {
                        continue;
                    }
                } else if (crime.initiated === 1) {
                    if (crime.time_completed > timestamp) {
                        console.log(id, `:information_source: **${crime.crime_name}** has been initiated. Details below.`);
                        const statusIcon = crime.success ? ':money_with_wings:' : ':poop:';
                        if (crime.success) {
                            crimeEmbed.setColor(successColor);
                            crimeEmbed.setTitle(`${statusIcon} **${crime.crime_name}** Successful!`);
                        } else {
                            crimeEmbed.setColor(errorColor);
                            crimeEmbed.setTitle(`${statusIcon} **${crime.crime_name}** Failed!`);

                        }
                        //crimeEmbed.setDescription(`${statusIcon} **${crime.crime_name}** has been initiated. Details below.`);
                        crimeEmbed.addFields([
                            {
                                name: "Details",
                                value: `Money gained: $${numberWithCommas(crime.money_gain)}\nRespect gained: ${crime.respect_gain}`,
                                inline: false,
                            }
                        ])
                    } else {
                        continue;
                    }
                }
                await ocChannel.send({ embeds: [crimeEmbed] });
            }
        }
    }

    if (timestampCache.set('ocExecTime_' + homeFactionId, currentTimestamp, 120)) printLog(homeFactionId + ` > Cache updated for 'ocExecTime_${homeFactionId}' with ${currentTimestamp}`);
}



async function getFactionReviveStatus(factionId, message) {

    const response = await callTornApi('faction', 'basic,members', factionId, undefined, undefined, undefined, undefined, 'faction', undefined, 'v2');

    if (!response[0]) {
        await message.edit({ content: response[1] });
        return;
    }

    const factionJson = response[2];

    const members = factionJson?.members || {};
    const memberLength = Object.keys(members).length;

    if (memberLength === 0) {
        await message.edit({ content: 'No members found!' });
        return;
    }

    const { name: faction_name, id: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson.basic;

    const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;

    const reviveEmbed = initializeEmbed('Faction Revive Status');
    reviveEmbed.setAuthor({ name: `${faction_tag} -  ${faction_name} [${faction_id}]`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${faction_id}` })
        //.setDescription('*Note: Members with "Friends & faction" settings might be displayed too.*')
        ;

    let revivableMembersList = [];
    let reviveCount = 0;
    let noneCount = 0;
    let membersCount = 0;

    const membersList = members;

    let memberIndex = {}

    for (var id in membersList) {
        memberIndex[membersList[id].name] = id;
    }
    const sortedMembers = Object.values(membersList).sort(sortByName).reverse();

    for (const id in sortedMembers) {

        const member = sortedMembers[id];
        const memberId = member.id;
        membersCount++;


        printLog(`${member.name} checked, revive status = ${member.is_revivable}`);
        if (member.is_revivable && member.status.state !== 'Fallen') {

            let statusIcon = '`  `';
            let statusUntil = '';
            switch (member.status.state) {
                case 'Hospital': statusIcon = ':syringe:'; statusUntil = `<t:${member.status.until}:R>`; break;
                case 'Jail': statusIcon = ':oncoming_police_car:'; break;
                case 'Abroad': statusIcon = getFlagIcon(member.status.state, member.status.description).flag; break;
                case 'Traveling': statusIcon = getFlagIcon(member.status.state, member.status.description).flag; break;
            }

            revivableMembersList.push({
                name: member.name,
                id: memberId,
                statusIcon: statusIcon,
                statusUntil: statusUntil
            });
            reviveCount++;
        } else {
            noneCount++;
        }
    }

    const content = `>>> Found ${reviveCount} revivable members out of ${membersCount} members for faction ${faction_name} [${faction_id}].`;
    printLog(content);

    revivableMembersList.sort((a, b) => {
        const statusUntilA = a.statusUntil || '';
        const statusUntilB = b.statusUntil || '';
        return statusUntilA.localeCompare(statusUntilB);
    });

    reviveEmbed.addFields({ name: 'Overview', value: `:green_circle: \`Revivable    : ${reviveCount}\`\n:red_circle: \`Not revivable: ${noneCount}\``, inline: false });

    const entryFormat = `{{statusIcon}} [{{name}}](https://byrod.cc/p/{{id}}) [{{id}}] {{statusUntil}}\n`;
    const reviveChunks = splitIntoChunks(revivableMembersList, entryFormat);

    reviveChunks.forEach((chunk, index) => {
        reviveEmbed.addFields({ name: `(${index + 1}/${reviveChunks.length})`, value: chunk, inline: true });
    });

    reviveEmbed.setTitle(`Players with revives on (${reviveCount}/${membersCount})`);

    return reviveEmbed;
}

async function getOwnFactionReviveStatus(factionId, message) {

    const response = await callTornApi('faction', 'basic,members', factionId, undefined, undefined, undefined, undefined, 'default', undefined, 'v2', undefined, factionId);

    if (!response[0]) {
        await message.edit({ content: response[1] });
        return;
    }

    const factionJson = response[2];

    const members = factionJson?.members || {};
    const memberLength = Object.keys(members).length;

    if (memberLength === 0) {
        await message.edit({ content: 'No members found!' });
        return;
    }

    const { name: faction_name, id: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson.basic;

    const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;

    const reviveEmbed = initializeEmbed('Faction Revive Status');
    reviveEmbed.setAuthor({ name: `${faction_tag} -  ${faction_name} [${faction_id}]`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${faction_id}` })
        //.setDescription('*Note: Members with "Friends & faction" settings might be displayed too.*')
        ;

    let revivableMembersList = [];
    let reviveCount = 0;
    let noneCount = 0;
    let friendNFactionCount = 0;
    let everyoneCount = 0;
    let membersCount = 0;

    const membersList = members;

    let memberIndex = {}

    for (var id in membersList) {
        memberIndex[membersList[id].name] = id;
    }
    const sortedMembers = Object.values(membersList).sort(sortByName).reverse();

    for (const id in sortedMembers) {

        const member = sortedMembers[id];
        const memberId = member.id;

        membersCount++;

        printLog(`${member.name} checked, revive status = ${member.revive_setting}`);
        if (member.revive_setting !== 'No one' && member.status.state !== 'Fallen') {

            let statusIcon = '`  `';
            let statusUntil = '';
            switch (member.status.state) {
                case 'Hospital': statusIcon = ':syringe:'; statusUntil = `<t:${member.status.until}:R>`; break;
                case 'Jail': statusIcon = ':oncoming_police_car:'; break;
                case 'Abroad': statusIcon = getFlagIcon(member.status.state, member.status.description).flag; break;
                case 'Traveling': statusIcon = getFlagIcon(member.status.state, member.status.description).flag; break;
            }

            let memberNameFormatted = '';
            if (member.revive_setting == 'Friends & faction') {
                memberNameFormatted = `* ${member.name}`;
            } else {
                memberNameFormatted = `${member.name}`;
            }

            revivableMembersList.push({
                name: memberNameFormatted,
                id: memberId,
                statusIcon: statusIcon,
                statusUntil: statusUntil
            });
            reviveCount++;

            if (member.revive_setting == 'Friends & faction') {
                friendNFactionCount++;
            }

            if (member.revive_setting == 'Everyone') {
                everyoneCount++;
            }
        }

        if (member.revive_setting == 'No one') {
            noneCount++;
        }
    }

    const content = `>>> Found ${reviveCount} revivable members out of ${membersCount} members for faction ${faction_name} [${faction_id}].`;
    printLog(content);

    revivableMembersList.sort((a, b) => {
        const statusUntilA = a.statusUntil || '';
        const statusUntilB = b.statusUntil || '';
        return statusUntilA.localeCompare(statusUntilB);
    });

    reviveEmbed.addFields({ name: 'Overview', value: `:green_circle: \`Everyone         : ${everyoneCount}\`\n:yellow_circle: \`Friends & faction: ${friendNFactionCount}\`\n:red_circle: \`No one           : ${noneCount}\``, inline: false });

    const entryFormat = `{{statusIcon}} [{{name}}](https://byrod.cc/p/{{id}}) [{{id}}] {{statusUntil}}\n`;
    const reviveChunks = splitIntoChunks(revivableMembersList, entryFormat);

    let embedCount = 0;
    reviveChunks.forEach((chunk, index) => {
        embedCount++;
        reviveEmbed.addFields({ name: `(${index + 1}/${reviveChunks.length})`, value: chunk, inline: true });
        if (embedCount % 2 === 0) reviveEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false });

    });

    reviveEmbed.setTitle(`Players with revives set to Everyone (${reviveCount}/${membersCount})`);

    if (friendNFactionCount > 0) {
        reviveEmbed.setDescription(`*Note: Members with "Friends & faction" settings arte highlighted with an asterisk* *`);
    }

    return reviveEmbed;
}

/**
 * Retrieves the war activity for a given faction.
 *
 * @param {string} factionId - The ID of the faction.
 * @param {Message} message - The message object to update with progress.
 * @param {boolean} [exportCSV=false] - Whether to export the results as a CSV file.
 * @return {Promise<Object>} An object containing the war activity embed and, if exportCSV is true, the path to the CSV file.
 */
async function getWarActivity(factionId, message, exportCSV = false) {

    const response = await callTornApi('faction', 'basic,timestamp', factionId, undefined, undefined, undefined, undefined, "rotate", undefined);

    await new Promise(resolve => setTimeout(resolve, minDelay * 1000));


    if (!response[0]) {
        await message.edit({ content: response[1] });
        return;
    }

    const factionJson = response[2];

    const members = factionJson?.members || {};
    const memberLength = Object.keys(members).length;

    if (memberLength === 0) {
        await message.edit({ content: 'No members found!' });
        return;
    }

    const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson;

    const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;

    const reviveEmbed = initializeEmbed('Faction War Activity');
    reviveEmbed.setAuthor({ name: `${faction_tag} -  ${faction_name} [${faction_id}]`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${faction_id}` });

    let selectedMembers = '';
    const entriesList = [];
    const tableHeader = `\`${'Name'.padEnd(20, ' ')} | ${'Hits'.toString().padStart(5, ' ')} | ${'Retal'.toString().padStart(5, ' ')} | ${'SEs'.toString().padStart(5, ' ')}\`\n`;

    let memberCount = 0;
    let membersCount = 0;

    const membersList = members;

    let memberIndex = {}

    for (var id in membersList) {
        memberIndex[membersList[id].name] = id;
    }
    const sortedMembers = Object.values(membersList).sort(sortByName).reverse();

    for (const id in sortedMembers) {

        const member = sortedMembers[id];
        const memberId = memberIndex[member.name];

        if (message) {
            membersCount++;
            if (membersCount === 1 || membersCount % 5 === 0 || membersCount === memberLength) {
                let content = '';

                const progressBar = createProgressBar(membersCount, memberLength, 'circle');
                content = `Executing War Activity check for [${faction_name}](https://byrod.cc/f/${faction_id}), please wait.\n`;

                if (membersCount != memberLength) {
                    content += `${progressBar}\n`;
                }

                content += `${membersCount} of ${memberLength} members processed.`;
                await message.edit({ content: content });
                printLog(content);
            }
        }

        let activeKeys = 1;
        try {
            const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));
            const apiKeys = apiConfig.apiKeys;
            activeKeys = apiKeys.filter(key => key.active).length;

            if (activeKeys === 0) {
                activeKeys = 1;
            }
        } catch (error) {
            activeKeys = 1;
        }

        const totalCalls = 100;
        let delayInSeconds = (totalCalls / activeKeys / 15).toFixed(2);
        if (delayInSeconds < 1) {
            delayInSeconds = minDelay;
        }
        printLog(`Delay between calls: ${delayInSeconds} seconds`);
        await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));



        const statsResponse = await callTornApi('user', 'profile,personalstats', memberId, undefined, undefined, undefined, 'rankedwarhits,retals,statenhancersused,xantaken', "rotate", undefined);
        if (statsResponse[0]) {
            const statsJson = statsResponse[2];
            const personalstats = statsJson['personalstats'];
            const rankedwarhits = personalstats['rankedwarhits'];
            const retals = personalstats['retals'];
            const statenhancersused = personalstats['statenhancersused'];
            const xantaken = personalstats['xantaken'];

            const entry = `\`${cleanUpString(member.name).padEnd(20, ' ')} | ${rankedwarhits.toString().padStart(5, ' ')} | ${retals.toString().padStart(5, ' ')} | ${statenhancersused.toString().padStart(5, ' ')}\`\n`;
            const player = {
                name: cleanUpString(member.name),
                id: memberId,
                rankedwarhits: rankedwarhits,
                retals: retals,
                statenhancersused: statenhancersused,
                xantaken: xantaken
            };

            entriesList.push(player);

            selectedMembers += entry;
            memberCount++;
        }
    }

    const content = `>>> Found ${memberCount} members out of ${membersCount} members for faction ${faction_name} [${faction_id}].`;
    printLog(content);


    const MAX_FIELD_LENGTH = 1023; // Maximum allowed length for field value

    const chunks = [];
    let currentChunk = '';
    const lines = selectedMembers.split('\n');
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

    chunks.forEach((chunk, index) => {
        reviveEmbed.addFields({ name: tableHeader, value: chunk, inline: false });
    });

    let returnResult = {};

    if (exportCSV) {

        let csvString = 'Name,ID,Ranked War Hits,Retals,Stat Enhancers Used,Xanax Taken\n';

        entriesList.forEach(entry => {
            // Format the entry into a CSV string
            const entryString = `${entry.name},${entry.id},${entry.rankedwarhits},${entry.retals},${entry.statenhancersused},${entry.xantaken}\n`;

            // Append the formatted entry string to the CSV string
            csvString += entryString;
        });

        const csvFilePath = `./exports/war-activity_${factionId}_${Date.now()}.csv`;
        fs.writeFileSync(csvFilePath, csvString);
        returnResult.csvFilePath = csvFilePath;
    }

    returnResult.embed = reviveEmbed;
    return returnResult;
}


/**
 * Finds or creates a thread in a given channel with the specified name.
 *
 * @param {Channel} channel - The channel to search for the thread in.
 * @param {string} threadName - The name of the thread to find or create.
 * @return {Promise<Thread>} A Promise that resolves to the found or created thread.
 */
async function findOrCreateThread(channel, threadName) {
    let thread;
    thread = await channel.threads.cache.find((thread) => thread.name === threadName);

    if (!thread) {
        thread = await channel.threads.create({
            name: threadName,
        });
        await thread.send(threadName);
        printLog('>>> Thread created: ' + thread.name);
    } else {
        thread = await channel.threads.fetch(thread.id);
        printLog('>> Thread found: ' + thread.name);
    }
    return thread;
}

/**
 * Asynchronously retrieves a list of roles from a given guild, including their IDs, and filters the list by ID or role name.
 *
 * @param {Guild} guild - The guild to retrieve roles from.
 * @param {string|number} [filter=null] - The ID or name of the role to filter the list by. If not provided, all roles will be returned.
 * @return {Promise<Array<Object>>} A Promise that resolves to an array of objects containing role IDs and names.
 */
async function listServerRoles(guild, filter = null) {
    const roles = await guild.roles.fetch();
    let roleList = roles.map((role) => ({ id: role.id, name: role.name }));

    if (filter) {
        if (typeof filter === 'string') {
            roleList = roleList.filter((role) => role.name.toLowerCase().includes(filter.toLowerCase()));
        } else if (typeof filter === 'number') {
            roleList = roleList.filter((role) => role.id === filter);
        }
    }

    printLog('Roles in server: ' + JSON.stringify(roleList));

    return roleList;
}

/**
 * Asynchronously retrieves a list of users from a given guild who have a specific role, based on the role ID.
 *
 * @param {Guild} guild - The guild to retrieve users from.
 * @param {string|number} roleId - The ID of the role to filter users by.
 * @return {Promise<Array<User>>} A Promise that resolves to an array of User objects.
 */
async function getUsersByRole(guild, roleName) {
    printLog(`Getting users with role: ${roleName}`, 'info');
    const roleList = await listServerRoles(guild, roleName);

    const roleId = roleList[0].id;

    const members = await guild.members.fetch();
    const users = members.filter((member) => member.roles.cache.has(roleId)).map((member) => member.user);
    printLog('Users with role ID ' + roleId + ': ' + users.map((user) => user.tag).join(', '));

    return users;
}


module.exports = { checkArmoury, checkRetals, checkWar, checkMembers, sendStatusMsg, getOCStats, checkOCs, getOwnFactionReviveStatus, getFactionReviveStatus, getWarActivity, getTravelInformation, getUsersByRole, timestampCache };