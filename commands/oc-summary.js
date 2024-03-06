const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { limitedAccessChannelIds, limitedAccessCategories } = require('../conf/config.json');
const { calculateMonthTimestamps, printLog } = require('../helper/misc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oc-stats')
        .setDescription('Gets Organized Crime Stats for your faction! You need to store a key with Minimal Access first.')
        .addIntegerOption(option =>
            option.setName('month')
                .setDescription('Number of months')
                .setChoices(
                    { name: 'Jan', value: 1 },
                    { name: 'Feb', value: 2 },
                    { name: 'Mar', value: 3 },
                    { name: 'Apr', value: 4 },
                    { name: 'May', value: 5 },
                    { name: 'Jun', value: 6 },
                    { name: 'Jul', value: 7 },
                    { name: 'Aug', value: 8 },
                    { name: 'Sep', value: 9 },
                    { name: 'Oct', value: 10 },
                    { name: 'Nov', value: 11 },
                    { name: 'Dec', value: 12 }
                )),

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
                accessList += limitedAccessCategories.map(id => `**<#${id}>**`).join(' or ') + ' category';
            }
            await interaction.reply({ content: `Nice try! This command can only be used in ${accessList}. If you cannot see the channel, you are not meant to use this command :wink:`, ephemeral: true });
            return;
        }


        var today = new Date();
        var firstDayOfMonth, lastDayOfMonth;
        var selectedMonthValue = interaction.options.getInteger('month');
        console.log(selectedMonthValue);
        if (!selectedMonthValue) {
            selectedMonthValue = today.getMonth();
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

        let lastDateFormatted = (new Date(lastDayOfMonth * 1000)).toISOString().replace('T', ' ').replace('.000Z', '');


        const ocEmbed = new EmbedBuilder()
            .setColor(0xdf691a)
            .setTitle(`OC Overview for ${lastDateFormatted.substring(0, 7)}`)
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


        await interaction.reply({ embeds: [ocEmbed], ephemeral: false });
    },
};
