const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { apiKey, comment } = require('../config.json');
const moment = require('moment');
var formatting = require('../helper/formattings');



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
        let currentDate = thismoment.format().replace('T', ' ');
        let historymoment = thismoment.subtract(30, 'days');
        let historyDate = historymoment.format().replace('T', ' ');


        console.log(`${currentDate} > ${currentStatsURL}`);

        let currentStatsResponse = await fetch(currentStatsURL);


        if (currentStatsResponse.ok) { // if HTTP-status is 200-299

            let playerJson = await currentStatsResponse.json();

            let networthCur = '';
            let refillsCur = '';
            let xantakenCur = '';
            let statenhancersusedCur = '';

            if (playerJson.hasOwnProperty('error')) {
                await interaction.reply(`\`\`\`Error Code ${playerJson['error'].code},  ${playerJson['error'].error}.\`\`\``)
            } else {
                let personalstats = playerJson['personalstats'];

                networthCur = personalstats['networth'];
                refillsCur = personalstats['refills'];
                xantakenCur = personalstats['xantaken'];
                statenhancersusedCur = personalstats['statenhancersused'];



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
                        let position = playerJson['faction']['position'];
                        let faction_name = playerJson['faction']['faction_name'];
                        let faction_tag = playerJson['faction']['faction_tag'];
                        let faction_id = playerJson['faction']['faction_id'];

                        let last_action = playerJson['last_action']['relative'];
                        let status = playerJson['last_action']['status'];
                        let revivable = playerJson['revivable'];
                        if (revivable == 0) revivable = 'false';
                        else revivable = 'true';


                        let networthHist = personalstats['networth'];
                        let refillsHist = personalstats['refills'];
                        let xantakenHist = personalstats['xantaken'];
                        let statenhancersusedHist = personalstats['statenhancersused'];

                        let statsEmbed = new EmbedBuilder()
                        .setColor(0xdf691a)
                        .setTitle(`${tornUser} [${tornId}]`)
                        .setURL(`https://www.torn.com/profiles.php?XID=${tornId}`)
                        .setAuthor({name:`${position} of ${faction_tag} -  ${faction_name}`, url:`https://www.torn.com/factions.php?step=profile&ID=${faction_id}`})
                        .setDescription(`Last action: ${last_action}\nStatus: ${status} \nRevivable: ${revivable}`)
                        .setTimestamp()
                        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                        replyMsg = ``;
                        replyMsg = replyMsg + 'Stat'.padEnd(7);
                        replyMsg = replyMsg + ` | ${'30d ago'.padEnd(7)}`;
                        replyMsg = replyMsg + ` | ${'Today'.padEnd(7)}`;
                        replyMsg = replyMsg + ` | ${'Diff'.padEnd(7)}`;
                        replyMsg = replyMsg + ` | ${'Daily'.padEnd(7)}`;
                        replyMsg = replyMsg + '\n';
                        replyMsg = replyMsg + '-'.padEnd(9 + 9 + 9 + 9 + 11, '-');
                        replyMsg = replyMsg + '\n';

                        replyMsg = replyMsg + 'Xanax'.padEnd(7) + ` | ${formatting.abbreviateNumber(xantakenHist).padStart(7)}`;
                        replyMsg = replyMsg + ` | ${formatting.abbreviateNumber(xantakenCur).padStart(7)}`;
                        replyMsg = replyMsg + ` | +${formatting.abbreviateNumber(xantakenCur - xantakenHist).toString().padStart(6)}`;
                        replyMsg = replyMsg + ` | +${formatting.abbreviateNumber((xantakenCur - xantakenHist) / 30).toString().padStart(6)}`;
                        replyMsg = replyMsg + '\n';
                        replyMsg = replyMsg + 'SE used'.padEnd(7) + ` | ${formatting.abbreviateNumber(statenhancersusedHist).toString().padStart(7)}`;
                        replyMsg = replyMsg + ` | ${formatting.abbreviateNumber(statenhancersusedCur).toString().padStart(7)}`;
                        replyMsg = replyMsg + ` | +${formatting.abbreviateNumber(statenhancersusedCur - statenhancersusedHist).toString().padStart(6)}`;
                        replyMsg = replyMsg + ` | +${formatting.abbreviateNumber((statenhancersusedCur - statenhancersusedHist) / 30).toString().padStart(6)}`;
                        replyMsg = replyMsg + '\n';
                        replyMsg = replyMsg + 'Refills'.padEnd(7) + ` | ${formatting.abbreviateNumber(refillsHist).toString().padStart(7)}`;
                        replyMsg = replyMsg + ` | ${formatting.abbreviateNumber(refillsCur).toString().padStart(7)}`;
                        replyMsg = replyMsg + ` | +${formatting.abbreviateNumber(refillsCur - refillsHist).toString().padStart(6)}`;
                        replyMsg = replyMsg + ` | +${formatting.abbreviateNumber((refillsCur - refillsHist) / 30).toString().padStart(6)}`;
                        replyMsg = replyMsg + '\n';
                        replyMsg = replyMsg + 'Netwrth'.padEnd(7) + ` | ${formatting.abbreviateNumber(networthHist).toString().padStart(7)}`;
                        replyMsg = replyMsg + ` | ${formatting.abbreviateNumber(networthCur).toString().padStart(7)}`;
                        let networthDiff = networthCur - networthHist;
                        let sign = '+';
                        if (networthDiff < 0) sign = '-';
                        replyMsg = replyMsg + ` | ${sign}${formatting.abbreviateNumber(networthDiff).toString().padStart(6)}`;
                        replyMsg = replyMsg + ` | ${sign}${formatting.abbreviateNumber(networthDiff / 30).toString().padStart(6)}`;

                        statsEmbed.addFields({name: 'Personal Stats', value:`\`\`\`${replyMsg}\`\`\``, inline: false});

                        await interaction.reply({ embeds: [statsEmbed], ephemeral: false });

                    }
                } else {
                    await interaction.reply(`\`\`\`${replyMsg}\`\`\``);
                }
            }
        } else {
            await interaction.reply(`\`\`\`${replyMsg}\`\`\``);
        }
    },
};
