const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { abbreviateNumber, cleanUpString, numberWithCommas, convertSecondsToDaysHours, getRankNameById } = require('../helper/formattings');
const { printLog, initializeEmbed, verifyChannelAccess } = require('../helper/misc');

const he = require('he');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('player-info')
        .setDescription('Get a players info! Add a tornid for checking another player, leave it empty for yourself.')
        .addIntegerOption(option =>
            option.setName('tornid')
                .setDescription('Torn user ID'))
        .addStringOption(option =>
            option.setName('operation')
                .setDescription('Operation to perform')
                .addChoices(
                    { name: 'History (30 days)', value: 'history' },
                    { name: 'Hall Of Fame', value: 'hall-of-fame' },
                    { name: 'Attack Info (2 days)', value: 'attacks' },
                )
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('hide')
                .setDescription('Hide response'))

    ,


    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, true)) return;

        const command = interaction.options.getString('operation') ?? 'history';
        const hide = interaction.options.getBoolean('hide') ?? false;

        const btnHistory = new ButtonBuilder()
            .setCustomId('history')
            .setLabel('History')
            .setStyle(ButtonStyle.Secondary);

        const btnHallOfFame = new ButtonBuilder()
            .setCustomId('hall-of-fame')
            .setLabel('Hall of Fame')
            .setStyle(ButtonStyle.Secondary);

        const btnAttackInfo = new ButtonBuilder()
            .setCustomId('attacks')
            .setLabel('Attack Info')
            .setStyle(ButtonStyle.Secondary);

        let embed = '';
        switch (command) {
            case 'history':
                embed = await playerHistory(interaction);
                btnHistory.setStyle(ButtonStyle.Primary);
                break;

            case 'hall-of-fame':
                embed = await playerHallOfFame(interaction);
                btnHallOfFame.setStyle(ButtonStyle.Primary);
                break;

            case 'attacks':
                embed = await playerAttackInfo(interaction);
                btnAttackInfo.setStyle(ButtonStyle.Primary);
                break;
        }

        await interaction.reply({ embeds: [embed], ephemeral: hide });

        let row = new ActionRowBuilder().addComponents(btnHistory, btnHallOfFame, btnAttackInfo);

        await interaction.editReply({ components: [row] });

        // Add a collector for the select menu interaction
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
        collector.on('collect', async i => {

            btnHistory.setStyle(ButtonStyle.Secondary);
            btnHallOfFame.setStyle(ButtonStyle.Secondary);
            btnAttackInfo.setStyle(ButtonStyle.Secondary);

            if (i.customId === 'history') {
                embed = await playerHistory(interaction);
                btnHistory.setStyle(ButtonStyle.Primary);
            } else if (i.customId === 'hall-of-fame') {
                embed = await playerHallOfFame(interaction);
                btnHallOfFame.setStyle(ButtonStyle.Primary);
            } else if (i.customId === 'attacks') {
                embed = await playerAttackInfo(interaction);
                btnAttackInfo.setStyle(ButtonStyle.Primary);
            }

            row = new ActionRowBuilder().addComponents(btnHistory, btnHallOfFame, btnAttackInfo);

            await i.update({ embeds: [embed], components: [row] });

        });

        collector.on('end', collected => {
            interaction.editReply({
                components: [],  // Remove the dropdown if no selection was made
            });
        });
    },
};

