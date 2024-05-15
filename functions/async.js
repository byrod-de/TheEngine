const fs = require('node:fs');

const { printLog, getFlagIcon, sortByUntil, sortByName, updateOrDeleteEmbed, readConfig, calculateMonthTimestamps, calculateLastXDaysTimestamps, initializeEmbed, getTravelTimes } = require('../helper/misc');
const { extractFromRegex, cleanUpString, createProgressBar, splitIntoChunks } = require('../helper/formattings');

const { callTornApi } = require('../functions/api');

const NodeCache = require("node-cache");
const territoryCache = new NodeCache();
const timestampCache = new NodeCache();
const memberCache = new NodeCache();

const moment = require('moment');
const os = require('os');

const hostname = os.hostname();

const { homeFaction, minDelay } = readConfig().apiConf;

const apiConfigPath = './conf/apiConfig.json';

let memberTitle = 'Criminal';
if (homeFaction === '7709') memberTitle = 'Fox';
if (homeFaction === '9032') memberTitle = 'Wolf';

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
 * Asynchronously checks territories for updates and sends a message to the territory channel.
 *
 * @param {string} territoryChannel - The channel for territory updates
 * @param {number} territoryUpdateInterval - The interval for territory updates
 * @return {Promise<void>} A promise that resolves when the function completes
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


            let territoryEmbed = initializeEmbed('Territory Status');
            territoryEmbed.setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` });

            let territories = territoryJson ? Object.keys(territoryJson.territory).sort() : null;
            if (!territories || territories.length <= 0) {
                continue;
            }

            let cachedTTs = territoryCache.get(faction_id);
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



            if (territoryCache.set(faction_id, territories, 120)) printLog(`Cache updated for ${faction_name} [${faction_id}] with ${territories}`);
        }

    }
}


/**
 * Asynchronously checks the armoury for updates and posts relevant information to the specified channel.
 *
 * @param {string} armouryChannel - The channel where the armoury updates will be posted
 * @param {number} armouryUpdateInterval - The interval at which the armoury will be checked for updates
 * @return {Promise<void>} A promise that resolves once the armoury check is completed
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
                    const armouryEmbed = initializeEmbed('Armoury Usage');
                    armouryEmbed.setAuthor({ name: `${cleanUpString(tornUser)} [${tornId}]`, iconURL: faction_icon, url: `https://www.torn.com/profiles.php?XID=${tornId}` });

                    armouryEmbed.addFields({ name: `${item}`, value: `${tornUser} [${tornId}] ${newstext}`, inline: false });


                    if (armouryChannel) {
                        armouryChannel.send({ embeds: [armouryEmbed], ephemeral: false });
                    } else {
                        printLog('armouryChannel is undefined');
                    }
                }
            }
        }

        if (timestampCache.set('armouryExecTime', currentTimestamp, 120)) printLog(`Cache updated for 'armouryExecTime' with ${currentTimestamp}`);

    }
}


