const { SlashCommandBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { abbreviateNumber, cleanUpString, numberWithCommas } = require('../helper/formattings');
const { printLog, initializeEmbed, verifyChannelAccess } = require('../helper/misc');

const he = require('he');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('player-info')
        .setDescription('Get a players info! Add a tornid for checking another player, leave it empty for yourself.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('Get a players stat history!')
                .addIntegerOption(option =>
                    option.setName('tornid')
                        .setDescription('Torn user ID'))
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days'))
                .addBooleanOption(option =>
                    option.setName('hide')
                        .setDescription('Hide response'))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('hall-of-fame')
                .setDescription('Get a players hall of fame information!')
                .addIntegerOption(option =>
                    option.setName('tornid')
                        .setDescription('Torn user ID'))
                .addBooleanOption(option =>
                    option.setName('hide')
                        .setDescription('Hide response'))
        )
    ,


    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, true)) return;

        const command = interaction.options.getSubcommand();

        switch (command) {
            case 'history':
                await playerHistory(interaction);
                break;

            case 'hall-of-fame':
                await playerHallOfFame(interaction);
                break;
        }


    },
};

async function playerHistory(interaction) {
    const userID = interaction.options.getInteger('tornid') ?? interaction.user.id;
    const hide = interaction.options.getBoolean('hide') ?? false;

    const days = interaction.options.getInteger('days') ?? 30;

    const thismoment = moment();
    const historymoment = thismoment.subtract(days, 'days');

    const [response, responseHist] = await Promise.all([
        callTornApi('user', 'basic,personalstats,profile', userID, undefined, undefined, undefined, undefined, 'rotate'),
        callTornApi('user', 'basic,personalstats,profile', userID, undefined, undefined, historymoment.unix(), 'networth,refills,xantaken,statenhancersused,useractivity,energydrinkused', 'rotate')
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


        const networthHist = personalstatsHist['networth'];
        const refillsHist = personalstatsHist['refills'];
        const xantakenHist = personalstatsHist['xantaken'];
        const statenhancersusedHist = personalstatsHist['statenhancersused'];
        const energydrinkusedHist = personalstatsHist['energydrinkused'];
        const useractivityHist = personalstatsHist['useractivity'] / 60 / 60;

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


        const last_action = playerHistJson['last_action']['relative'];
        const status = playerHistJson['last_action']['status'];
        const revivable = playerHistJson['revivable'] === 0 ? ':red_circle:' : ':green_circle:';

        let statusIcon = (status === 'Online') ? ':green_circle:' :
            (status === 'Idle') ? ':yellow_circle:' :
                ':black_circle:';

        const networthDiff = networthCur - networthHist;

        if (profileImage !== undefined) {
            iconUrl = profileImage;
        } else {
            printLog(`Profile image not available for ${tornId}`);
        }

        const statsEmbed = initializeEmbed(`${cleanUpString(tornUser)} [${tornId}]`);
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
            { name: 'Cans', hist: energydrinkusedHist, cur: energydrinkusedCur, sign: '+', icon: ':battery:' },
            { name: 'SE used', hist: statenhancersusedHist, cur: statenhancersusedCur, sign: '+', icon: ':boxing_glove:' },
        ];

        for (const stat of statArray) {
            const diff = stat.cur - stat.hist;


            statsEmbed.addFields(
                { name: `${stat.icon} ${stat.name}`, value: `*${stat.sign}${abbreviateNumber(diff / days).toString()} per day*\n\`Current: ${abbreviateNumber(stat.cur).toString()}\nChange: ${stat.sign}${abbreviateNumber(diff).toString()}\`\n\u200B`, inline: true },
            )
        }

        //statsEmbed.addFields({ name: `Personal Stats compared to ${days}d ago`, value: `${replyMsg}`, inline: false });

        await interaction.reply({ embeds: [statsEmbed], ephemeral: hide });
    } else {
        await interaction.reply(`\`\`\`${response[1]}\n${responseHist[1]}\`\`\``);
    }
}

async function playerHallOfFame(interaction) {

    let userID = interaction.options.getInteger('tornid') ?? interaction.user.id;
    const hide = interaction.options.getBoolean('hide') ?? false;

    const hofEmbed = initializeEmbed('Hall of Fame');

    const response = await callTornApi('user', 'hof', userID, undefined, undefined, undefined, undefined, 'rotate', undefined, 'v2');
    if (response[0]) {
        const hofJson = response[2];

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
        } else {
            hofEmbed.setTitle('User Hall of Fame');
        }
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
            { name: `:100: Level`, value: `\`Rank : ${level.rank}\nValue: ${numberWithCommas(level.value)}\`\n\u200B`, inline: true },
            { name: `:ninja: Offences`, value: `\`Rank : ${offences.rank}\nValue: ${numberWithCommas(offences.value)}\`\n\u200B`, inline: true },
            { name: `:bar_chart: Rank`, value: `\`Rank : ${rank.rank}\nValue: ${numberWithCommas(rank.value)}\`\n\u200B`, inline: true },
        )
        //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
        hofEmbed.addFields(
            { name: `:crossed_swords: Attacks`, value: `\`Rank : ${attacks.rank}\nValue: ${numberWithCommas(attacks.value)}\`\n\u200B`, inline: true },
            { name: `:shield: Defends`, value: `\`Rank : ${defends.rank}\nValue: ${numberWithCommas(defends.value)}\`\n\u200B`, inline: true },
            { name: `:oncoming_police_car: Busts`, value: `\`Rank : ${busts.rank}\nValue: ${numberWithCommas(busts.value)}\`\n\u200B`, inline: true },
        )
        //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
        hofEmbed.addFields(
            { name: `:medical_symbol: Revives`, value: `\`Rank : ${revives.rank}\nValue: ${numberWithCommas(revives.value)}\`\n\u200B`, inline: true },
            { name: `:airplane: Travel Time`, value: `\`Rank : ${traveltime.rank}\nValue: ${numberWithCommas(traveltime.value)}\`\n\u200B`, inline: true },
            { name: `:dollar: Networth`, value: `\`Rank : ${networth.rank}\nValue: ${numberWithCommas(networth.value)}\`\n\u200B`, inline: true },
        )
        //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
        hofEmbed.addFields(
            { name: `~~Battle Stats~~`, value: '*hidden*', inline: true },
            { name: `:office_worker: Work Stats`, value: `\`Rank : ${workstats.rank}\nValue: ${numberWithCommas(workstats.value)}\`\n\u200B`, inline: true },
            { name: `:military_medal: Awards`, value: `\`Rank : ${awards.rank}\nValue: ${numberWithCommas(awards.value)}\`\n\u200B`, inline: true },
        )
        //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
        hofEmbed.addFields(
            { name: `:trophy: Racing Wins`, value: `\`Rank : ${racingwins.rank}\nValue: ${numberWithCommas(racingwins.value)}\`\n\u200B`, inline: true },
            { name: `:race_car: Racing Points`, value: `\`Rank : ${racingpoints.rank}\nValue: ${numberWithCommas(racingpoints.value)}\`\n\u200B`, inline: true },
            { name: `:wrench: Racing Skills`, value: `\`Rank : ${racingskill.rank}\nValue: ${numberWithCommas(racingskill.value)}\`\n\u200B`, inline: true },
        )
        //embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
    }


    await interaction.reply({ embeds: [hofEmbed], ephemeral: hide });
}