async function playerHistory(interaction) {
    const userID = interaction.options.getInteger('tornid') ?? interaction.user.id;

    const days = interaction.options.getInteger('days') ?? 30;

    const thismoment = moment();
    const historymoment = thismoment.subtract(days, 'days');

    const statsEmbed = initializeEmbed('Player History');


    const [response, responseHist] = await Promise.all([
        callTornApi('user', 'basic,personalstats,profile', userID, undefined, undefined, undefined, undefined, 'rotate'),
        callTornApi('user', 'basic,personalstats,profile', userID, undefined, undefined, historymoment.unix(), 'networth,refills,xantaken,statenhancersused,useractivity,energydrinkused,awards,medicalitemsused,overdosed', 'rotate')
    ]);

    if (response[0] && responseHist[0]) {
        const playerJson = response[2];
        const playerHistJson = responseHist[2];

        const personalstats = playerJson['personalstats'];
        const personalstatsHist = playerHistJson['personalstats'];

        const networthCur = personalstats['networth'];
        const refillsCur = personalstats['refills'];
        const xantakenCur = personalstats['xantaken'];
        const statenhancersusedCur = personalstats['statenhancersused'];
        const energydrinkusedCur = personalstats['energydrinkused'];
        const useractivityCur = personalstats['useractivity'] / 60 / 60;
        const medicalitemsusedCur = personalstats['medicalitemsused'];
        const awardsCur = personalstats['awards'];
        const overdosedCur = personalstats['overdosed'];

        const networthHist = personalstatsHist['networth'];
        const refillsHist = personalstatsHist['refills'];
        const xantakenHist = personalstatsHist['xantaken'];
        const statenhancersusedHist = personalstatsHist['statenhancersused'];
        const energydrinkusedHist = personalstatsHist['energydrinkused'];
        const useractivityHist = personalstatsHist['useractivity'] / 60 / 60;
        const medicalitemsusedHist = personalstatsHist['medicalitemsused'];
        const awardsHist = personalstatsHist['awards'];
        const overdosedHist = personalstatsHist['overdosed'];

        const tornUser = playerHistJson['name'];
        const tornId = playerHistJson['player_id'];
        const profileImage = playerHistJson['profile_image']
        const gender = playerHistJson['gender'];
        const awards = playerHistJson['awards'];

        const position = playerHistJson['faction']['position'];
        const faction_name = he.decode(playerHistJson['faction']['faction_name']);
        const faction_tag = playerHistJson['faction']['faction_tag'];
        const faction_id = playerHistJson['faction']['faction_id'];

        let iconUrl = (gender == 'Male') ? 'https://www.torn.com/images/profile_man.jpg' : 'https://www.torn.com/images/profile_girl.jpg';


        const revivable = playerHistJson['revivable'] === 0 ? ':red_circle:' : ':green_circle:';
        const networthDiff = networthCur - networthHist;

        if (profileImage !== undefined) {
            iconUrl = profileImage;
        } else {
            printLog(`Profile image not available for ${tornId}`);
        }

        statsEmbed.setTitle(`${cleanUpString(tornUser)} [${tornId}]`);
        statsEmbed.setURL(`https://byrod.cc/p/${tornId}`)
        statsEmbed.setDescription(`**Personal Stats** of *${cleanUpString(tornUser)} [${tornId}]* compared to ${days}d ago`);

        if (faction_id > 0) {
            statsEmbed.setAuthor({ name: `${position} of ${faction_tag} -  ${faction_name}`, iconURL: iconUrl, url: `https://byrod.cc/f/${faction_id}` })
        }

        let replyMsg = 'Stat'.padEnd(7) + ` | ${days}${'d ago'.padEnd(5)} | ${'Today'.padEnd(7)} | ${'Diff'.padEnd(7)} | ${'Daily'.padEnd(7)}\n`;
        replyMsg += '-'.padEnd(9 + 9 + 9 + 9 + 11, '-') + '\n';

        replyMsg = '';

        //statsEmbed.addFields({ name: 'Last Activity', value: `${statusIcon} ${status}\n${last_action}`, inline: true });
        statsEmbed.addFields({ name: ':information_source: Info', value: `\`Revivable:\` ${revivable}\n\`Awards: ${awards}\`\n\u200B`, inline: true });
        statsEmbed.addFields({ name: '\u200B', value: '\u200B', inline: true });
        statsEmbed.addFields({ name: '\u200B', value: '\u200B', inline: true });

        const statArray = [
            { name: 'Activity', hist: useractivityHist, cur: useractivityCur, sign: '+', icon: ':hourglass:' },
            { name: 'Refills', hist: refillsHist, cur: refillsCur, sign: '+', icon: ':recycle:' },
            { name: 'Networth', hist: networthHist, cur: networthCur, sign: networthDiff < 0 ? '-' : '+', icon: ':dollar:' },
            { name: 'Xanax', hist: xantakenHist, cur: xantakenCur, sign: '+', icon: ':pill:' },
            { name: 'Overdoses', hist: overdosedHist, cur: overdosedCur, sign: '+', icon: ':face_vomiting:' },
            { name: 'Cans', hist: energydrinkusedHist, cur: energydrinkusedCur, sign: '+', icon: ':battery:' },
            { name: 'SE used', hist: statenhancersusedHist, cur: statenhancersusedCur, sign: '+', icon: ':boxing_glove:' },
            { name: 'Med. used', hist: medicalitemsusedHist, cur: medicalitemsusedCur, sign: '+', icon: ':adhesive_bandage:' },
            { name: 'Awards', hist: awardsHist, cur: awardsCur, sign: '+', icon: ':military_medal:' },
        ];

        for (const stat of statArray) {
            const diff = stat.cur - stat.hist;

            if (stat.name === 'Empty') {
                statsEmbed.addFields({ name: '\u200B', value: '\u200B', inline: true });
            } else {
                statsEmbed.addFields(
                    { name: `${stat.icon} ${stat.name}`, value: `*${stat.sign}${abbreviateNumber(diff / days).toString()} per day*\n\`Current: ${abbreviateNumber(stat.cur).toString()}\`\n\`Change : ${stat.sign}${abbreviateNumber(diff).toString()}\`\n\u200B`, inline: true },
                );
            }
        }

    } else {
        statsEmbed.setTitle('Error')
            .setDescription(`\`\`\`${response[1]}\n${responseHist[1]}\`\`\``);
    }

    return statsEmbed;
}