/**
 * Asynchronously checks the retals based on the provided retals channel and retals update interval.
 *
 * @param {string} retalChannel - The channel to send retals to
 * @param {number} retalUpdateInterval - The interval at which to update retals
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

                const attackEmbed = initializeEmbed(`Retal on ${cleanUpString(attacker_name)} [${attacker_id}]`);

                attackEmbed.setURL(`https://www.torn.com/loader.php?sid=attack&user2ID=${attacker_id}`)
                    .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                    .setDescription(`Retal deadline <t:${deadline}:R>`);

                attackEmbed.addFields({ name: `Defender`, value: `${cleanUpString(defender_name)} [${defender_id}]`, inline: false });
                attackEmbed.addFields({ name: `Attacker`, value: `${cleanUpString(attacker_name)} [${attacker_id}] of ${attacker_factionname}`, inline: false });
                printLog(`Defender ${cleanUpString(defender_name)} [${defender_id}] < Attacker ${cleanUpString(attacker_name)} [${attacker_id}] of ${attacker_factionname}`);


                if (overseas) attackEmbed.addFields({ name: `Additional Info`, value: `Attack was abroad.`, inline: false });


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
                    printLog('retalChannel is undefined');
                }
            }
        }

        if (timestampCache.set('retalExecTime', currentTimestamp, 120)) printLog(`Cache updated for 'retalExecTime' with ${currentTimestamp}`);

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
async function checkWar(warChannel, memberChannel, warUpdateInterval, travelChannel = undefined) {

    if (warChannel) {

        const responseRW = await callTornApi('faction', 'basic,timestamp');

        if (responseRW[0]) {
            const factionJson = responseRW[2];
            const ownFactionName = factionJson['name'];
            const ownFactionTag = factionJson['tag'];
            const ownFactionID = factionJson['ID'];
            const ownFactionIcon = `https://factiontags.torn.com/` + factionJson['tag_image'];

            const rankedWars = factionJson['ranked_wars'];

            const rwEmbed = initializeEmbed(`Embed`);
            const travelEmbed = initializeEmbed(`Embed`);
            const hospitalEmbed = initializeEmbed(`Embed`);
            const statusEmbed = initializeEmbed(`Embed`);
            const ownTravelEmbed = initializeEmbed(`Embed`);
            const ownHospitalEmbed = initializeEmbed(`Embed`);
            const ownStatusEmbed = initializeEmbed(`Embed`);

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

                //start x min before
                const preStart = 60 * 60;
                if (war.start - preStart < timestamp) {
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

                let description = `**Start time:** <t:${war.start}:f> (<t:${war.start}:R>)`;

                description += `\n**Target:** \`${war.target.toString().padStart(6, ' ')}\` `;

                if ((isActive || hasEnded) && lead > 0) {
                    description += `**Lead:** \`${lead.toString().padStart(6, ' ')}\``;
                    let currentLead = lead;
                    if (faction1StatusText.toLocaleLowerCase().includes('win')) {
                        currentLead = -1 * currentLead;
                    }
                    description += `\n${createProgressBar(currentLead, war.target, 'scale', 18)}`;

                    //const remainingTime = getRemainingTime(war.start, war.target, lead, timestamp);
                    //description += `\n**Projected End:** <t:${remainingTime}:f> (<t:${remainingTime}:R>)`;
                }

                fieldFaction1 = `${faction1StatusIcon} ${faction1StatusText}\n:game_die: **Score:** ${faction1.score}`;
                fieldFaction2 = `${faction2StatusIcon} ${faction2StatusText}\n:game_die: **Score:** ${faction2.score}`;

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

                        fieldFaction1 += `\n:gift: **Rewards:**\n${faction1Items}`;
                        fieldFaction2 += `\n:gift: **Rewards:**\n${faction2Items}`;
                    }

                } else {
                    fieldFaction1 += `\n:link: **Chain:**  ${faction1.chain}`;
                    fieldFaction2 += `\n:link: **Chain:**  ${faction2.chain}`;
                }

                rwEmbed.setTitle(`Ranked war between _${faction1.name}_ and _${faction2.name}_`)
                    .setURL(`https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}#/war/rank`)
                    .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` })
                    .setDescription(`${description}\n_Update interval: every ${warUpdateInterval} minutes._`);


                //await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed);

                if (isActive && !hasEnded) {

                    travelEmbed.setTitle(`:airplane: Members traveling`)
                        .setDescription(`List of opponent members, which are traveling\n_Update interval: every ${warUpdateInterval} minutes._`);

                    hospitalEmbed.setTitle(`:hospital: Members in hospital`)
                        .setDescription(`List of the next ${memberLimitForEmbed} members which will be out of hospital\n_Update interval: every ${warUpdateInterval} minutes._`);

                    statusEmbed.setTitle(`:bar_chart: Member Overview`)
                        .setDescription(`Some details about the member status of each faction\n_Update interval: every ${warUpdateInterval} minutes._`);


                    ownTravelEmbed.setTitle(`:airplane: Members traveling`)
                        .setDescription(`List of ${ownFactionName} members, which are traveling\n_Update interval: every ${warUpdateInterval} minutes._`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` });

                    ownHospitalEmbed.setTitle(`:hospital: Members in hospital`)
                        .setDescription(`List of the next ${memberLimitForEmbed} members which will be out of hospital\n_Update interval: every ${warUpdateInterval} minutes._`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` });

                    ownStatusEmbed.setTitle(`:bar_chart: Member Overview`)
                        .setDescription(`Some details about the member status of ${ownFactionName}\n_Update interval: every ${warUpdateInterval} minutes._`)
                        .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` });

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
                                const flagIcon = getFlagIcon(memberStatusState, member.status.description);


                                //check Traveling status
                                if (memberStatusState == 'Traveling' || memberStatusState == 'Abroad' || member.status.description.includes('In a ')) {

                                    if (memberStatusState == 'Traveling') {
                                        travelingMemberCount++;
                                    } else {
                                        abroadMemberCount++;
                                    }

                                    if (travelingMemberCount + abroadMemberCount <= memberLimitForEmbed) {
                                        let entry = `${flagIcon.direction} ${flagIcon.flag} [»»](https://www.torn.com/profiles.php?XID=${memberIndex[member.name]}) ${cleanUpString(member.name)}`;
                                        if (member.status.description.includes('In a ')) entry += ' :syringe:';
                                        travelingMembers += entry + '\n';
                                    }
                                }

                                //check Hospital status
                                if (memberStatusState == 'Hospital') {
                                    hospitalMemberCount++;

                                    if (hospitalMemberCount < memberLimitForEmbed) {
                                        let flag = flagIcon.flag;
                                        if (flag == ':flag_black:') flag = '';

                                        const entry = `:syringe: [»»](https://www.torn.com/loader.php?sid=attack&user2ID=${memberIndex[member.name]}) ${flag} ${cleanUpString(member.name)} <t:${member.status.until}:R>\n`;
                                        if (hospitalMembers.length + entry.length < 1024) hospitalMembers += entry;
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

                            statusEmbed.addFields({ name: `${faction.name} [${factionID}]`, value: `:ok_hand: Okay: ${okayMemberCount}\n:airplane: Traveling: ${travelingMemberCount}\n:golf: Abroad: ${abroadMemberCount}\n:syringe: Hospital: ${hospitalMemberCount}\n:oncoming_police_car: Jail: ${jailMembersCount}\n:no_entry_sign: Federal: ${federalMembersCount}\n\n:green_circle: Online: ${membersOnline}\n:yellow_circle: Idle: ${membersIdle}\n:black_circle: Offline: ${membersOffline}`, inline: true });

                            if (factionID == ownFactionID) {
                                travelEmbed.addFields({ name: `${faction.name} [${factionID}]\nTraveling: (${travelingMemberCount}/${memberCount})\nAbroad: (${abroadMemberCount}/${memberCount})`, value: `${travelingMembers}`, inline: true });
                                ownTravelEmbed.addFields({ name: `${faction.name} [${factionID}]\nTraveling: (${travelingMemberCount}/${memberCount})\nAbroad: (${abroadMemberCount}/${memberCount})`, value: `${travelingMembers}`, inline: true });
                                ownHospitalEmbed.addFields({ name: `${faction.name} [${factionID}]\nIn hospital: (${hospitalMemberCount}/${memberCount})`, value: `${hospitalMembers}`, inline: true });
                                ownStatusEmbed.addFields({ name: `${faction.name} [${factionID}]`, value: `:airplane: Traveling: ${travelingMemberCount}\n:syringe: Hospital: ${hospitalMemberCount}\n:golf: Abroad: ${abroadMemberCount}\n:ok_hand: Okay: ${okayMemberCount}`, inline: true });

                                if (faction1ID == ownFactionID) {
                                    fieldFaction1 += `\n:ok_hand: **Okay:** ${okayMemberCount}`;
                                } else {
                                    fieldFaction2 += `\n:ok_hand: **Okay:** ${okayMemberCount}`;
                                }
                            }

                            if (factionID != ownFactionID) {
                                travelEmbed.addFields({ name: `${faction.name} [${factionID}]\nTraveling: (${travelingMemberCount}/${memberCount})\nAbroad: (${abroadMemberCount}/${memberCount})`, value: `${travelingMembers}`, inline: true });
                                hospitalEmbed.addFields({ name: `${faction.name} [${factionID}]\nIn hospital: (${hospitalMemberCount}/${memberCount})`, value: `${hospitalMembers}`, inline: true });

                                if (faction1ID != ownFactionID) {
                                    fieldFaction1 += `\n:ok_hand: **Okay:** ${okayMemberCount}`;
                                } else {
                                    fieldFaction2 += `\n:ok_hand: **Okay:** ${okayMemberCount}`;
                                }

                                if (travelChannel) {
                                    await getTravelInformation(travelChannel, warUpdateInterval, factionID);
                                }
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

                rwEmbed.addFields({ name: `${faction1.name} [${faction1ID}]`, value: fieldFaction1, inline: true });
                rwEmbed.addFields({ name: `${faction2.name} [${faction2ID}]`, value: fieldFaction2, inline: true });
                await updateOrDeleteEmbed(warChannel, 'rw', rwEmbed);
            } else {

                const responseMainNews = await callTornApi('faction', 'mainnews,timestamp', undefined, undefined, undefined, undefined, undefined, 'default');

                if (responseMainNews[0]) {
                    const newsJson = responseMainNews[2];
                    const mainnews = newsJson['mainnews'];
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

                            //
                            const currentDate = new Date();
                            const currentDay = currentDate.getUTCDay(); // 0 (Sunday) to 6 (Saturday)
                            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
                            let daysUntilTuesday = (2 + 7 - currentDay) % 7;

                            // Check if it's already Tuesday and past 12:00 PM
                            if (currentDay === 2 && currentDate.getUTCHours() >= 12) {
                                daysUntilTuesday += 7; // Move to next week
                            }

                            printLog(`Current day: ${dayName}, Days until Tuesday: ${daysUntilTuesday}`);

                            const nextTuesday = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate() + daysUntilTuesday));
                            nextTuesday.setUTCHours(12, 0, 0, 0);

                            let nextTuesdayTS = Math.floor(nextTuesday.getTime() / 1000);
                            nextTuesdayTS = `<t:${nextTuesdayTS}:R>`;
                            description += `\n:hourglass: Next matchmaking ${nextTuesdayTS}`;

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

                        rwEmbed.setTitle(`Faction is currently enlisted!`)
                            .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionID}` })
                            .setDescription(description);

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
 * Retrieves travel information for a given faction and sends it to a specified channel.
 *
 * @param {Channel} travelChannel - The channel where the travel information will be sent.
 * @param {number} travelUpdateInterval - The interval in minutes at which the travel information should be updated.
 * @param {number} factionId - The ID of the faction for which travel information is being retrieved. Defaults to the home faction ID.
 * @return {Promise<void>} A promise that resolves when the travel information has been retrieved and sent.
 */
