const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');

const { abbreviateNumber } = require('../helper/formattings');
const { getAPIKey, printLog } = require('../helper/misc');

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

        let thismoment = moment();

        let historymoment = thismoment.subtract(30, 'days');
        let historyDate = historymoment.format().replace('T', ' ');

        let replyMsg = `Let's try this...`;

        printLog(getAPIKey(userID));

        let response = await callTornApi('user', 'basic,personalstats,profile', userID);

        if (response[0]) {
            let playerJson = response[2];

            let networthCur = '';
            let refillsCur = '';
            let xantakenCur = '';
            let statenhancersusedCur = '';


            let personalstats = playerJson['personalstats'];

            networthCur = personalstats['networth'];
            refillsCur = personalstats['refills'];
            xantakenCur = personalstats['xantaken'];
            statenhancersusedCur = personalstats['statenhancersused'];


            let responseHist = await callTornApi('user', 'basic,personalstats,profile', userID, '', '', historymoment.unix(), 'networth,refills,xantaken,statenhancersused,useractivity');

            if (responseHist[0]) {
                let playerJson = responseHist[2];

                let tornUser = playerJson['name'];
                let tornId = playerJson['player_id'];

                let personalstats = playerJson['personalstats'];
                let position = playerJson['faction']['position'];
                let faction_name = playerJson['faction']['faction_name'];
                let faction_tag = playerJson['faction']['faction_tag'];
                let faction_id = playerJson['faction']['faction_id'];

                let faction_icon = 'https://tornengine.netlify.app/images/logo-100x100.png';

                if (faction_id != 0) {
                    let responseFaction = await callTornApi('faction', 'basic', faction_id);

                    if (responseFaction[0]) {
                        let factionJson = responseFaction[2];
                        faction_icon = `https://factiontags.torn.com/` + factionJson['tag_image'];
                    }
                }

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
                    .setAuthor({ name: `${position} of ${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
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

                replyMsg = replyMsg + 'Xanax'.padEnd(7) + ` | ${abbreviateNumber(xantakenHist).padStart(7)}`;
                replyMsg = replyMsg + ` | ${abbreviateNumber(xantakenCur).padStart(7)}`;
                replyMsg = replyMsg + ` | +${abbreviateNumber(xantakenCur - xantakenHist).toString().padStart(6)}`;
                replyMsg = replyMsg + ` | +${abbreviateNumber((xantakenCur - xantakenHist) / 30).toString().padStart(6)}`;
                replyMsg = replyMsg + '\n';
                replyMsg = replyMsg + 'SE used'.padEnd(7) + ` | ${abbreviateNumber(statenhancersusedHist).toString().padStart(7)}`;
                replyMsg = replyMsg + ` | ${abbreviateNumber(statenhancersusedCur).toString().padStart(7)}`;
                replyMsg = replyMsg + ` | +${abbreviateNumber(statenhancersusedCur - statenhancersusedHist).toString().padStart(6)}`;
                replyMsg = replyMsg + ` | +${abbreviateNumber((statenhancersusedCur - statenhancersusedHist) / 30).toString().padStart(6)}`;
                replyMsg = replyMsg + '\n';
                replyMsg = replyMsg + 'Refills'.padEnd(7) + ` | ${abbreviateNumber(refillsHist).toString().padStart(7)}`;
                replyMsg = replyMsg + ` | ${abbreviateNumber(refillsCur).toString().padStart(7)}`;
                replyMsg = replyMsg + ` | +${abbreviateNumber(refillsCur - refillsHist).toString().padStart(6)}`;
                replyMsg = replyMsg + ` | +${abbreviateNumber((refillsCur - refillsHist) / 30).toString().padStart(6)}`;
                replyMsg = replyMsg + '\n';
                replyMsg = replyMsg + 'Netwrth'.padEnd(7) + ` | ${abbreviateNumber(networthHist).toString().padStart(7)}`;
                replyMsg = replyMsg + ` | ${abbreviateNumber(networthCur).toString().padStart(7)}`;
                let networthDiff = networthCur - networthHist;
                let sign = '+';
                if (networthDiff < 0) sign = '-';
                replyMsg = replyMsg + ` | ${sign}${abbreviateNumber(networthDiff).toString().padStart(6)}`;
                replyMsg = replyMsg + ` | ${sign}${abbreviateNumber(networthDiff / 30).toString().padStart(6)}`;

                statsEmbed.addFields({ name: 'Personal Stats', value: `\`\`\`${replyMsg}\`\`\``, inline: false });

                await interaction.reply({ embeds: [statsEmbed], ephemeral: false });

            } else {
                await interaction.reply(`\`\`\`${responseHist[1]}\`\`\``);
            }

        } else {
            await interaction.reply(`\`\`\`${response[1]}\`\`\``);
        }
    },
};