async function playerHallOfFame(interaction) {

    let userID = interaction.options.getInteger('tornid') ?? interaction.user.id;

    const hofEmbed = initializeEmbed('Hall of Fame');

    const userResponse = await callTornApi('user', 'basic,profile', userID, undefined, undefined, undefined, undefined, 'rotate', undefined);
    if (userResponse[0]) {
        const userJson = userResponse[2];
        const tornUser = userJson['name'];
        const tornId = userJson['player_id'];
        const profileImage = userJson['profile_image'];
        const gender = userJson['gender'];

        const position = userJson['faction']['position'];
        const faction_name = he.decode(userJson['faction']['faction_name']);
        const faction_tag = userJson['faction']['faction_tag'];
        const faction_id = userJson['faction']['faction_id'];
        userID = tornId;

        let iconUrl = (gender == 'Male') ? 'https://www.torn.com/images/profile_man.jpg' : 'https://www.torn.com/images/profile_girl.jpg';
        if (profileImage !== undefined) {
            iconUrl = profileImage;
        } else {
            printLog(`Profile image not available for ${tornId}`);
        }

        if (faction_id > 0) {
            hofEmbed.setAuthor({ name: `${position} of ${faction_tag} -  ${faction_name}`, iconURL: iconUrl, url: `https://byrod.cc/f/${faction_id}` })
        }

        hofEmbed.setTitle(`${cleanUpString(tornUser)} [${tornId}]`);
        hofEmbed.setDescription(`**Hall of Fame** for *${cleanUpString(tornUser)} [${tornId}]*`);

        const hofResponse = await callTornApi('user', 'hof', tornId, undefined, undefined, undefined, undefined, 'rotate', undefined, 'v2');
        if (hofResponse[0]) {
            const hofJson = hofResponse[2];


            const hof = hofJson.hof;
            hofEmbed.setURL(`https://byrod.cc/p/${userID}`);

            const attacks = hof.attacks;
            const busts = hof.busts;
            const defends = hof.defends;
            const networth = hof.networth;
            const offences = hof.offences;
            const revives = hof.revives;
            const level = hof.level;
            const rank = hof.rank;
            const awards = hof.awards;
            const racingskill = hof.racing_skill;
            const racingpoints = hof.racing_points;
            const racingwins = hof.racing_wins;
            const traveltime = hof.travel_time;
            const workstats = hof.working_stats;

            hofEmbed.addFields(
                { name: `:100: Level`, value: `\`Rank : ${level.rank}\`\n\`Value: ${numberWithCommas(level.value)}\`\n\u200B`, inline: true },
                { name: `:ninja: Offences`, value: `\`Rank : ${offences.rank}\`\n\`Value: ${numberWithCommas(offences.value)}\`\n\u200B`, inline: true },
                { name: `:bar_chart: Rank`, value: `\`Rank : ${rank.rank}\`\n\`Value: ${rank.value} - ${getRankNameById(rank.value)}\`\n\u200B`, inline: true },
            )
            //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
            hofEmbed.addFields(
                { name: `:crossed_swords: Attacks`, value: `\`Rank : ${attacks.rank}\`\n\`Value: ${numberWithCommas(attacks.value)}\`\n\u200B`, inline: true },
                { name: `:shield: Defends`, value: `\`Rank : ${defends.rank}\`\n\`Value: ${numberWithCommas(defends.value)}\`\n\u200B`, inline: true },
                { name: `:oncoming_police_car: Busts`, value: `\`Rank : ${busts.rank}\`\n\`Value: ${numberWithCommas(busts.value)}\`\n\u200B`, inline: true },
            )
            //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
            hofEmbed.addFields(
                { name: `:medical_symbol: Revives`, value: `\`Rank : ${revives.rank}\`\n\`Value: ${numberWithCommas(revives.value)}\`\n\u200B`, inline: true },
                { name: `:airplane: Travel Time`, value: `\`Rank : ${traveltime.rank}\`\n\`Value: ${convertSecondsToDaysHours(traveltime.value)}\`\n\u200B`, inline: true },
                { name: `:dollar: Networth`, value: `\`Rank : ${networth.rank}\`\n\`Value: ${numberWithCommas(networth.value)}\`\n\u200B`, inline: true },
            )
            //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
            hofEmbed.addFields(
                { name: `~~Battle Stats~~`, value: '*hidden*', inline: true },
                { name: `:office_worker: Work Stats`, value: `\`Rank : ${workstats.rank}\`\n\`Value: ${numberWithCommas(workstats.value)}\`\n\u200B`, inline: true },
                { name: `:military_medal: Awards`, value: `\`Rank : ${awards.rank}\`\n\`Value: ${numberWithCommas(awards.value)}\`\n\u200B`, inline: true },
            )
            //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
            hofEmbed.addFields(
                { name: `:trophy: Racing Wins`, value: `\`Rank : ${racingwins.rank}\`\n\`Value: ${numberWithCommas(racingwins.value)}\`\n\u200B`, inline: true },
                { name: `:race_car: Racing Points`, value: `\`Rank : ${racingpoints.rank}\`\n\`Value: ${numberWithCommas(racingpoints.value)}\`\n\u200B`, inline: true },
                { name: `:wrench: Racing Skills`, value: `\`Rank : ${racingskill.rank}\`\n\`Value: ${numberWithCommas(racingskill.value)}\`\n\u200B`, inline: true },
            )
            //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
        }
    } else {
        hofEmbed.setTitle('User not found');
    }

    return hofEmbed;

}