async function getTravelInformation(travelChannel, travelUpdateInterval, factionId = homeFaction) {

    if (travelChannel) {

        const responseMembers = await callTornApi('faction', 'basic,timestamp', factionId, undefined, undefined, undefined, undefined, 'rotate');

        if (responseMembers[0]) {
            const factionJson = responseMembers[2];
            const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson;
            const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;

            const membersList = factionJson.members;
            const timestamp = factionJson.timestamp;

            const travelTimestampCache = timestampCache.get(`travelTimestamp_${faction_id}`);

            let firstRun = false;
            if (travelTimestampCache == undefined) {
                firstRun = true;
            }

            timestampCache.set(`travelTimestamp_${faction_id}`, timestamp, 120 * travelUpdateInterval)

            let memberIndex = {}

            for (var id in membersList) {
                memberIndex[membersList[id].name] = id;
            }

            const sortedMembers = Object.values(membersList).sort(sortByUntil).reverse();

            for (var id in sortedMembers) {

                let member = sortedMembers[id];
                let memberStatusState = member.status.state;

                const cachedTravelInfo = memberCache.get(memberIndex[member.name]);
                const flagIcon = getFlagIcon(memberStatusState, member.status.description);

                let embedCategory = 'default';
                if (factionId != homeFaction) {
                    embedCategory = 'error';
                }

                const travelEmbed = initializeEmbed(`${cleanUpString(member.name)} [${memberIndex[member.name]}]`, embedCategory);
                travelEmbed.setURL(`https://www.torn.com/profiles.php?XID=${memberIndex[member.name]}`)
                    .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                    .setDescription(member.status.description + ' ' + flagIcon.flag);

                //check Traveling status
                if (memberStatusState == 'Traveling') {

                    let travelInfo = `<${memberStatusState}> [${member.status.description}]`;

                    if (cachedTravelInfo) {

                        printLog(`>>> Member in air: [${memberIndex[member.name]}] - ${cachedTravelInfo}`);

                        const cachedStatusState = extractFromRegex(cachedTravelInfo, /<(.+)>/);
                        const cachedStatusDesc = extractFromRegex(cachedTravelInfo, /\[(.+)\]/);
                        //console.log(cachedStatusState, cachedStatusDesc, member.status.description);
                        if (member.status.description != cachedStatusDesc && cachedStatusState == 'Traveling') {
                            printLog(`>>> Member status changed: [${memberIndex[member.name]}] - ${cachedTravelInfo}`);

                            try {
                                const messageID = extractFromRegex(cachedTravelInfo, /\((\d+)\)/);

                                try {
                                    const originalMessage = await travelChannel.messages.fetch(messageID);

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
                                        else printLog('Failed to edit the message: ' + error);
                                    }

                                } catch (fetchError) {
                                    if (fetchError.code === 10008) printLog('Message not found: ' + fetchError);
                                    else printLog('Failed to fetch the message: ' + fetchError);
                                }

                                travelInfo += ` (${messageID})`;

                                memberCache.set(memberIndex[member.name], travelInfo, 120);
                                printLog(`Member cache entry for ${member.name} has been updated.`);

                            } catch (error) {
                                printLog('Failed to process the message deletion or cache update: ' + error);
                            }

                        } else {
                            travelInfo = cachedTravelInfo;
                        }

                    } else {
                        if (firstRun) {
                            printLog(`>>> First Run, Member already traveling: ${memberIndex[member.name]} - ${travelInfo}`);
                            travelEmbed.addFields({ name: `:airplane_departure: ${member.name} is already traveling`, value: `*No details available*`, inline: true });

                        } else {
                            printLog(`>>> Member started traveling: [${memberIndex[member.name]}] - ${travelInfo}`);

                            const travelTimes = getTravelTimes(memberStatusState, member.status.description);

                            const travelDetails =
                                `:timer: \`Start   :\` ± <t:${timestamp}:f>\n`
                                + `:airplane_small: \`Standard:\`<t:${timestamp + travelTimes.standard * 60}:R>\n`
                                + `:airplane: \`Airstrip:\`<t:${timestamp + travelTimes.airstrip * 60}:R>\n`
                                + `:earth_africa: \`WLT     :\`<t:${timestamp + travelTimes.wlt * 60}:R>\n`
                                + `:ticket: \`BCT     :\`<t:${timestamp + travelTimes.bct * 60}:R>\n`;

                            travelEmbed.addFields({ name: `:airplane_departure: Estimated time of arrival:`, value: `${travelDetails}`, inline: true });
                        }

                        const message = await travelChannel.send({ embeds: [travelEmbed], ephemeral: false });

                        travelInfo += ` (${message.id})`;
                    }

                    memberCache.set(memberIndex[member.name], travelInfo, 120);
                } else {
                    if (cachedTravelInfo) {
                        printLog(`>>> Member stopped traveling: [${memberIndex[member.name]}] - ${cachedTravelInfo}`);

                        const messageID = extractFromRegex(cachedTravelInfo, /\((\d+)\)/);

                        if (messageID) {
                            const travelDetails =
                                `\`Landed  : \` around <t:${timestamp}:f>`;

                            travelEmbed.addFields({ name: `:airplane_arriving: ${member.name} stopped travelling:`, value: `${travelDetails}`, inline: true });
                            if (memberStatusState != 'Traveling' && memberStatusState != 'Abroad') {
                                travelEmbed.setDescription(flagIcon.flag + ' In Torn');
                            }

                            try {
                                const originalMessage = await travelChannel.messages.fetch(messageID);

                                try {
                                    await originalMessage.edit({ embeds: [travelEmbed], ephemeral: false });

                                    const delMinutes = 5;

                                    printLog(`> Embed with message ID ${messageID} has been edited and will be deleted in ${delMinutes} minutes.`);

                                    setTimeout(() => {
                                        originalMessage.delete().catch(deleteError => {
                                            printLog('Failed to delete the message:' + deleteError);
                                        });
                                    }, delMinutes * 60 * 1000);

                                } catch (error) {
                                    if (error.code === 10008) printLog('Message not found: ' + error);
                                    else printLog('Failed to edit the message: ' + error);
                                }

                            } catch (fetchError) {
                                if (fetchError.code === 10008) printLog('Message not found: ' + fetchError);
                                else printLog('Failed to fetch the message: ' + fetchError);
                            }


                        }
                    }

                    memberCache.del(memberIndex[member.name]);
                }
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
async function checkMembers(memberChannel, memberUpdateInterval) {

    if (memberChannel) {

        const response = await callTornApi('faction', 'basic,timestamp', homeFaction);
        const jailEmbed = initializeEmbed(`:oncoming_police_car: Bust a ${memberTitle}!`);
        const ownStatusEmbed = initializeEmbed(`:bar_chart: Member Overview`);

        if (response[0]) {
            const factionJson = response[2];
            const ownFactionName = factionJson['name'];
            const ownFactionTag = factionJson['tag'];
            const ownFactionId = factionJson['ID'];
            const ownFactionIcon = `https://factiontags.torn.com/` + factionJson['tag_image'];
            const timestamp = factionJson['timestamp'];
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
                jailEmbed.setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionId}` })
                    .setDescription(`_Update interval: every ${memberUpdateInterval} minutes._`);

                const entryFormat = `:oncoming_police_car: [»»](https://www.torn.com/profiles.php?XID={{id}}) {{name}} - out <t:{{statusUntil}}:R>\n`;
                const jailChunks = splitIntoChunks(jailMembersList, entryFormat);

                // Add each chunk as a separate field
                jailChunks.forEach((chunk, index) => {
                    jailEmbed.addFields({ name: `Members in jail (${index + 1}/${jailChunks.length})`, value: chunk, inline: true });
                });

                await updateOrDeleteEmbed(memberChannel, 'jail', jailEmbed);
            } else {
                await updateOrDeleteEmbed(memberChannel, 'jail', jailEmbed, 'delete');
            }
            ownStatusEmbed.setDescription(`_Update interval: every ${memberUpdateInterval} minutes._`)
                .setAuthor({ name: `${ownFactionTag} -  ${ownFactionName}`, iconURL: ownFactionIcon, url: `https://www.torn.com/factions.php?step=profile&ID=${ownFactionId}` });

            ownStatusEmbed.addFields({ name: `Member Status`, value: `:ok_hand: Okay: ${okayMemberCount}\n:airplane: Traveling: ${travelingMemberCount}\n:golf: Abroad: ${abroadMemberCount}\n:syringe: Hospital: ${hospitalMemberCount}\n:oncoming_police_car: Jail: ${jailMembersCount}\n:no_entry_sign: Federal: ${federalMembersCount}`, inline: true });
            ownStatusEmbed.addFields({ name: `Online Status`, value: `:green_circle: Online: ${membersOnline}\n:yellow_circle: Idle: ${membersIdle}\n:black_circle: Offline: ${membersOffline}`, inline: true });
            if (offlineMembersList.length > 0) {
                let offlineMembersEntries = '';
                for (const member of offlineMembersList) {
                    const entry = `:zzz: [»»](https://www.torn.com/profiles.php?XID=${member.id}) ${cleanUpString(member.name)} last seen <t:${member.lastActionTimestamp}:R>\n`;
                    offlineMembersEntries += entry;
                }
                ownStatusEmbed.addFields({ name: 'Offline > 1 day', value: offlineMembersEntries, inline: false });
            }
            await updateOrDeleteEmbed(memberChannel, 'ownStatus', ownStatusEmbed);
        }
    }
}

/**
 * Asynchronously retrieves OC (Organized Crime) statistics for the specified month and generates an embed with the statistics.
 *
 * @param {number} selectedDateValue - The value representing the selected month.
 * @return An embed containing OC statistics for the specified month.
 */
async function getOCStats(selection, selectedDateValue) {

    let timestamps;
    let title = '';

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
        title = `*Last ${selectedDateValue} Days*`;
        timestamps = calculateLastXDaysTimestamps(selectedDateValue, 192);
    }

    var firstDay = timestamps.firstDay;
    var lastDay = timestamps.lastDay;

    const response = await callTornApi('faction', 'basic,crimes,timestamp', undefined, firstDay, lastDay);

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

    const lastDateFormatted = (new Date(lastDay * 1000)).toISOString().replace('T', ' ').replace('.000Z', '');

    if (title === '') {
        title = `*${lastDateFormatted.substring(0, 7)}*`;
    }

    const ocEmbed = initializeEmbed(`OC Overview for ${title}`);
    ocEmbed.setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` });

    const crimeSummary = {};

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
        printLog(crimeName + " " + total + " " + successRate.toFixed(2) + "%");
        ocEmbed.addFields({ name: crimeName, value: `:blue_circle: \`${'Total'.padEnd(12, ' ')}:\` ${total}\n:green_circle: \`${'Success'.padEnd(12, ' ')}:\` ${success}\n:red_circle: \`${'Failed'.padEnd(12, ' ')}:\` ${failed}\n:chart_with_upwards_trend: \`${'Success rate'.padEnd(12, ' ')}:\` **${successRate.toFixed(2)}%**\n:moneybag: \`${'Money gained'.padEnd(12, ' ')}:\` $${crimeSummary[crimeName].money_gain.toLocaleString('en')}`, inline: true });
    }

    return ocEmbed;
}

