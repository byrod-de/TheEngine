const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { abbreviateNumber } = require('../helper/formattings');
const { getAPIKey, printLog } = require('../helper/misc');

const he = require('he');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('player-history')
        .setDescription('Get a players stat history! Add a tornid for checking another player, leave it empty for yourself.')
        .addIntegerOption(option =>
            option.setName('tornid')
                .setDescription('Torn user ID'))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days')),

    async execute(interaction) {
        const userID = interaction.options.getInteger('tornid') ?? interaction.user.id;
        const days = interaction.options.getInteger('days') ?? 30;

        const thismoment = moment();
        const historymoment = thismoment.subtract(days, 'days');
        const historyDate = historymoment.format().replace('T', ' ');

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
            const useractivityCur = personalstats['useractivity']/60/60;


            const networthHist = personalstatsHist['networth'];
            const refillsHist = personalstatsHist['refills'];
            const xantakenHist = personalstatsHist['xantaken'];
            const statenhancersusedHist = personalstatsHist['statenhancersused'];
            const energydrinkusedHist = personalstatsHist['energydrinkused'];
            const useractivityHist = personalstatsHist['useractivity']/60/60;

            const tornUser = playerHistJson['name'];
            const tornId = playerHistJson['player_id'];
            const profileImage = playerHistJson['profile_image']
            const awards = playerHistJson['awards'];

            const position = playerHistJson['faction']['position'];
            const faction_name = he.decode(playerHistJson['faction']['faction_name']);
            const faction_tag = playerHistJson['faction']['faction_tag'];
            const faction_id = playerHistJson['faction']['faction_id'];
            let iconUrl = 'https://tornengine.netlify.app/images/logo-100x100.png';

            const last_action = playerHistJson['last_action']['relative'];
            const status = playerHistJson['last_action']['status'];
            const revivable = playerHistJson['revivable'] === 0 ? 'false' : 'true';

            const networthDiff = networthCur - networthHist;

            if (profileImage !== undefined) {
                iconUrl = profileImage;
              } else {
                printLog(`Profile image not available for ${tornId}`);
              }

            const statsEmbed = new EmbedBuilder()
                .setColor(0xdf691a)
                .setTitle(`${tornUser} [${tornId}]`)
                .setURL(`https://www.torn.com/profiles.php?XID=${tornId}`)
                .setAuthor({ name: `${position} of ${faction_tag} -  ${faction_name}`, iconURL: iconUrl, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                .setDescription(`Last action: ${last_action}\nStatus: ${status} \nRevivable: ${revivable}\nAwards: ${awards}`)
                .setTimestamp()
                .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

            let replyMsg = 'Stat'.padEnd(7) + ` | ${days}${'d ago'.padEnd(5)} | ${'Today'.padEnd(7)} | ${'Diff'.padEnd(7)} | ${'Daily'.padEnd(7)}\n`;
            replyMsg += '-'.padEnd(9 + 9 + 9 + 9 + 11, '-') + '\n';

            const statArray = [
                { name: 'Activty', hist: useractivityHist, cur: useractivityCur, sign: ' ' },
                { name: 'Xanax', hist: xantakenHist, cur: xantakenCur, sign: ' '  },
                { name: 'SE used', hist: statenhancersusedHist, cur: statenhancersusedCur, sign: ' '  },
                { name: 'Cans', hist: energydrinkusedHist, cur: energydrinkusedCur, sign: ' '  },
                { name: 'Refills', hist: refillsHist, cur: refillsCur, sign: ' '  },
                { name: 'Netwrth', hist: networthHist, cur: networthCur, sign: networthDiff < 0 ? '-' : '+'}
            ];

            for (const stat of statArray) {
                const diff = stat.cur - stat.hist ;
                replyMsg += `${stat.name.padEnd(7)} | ${abbreviateNumber(stat.hist).toString().padStart(7)} | ${abbreviateNumber(stat.cur).toString().padStart(7)} | ${stat.sign}${abbreviateNumber(diff).toString().padStart(6)} | ${stat.sign}${abbreviateNumber(diff / days).toString().padStart(6)}\n`;
            }

            statsEmbed.addFields({ name: 'Personal Stats', value: `\`\`\`${replyMsg}\`\`\``, inline: false });

            await interaction.reply({ embeds: [statsEmbed], ephemeral: false });
        } else {
            await interaction.reply(`\`\`\`${response[1]}\n${responseHist[1]}\`\`\``);
        }
    },
};