async function playerAttackInfo(interaction) {
    const userID = interaction.options.getInteger('tornid') ?? interaction.user.id;

    const days = interaction.options.getInteger('days') ?? 2;

    const thismoment = moment();
    const historymoment = thismoment.subtract(days, 'days');

    const statsEmbed = initializeEmbed('Player Attack Info');

    const [response, responseHist] = await Promise.all([
        callTornApi('user', 'basic,personalstats,profile', userID, undefined, undefined, undefined, undefined, 'rotate'),
        callTornApi('user', 'basic,personalstats,profile', userID, undefined, undefined, historymoment.unix(), 'attackswon,attackslost,defendswon,defendslost,attacksassisted,attackswonabroad,defendslostabroad,rankedwarhits,respectforfaction', 'rotate')
    ]);

    if (response[0] && responseHist[0]) {
        const playerJson = response[2];
        const playerHistJson = responseHist[2];

        const personalstats = playerJson['personalstats'];
        const personalstatsHist = playerHistJson['personalstats'];

        const attackswonCur = personalstats['attackswon'];
        const attackslostCur = personalstats['attackslost'];
        const defendswonCur = personalstats['defendswon'];
        const defendslostCur = personalstats['defendslost'];
        const attacksassistedCur = personalstats['attacksassisted'];
        const attackswonabroadCur = personalstats['attackswonabroad'];
        const defendslostabroadCur = personalstats['defendslostabroad'];
        const rankedwarhitsCur = personalstats['rankedwarhits'];
        const respectforfactionCur = personalstats['respectforfaction'];

        const attackswonHist = personalstatsHist['attackswon'];
        const attackslostHist = personalstatsHist['attackslost'];
        const defendswonHist = personalstatsHist['defendswon'];
        const defendslostHist = personalstatsHist['defendslost'];
        const attacksassistedHist = personalstatsHist['attacksassisted'];
        const attackswonabroadHist = personalstatsHist['attackswonabroad'];
        const defendslostabroadHist = personalstatsHist['defendslostabroad'];
        const rankedwarhitsHist = personalstatsHist['rankedwarhits'];
        const respectforfactionHist = personalstatsHist['respectforfaction'];

        const tornUser = playerHistJson['name'];
        const tornId = playerHistJson['player_id'];
        const profileImage = playerHistJson['profile_image']
        const gender = playerHistJson['gender'];

        const position = playerHistJson['faction']['position'];
        const faction_name = he.decode(playerHistJson['faction']['faction_name']);
        const faction_tag = playerHistJson['faction']['faction_tag'];
        const faction_id = playerHistJson['faction']['faction_id'];

        let iconUrl = (gender == 'Male') ? 'https://www.torn.com/images/profile_man.jpg' : 'https://www.torn.com/images/profile_girl.jpg';

        const revivable = playerHistJson['revivable'] === 0 ? ':red_circle:' : ':green_circle:';


        if (profileImage !== undefined) {
            iconUrl = profileImage;
        } else {
            printLog(`Profile image not available for ${tornId}`);
        }

        statsEmbed.setTitle(`${cleanUpString(tornUser)} [${tornId}]`);
        statsEmbed.setURL(`https://byrod.cc/p/${tornId}`)
        statsEmbed.setDescription(`**Attack Stats** of *${cleanUpString(tornUser)} [${tornId}]* compared to ${days}d ago`);

        if (faction_id > 0) {
            statsEmbed.setAuthor({ name: `${position} of ${faction_tag} -  ${faction_name}`, iconURL: iconUrl, url: `https://byrod.cc/f/${faction_id}` })
        }

        let replyMsg = 'Stat'.padEnd(7) + ` | ${days}${'d ago'.padEnd(5)} | ${'Today'.padEnd(7)} | ${'Diff'.padEnd(7)} | ${'Daily'.padEnd(7)}\n`;
        replyMsg += '-'.padEnd(9 + 9 + 9 + 9 + 11, '-') + '\n';

        replyMsg = '';

        //statsEmbed.addFields({ name: 'Last Activity', value: `${statusIcon} ${status}\n${last_action}`, inline: true });
        statsEmbed.addFields({ name: ':information_source: Info', value: `\`Revivable:\` ${revivable}\n\u200B`, inline: true });
        statsEmbed.addFields({ name: '\u200B', value: '\u200B', inline: true });
        statsEmbed.addFields({ name: '\u200B', value: '\u200B', inline: true });

        const statArray = [
            { name: 'Attack Won', icon: ':crossed_swords:', sign: '+', cur: attackswonCur, hist: attackswonHist },
            { name: 'Attack Lost', icon: ':crossed_swords:', sign: '+', cur: attackslostCur, hist: attackslostHist },
            { name: 'Attack Won Abroad', icon: ':crossed_swords:', sign: '+', cur: attackswonabroadCur, hist: attackswonabroadHist },
            { name: 'Defend Won', icon: ':shield:', sign: '+', cur: defendswonCur, hist: defendswonHist },
            { name: 'Defend Lost', icon: ':shield:', sign: '+', cur: defendslostCur, hist: defendslostHist },
            { name: 'Defend Lost Abroad', icon: ':shield:', sign: '+', cur: defendslostabroadCur, hist: defendslostabroadHist },
            { name: 'Attack Assisted', icon: ':helmet_with_cross:', sign: '+', cur: attacksassistedCur, hist: attacksassistedHist },
            { name: 'Ranked War Hits', icon: ':medal:', sign: '+', cur: rankedwarhitsCur, hist: rankedwarhitsHist },
            { name: 'Respect for Faction', icon: ':star:', sign: '+', cur: respectforfactionCur, hist: respectforfactionHist },
        ];

        for (const stat of statArray) {
            const diff = stat.cur - stat.hist;


            statsEmbed.addFields(
                { name: `${stat.icon} ${stat.name}`, value: `*${stat.sign}${numberWithCommas(diff / days).toString()} per day*\n\`Current: ${numberWithCommas(stat.cur).toString()}\`\n\`Change : ${stat.sign}${numberWithCommas(diff).toString()}\`\n\u200B`, inline: true },
            )
        }

    } else {
        statsEmbed.setTitle('Error')
            .setDescription(`\`\`\`${response[1]}\n${responseHist[1]}\`\`\``);
    }

    return statsEmbed;
}