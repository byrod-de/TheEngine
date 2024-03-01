const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { abbreviateNumber } = require('../helper/formattings');
const { printLog } = require('../helper/misc');
const { limitedAccessChannelIds, limitedAccessCategories } = require('../conf/config.json');


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
        if (!limitedAccessChannelIds.includes(interaction.channelId) && !limitedAccessCategories.includes(interaction.channel.parentId)) {
            
            let accessList = '';

            if (limitedAccessChannelIds.length > 0) {
              accessList = limitedAccessChannelIds.map(id => `<#${id}>`).join(' or ');
            }
            
            if (limitedAccessCategories.length > 0) {
              if (accessList) {
                accessList += ' or the ';
              } 
              accessList += limitedAccessCategories.map(id => `<#${id}>`).join(' or ') + ' category';
            }
            await interaction.reply({ content: `Nice try! This command can only be used in ${accessList}. If you cannot see the channel, you are not meant to use this command :wink:`, ephemeral: true });
            return;
        }

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
            const revivable = playerHistJson['revivable'] === 0 ? 'not revivable' : 'revivable';

            let statusIcon = (status === 'Online') ? ':green_circle:' :
              (status === 'Idle') ? ':yellow_circle:' :
              ':black_circle:';

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
                .setTimestamp()
                .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

            let replyMsg = 'Stat'.padEnd(7) + ` | ${days}${'d ago'.padEnd(5)} | ${'Today'.padEnd(7)} | ${'Diff'.padEnd(7)} | ${'Daily'.padEnd(7)}\n`;
            replyMsg += '-'.padEnd(9 + 9 + 9 + 9 + 11, '-') + '\n';

            replyMsg = '';

            //statsEmbed.addFields({ name: 'Last Activity', value: `${statusIcon} ${status}\n${last_action}`, inline: true });
            statsEmbed.addFields({ name: 'Info', value: `${revivable}\n${awards} Awards`, inline: true });

            const statArray = [
                { name: 'Activity', hist: useractivityHist, cur: useractivityCur, sign: '+', icon: ':hourglass:' },
                { name: 'Xanax', hist: xantakenHist, cur: xantakenCur, sign: '+', icon: ':pill:' },
                { name: 'SE used', hist: statenhancersusedHist, cur: statenhancersusedCur, sign: '+', icon: ':boxing_glove:' },
                { name: 'Cans', hist: energydrinkusedHist, cur: energydrinkusedCur, sign: '+', icon: ':canned_food:' },
                { name: 'Refills', hist: refillsHist, cur: refillsCur, sign: '+', icon: ':recycle:' },
                { name: 'Networth', hist: networthHist, cur: networthCur, sign: networthDiff < 0 ? '-' : '+', icon: ':dollar:' },
            ];

            for (const stat of statArray) {
                const diff = stat.cur - stat.hist;
                replyMsg += `${stat.icon} **${stat.name}**: `;
                replyMsg += `*(${stat.sign}${abbreviateNumber(diff / days).toString()} per day)* \n`;

                replyMsg += `\`Current: ${abbreviateNumber(stat.cur).toString()}\`\n`;
                replyMsg += `\`Change : ${stat.sign}${abbreviateNumber(diff).toString()}\`\n`;

            }

            statsEmbed.addFields({ name: `Personal Stats compared to ${days}d ago`, value: `${replyMsg}`, inline: false });

            await interaction.reply({ embeds: [statsEmbed], ephemeral: false });
        } else {
            await interaction.reply(`\`\`\`${response[1]}\n${responseHist[1]}\`\`\``);
        }
    },
};