/**
 * Asynchronously checks the OCs for the member channel and updates the OC status embed.
 *
 * @param {Object} memberChannel - The member channel to check for OCs
 * @param {number} memberUpdateInterval - The interval for updating the member channel
 * @return {Promise<void>} A Promise that resolves once the embed is updated or deleted
 */
async function checkOCs(memberChannel, memberUpdateInterval) {
    const now = moment();

    const ownStatusEmbed = await getOCStats('months');
    ownStatusEmbed.setDescription(`_Update interval: every ${(memberUpdateInterval * 60).toFixed(0)} minutes._`)

    await updateOrDeleteEmbed(memberChannel, 'ocStatus', ownStatusEmbed);
}


/**
 * Asynchronously retrieves the revive status for a faction and generates an embed with the status of revivable members.
 *
 * @param {string} factionId - The ID of the faction for which the revive status is to be retrieved.
 * @param {Message} message - The message object for updating the revive status progress.
 * @return The embed containing the revive status of faction members.
 */
async function getReviveStatus(factionId, message) {

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

    const reviveEmbed = initializeEmbed('Faction Revive Status');
    reviveEmbed.setAuthor({ name: `${faction_tag} -  ${faction_name} [${faction_id}]`, iconURL: faction_icon_URL, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
        .setDescription('*Note: Members with "Friends & faction" settings might be displayed too.*')
        ;

    let revivableMembers = '';
    let reviveCount = 0;
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
                content = `Executing Revive Status for [${faction_name}](https://www.torn.com/factions.php?step=profile&ID=${faction_id}), please wait.\n`;

                if (membersCount != memberLength) {
                    content += `${progressBar}\n`;
                }

                content += `${membersCount} of ${memberLength} members processed.`;
                await message.edit({ content: content });
                printLog(content);
            }
        }

        let activeReviverKeys = 1;
        try {
            const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));
            const apiKeys = apiConfig.apiKeys;
            activeReviverKeys = apiKeys.filter(key => key.active && key.reviver).length;

            if (activeReviverKeys === 0) {
                activeReviverKeys = 1;
            }
        } catch (error) {
            activeReviverKeys = 1;
        }

        const totalCalls = 100;
        let delayInSeconds = (totalCalls / activeReviverKeys / 15).toFixed(2);
        if (delayInSeconds < 1) {
            delayInSeconds = minDelay;
        }
        printLog(`Delay between calls: ${delayInSeconds} seconds`);
        await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));

        const reviveResponse = await callTornApi('user', 'profile', memberId, undefined, undefined, undefined, undefined, "revive", undefined);
        if (reviveResponse[0]) {
            const reviveJson = reviveResponse[2];
            printLog(`${member.name} checked, revive status = ${reviveJson.revivable}`);
            if (reviveJson.revivable == 1) {

                let reviveIcon = '';
                if (reviveJson.gender === 'Male') {
                    reviveIcon = ':man_health_worker:';
                } else if (reviveJson.gender === 'Female') {
                    reviveIcon = ':woman_health_worker:';
                } else {
                    reviveIcon = ':health_worker:';
                }

                let statusIcon = ':black_small_square:';

                switch (member.status.state) {
                    case 'Hospital': statusIcon = ':syringe:'; break;
                    case 'Jail': statusIcon = ':oncoming_police_car:'; break;
                    case 'Abroad': statusIcon = getFlagIcon(member.status.state, member.status.description).flag; break;
                    case 'Traveling': statusIcon = getFlagIcon(member.status.state, member.status.description).flag; break;
                }

                const entry = `${statusIcon} [»»](https://www.torn.com/profiles.php?XID=${memberId}) ${cleanUpString(member.name)}\n`;

                revivableMembers += entry;
                reviveCount++;
            }
        }
    }

    const content = `>>> Found ${reviveCount} revivable members out of ${membersCount} members for faction ${faction_name} [${faction_id}].`;
    printLog(content);

    if (message) {
        //await message.delete();
    }

    const MAX_FIELD_LENGTH = 1023; // Maximum allowed length for field value

    // Split revivableMembers into multiple chunks
    const chunks = [];
    let currentChunk = '';
    const lines = revivableMembers.split('\n');
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
        reviveEmbed.addFields({ name: `(${index + 1}/${chunks.length})`, value: chunk, inline: true });
    });
    reviveEmbed.setTitle(`Players with revives on (${reviveCount}/${membersCount})`);

    return reviveEmbed;
}



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
    reviveEmbed.setAuthor({ name: `${faction_tag} -  ${faction_name} [${faction_id}]`, iconURL: faction_icon_URL, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
        ;

    let selectedMembers = '';
    const entries = [];
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
                content = `Executing War Activity check for [${faction_name}](https://www.torn.com/factions.php?step=profile&ID=${faction_id}), please wait.\n`;

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



        const statsResponse = await callTornApi('user', 'profile,personalstats', memberId, undefined, undefined, undefined, 'rankedwarhits,retals,statenhancersused', "rotate", undefined);
        if (statsResponse[0]) {
            const statsJson = statsResponse[2];
            const personalstats = statsJson['personalstats'];
            const rankedwarhits = personalstats['rankedwarhits'];
            const retals = personalstats['retals'];
            const statenhancersused = personalstats['statenhancersused'];

            const entry = `\`${cleanUpString(member.name).padEnd(20, ' ')} | ${rankedwarhits.toString().padStart(5, ' ')} | ${retals.toString().padStart(5, ' ')} | ${statenhancersused.toString().padStart(5, ' ')}\`\n`;
            const player = {
                name: cleanUpString(member.name),
                id: memberId,
                rankedwarhits: rankedwarhits,
                retals: retals,
                statenhancersused: statenhancersused
            };

            entries.push(player);

            selectedMembers += entry;
            memberCount++;
        }
    }

    const content = `>>> Found ${memberCount} members out of ${membersCount} members for faction ${faction_name} [${faction_id}].`;
    printLog(content);

    if (message) {
        //await message.delete();
    }

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

        let csvString = 'Name,ID,Ranked War Hits,Retals,Stat Enhancers Used\n';

        entries.forEach(entry => {
            // Format the entry into a CSV string
            const entryString = `${entry.name},${entry.id},${entry.rankedwarhits},${entry.retals},${entry.statenhancersused}\n`;

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


module.exports = { checkTerritories, checkArmoury, checkRetals, checkWar, checkMembers, sendStatusMsg, getOCStats, checkOCs, getReviveStatus, getWarActivity, getTravelInformation, timestampCache };