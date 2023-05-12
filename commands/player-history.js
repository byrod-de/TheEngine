const { SlashCommandBuilder } = require('discord.js');
const { apiKey, comment, verifieRoleId } = require('../config.json');
const moment = require('moment');



module.exports = {
    data: new SlashCommandBuilder()
        .setName('player-history')
        .setDescription('Get a players stat history! Add a tornid for checking another player, leave it empty for yourself.')
        .addIntegerOption(option =>
            option.setName('tornid')
                .setDescription('Torn user ID.')),

    async execute(interaction) {

        const userID = interaction.options.getInteger('tornid') ?? interaction.user.id;

        let replyMsg = `Let's try this...`;

        let currentStatsURL = `https://api.torn.com/user/${userID}?selections=basic,personalstats,profile&key=${apiKey}&comment=${comment}`;
        let thismoment = moment();
        let currentDate = thismoment.format().replace('T',' ');
        let historymoment = thismoment.subtract(30, 'days');
        let historyDate = historymoment.format().replace('T',' ');


        console.log(`${currentDate} > ${currentStatsURL}`);

        let currentStatsResponse = await fetch(currentStatsURL);


        if (currentStatsResponse.ok) { // if HTTP-status is 200-299

            let playerJson = await currentStatsResponse.json();

            let networthCur = '';
            let refillsCur = '';
            let xantakenCur = '';
            let statenhancersusedCur = '';
            let useractivityCur = '';

            if (playerJson.hasOwnProperty('error')) {
                await interaction.reply(`\`\`\`Error Code ${playerJson['error'].code},  ${playerJson['error'].error}.\`\`\``)
            } else {

                let tornUser = playerJson['name'];
                let tornId = playerJson['player_id'];

                let personalstats = playerJson['personalstats'];
                let faction_id = playerJson['faction']['faction_id'];
                let faction_name = playerJson['faction']['faction_name'];
                let faction_tag = playerJson['faction']['faction_tag'];

                networthCur = personalstats['networth'];
                refillsCur = personalstats['refills'];
                xantakenCur = personalstats['xantaken'];
                statenhancersusedCur = personalstats['statenhancersused'];
                useractivityCur = personalstats['useractivity'];
            }


            let histStatsURL = `https://api.torn.com/user/${userID}?selections=basic,personalstats,profile&stat=networth,refills,xantaken,statenhancersused,useractivity&timestamp=${historymoment.unix()}&key=${apiKey}&comment=${comment}`;
            console.log(`${historyDate} > ${histStatsURL}`);

            let histStatsResponse = await fetch(histStatsURL);


            if (histStatsResponse.ok) { // if HTTP-status is 200-299

                let playerJson = await histStatsResponse.json();

                if (playerJson.hasOwnProperty('error')) {
                    await interaction.reply(`\`\`\`Error Code ${playerJson['error'].code},  ${playerJson['error'].error}.\`\`\``)
                } else {

                    let tornUser = playerJson['name'];
                    let tornId = playerJson['player_id'];

                    let personalstats = playerJson['personalstats'];
                    let faction_id = playerJson['faction']['faction_id'];
                    let faction_name = playerJson['faction']['faction_name'];
                    let faction_tag = playerJson['faction']['faction_tag'];

                    let networthHist = personalstats['networth'];
                    let refillsHist = personalstats['refills'];
                    let xantakenHist = personalstats['xantaken'];
                    let statenhancersusedHist = personalstats['statenhancersused'];
                    let useractivityHist = personalstats['useractivity'];
                    
                    replyMsg = `${faction_tag} ${tornUser} [${tornId}] of ${faction_name} \n`;
                    replyMsg = replyMsg + 'Stat'.padEnd(14);
                    replyMsg = replyMsg + `| ${'30 days ago'.padEnd(13)}`;
                    replyMsg = replyMsg + ` | ${'Today'.padEnd(13)}`;
                    replyMsg = replyMsg + ` | ${'Diff'.padEnd(5)}`;
                    replyMsg = replyMsg + '\n';
                    replyMsg = replyMsg + '-'.padEnd(12+14+12+5+12,'-');
                    replyMsg = replyMsg + '\n';

                    replyMsg = replyMsg + 'Xanax'.padEnd(14)         + `| ${xantakenHist.toString().padStart(13)}`;
                    replyMsg = replyMsg + ` | ${xantakenCur.toString().padStart(13)}`;
                    replyMsg = replyMsg + ` | + ${(xantakenCur-xantakenHist).toString().padEnd(3)}`;
                    replyMsg = replyMsg + '\n';
                    replyMsg = replyMsg + 'Stat Enhancer'.padEnd(14) + `| ${statenhancersusedHist.toString().padStart(13)}`;
                    replyMsg = replyMsg + ` | ${statenhancersusedCur.toString().padStart(13)}`;
                    replyMsg = replyMsg + ` | + ${(statenhancersusedCur-statenhancersusedHist).toString().padEnd(3)}`;
                    replyMsg = replyMsg + '\n';
                    replyMsg = replyMsg + 'Refills'.padEnd(14)       + `| ${refillsHist.toString().padStart(13)}`;
                    replyMsg = replyMsg + ` | ${refillsCur.toString().padStart(13)}`;
                    replyMsg = replyMsg + ` | + ${(refillsCur-refillsHist).toString().padEnd(3)}`;
                    replyMsg = replyMsg + '\n';
                    replyMsg = replyMsg + 'Networth'.padEnd(14)      + `| \$${networthHist.toString().padEnd(12)}`;
                    replyMsg = replyMsg + ` | \$${networthCur.toString().padEnd(12)}`;
                    let networthDiff = networthCur-networthHist;
                    let sign = '+ ';
                    if (networthDiff < 0) sign = '';
                    replyMsg = replyMsg + ` | ${sign}\$${networthDiff.toString().padEnd(3)}`;

                }

                await interaction.reply(`\`\`\`${replyMsg}\`\`\``);
            }
        }
    },
};
