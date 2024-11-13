const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('node:fs');

const { callTornApi } = require('../functions/api');
const { verifyChannelAccess, readConfig, initializeEmbed, printLog } = require('../helper/misc');

const { formatTornDate } = require('../helper/formattings');

const { homeFaction } = readConfig().apiConf;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('faction-rw-report')
        .setDescription('Gets the faction RW report!'),


    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, false)) return;

        interaction.reply('Getting faction RW reports...');

        const selectDropdown = new StringSelectMenuBuilder()
            .setCustomId('ranked_wars_dropdown')
            .setPlaceholder('Select report for one of the last 10 wars!');


        const rwResponse = await callTornApi('faction', 'rankedwars,basic', undefined, undefined, undefined, undefined, undefined, 'rotate', undefined, undefined);

        if (rwResponse[0]) {

            const factionJson = rwResponse[2];
            const rankedWars = factionJson['rankedwars'];

            let selectEntriesArray = [];
            const rwSummary = {};

            for (const rwId in rankedWars) {
                const factions = rankedWars[rwId]['factions'];
                const war = rankedWars[rwId]['war'];
                const startDay = formatTornDate(war['start']).split(' ')[0];
                const warYear = formatTornDate(war['start']).split('-')[0];

                if (!rwSummary[warYear]) {
                    rwSummary[warYear] = {
                        total: 0,
                        lost: 0,
                        won: 0
                    };
                }

                if (war.winner.toString() === homeFaction) {
                    rwSummary[warYear].won++;
                    rwSummary[warYear].total++;
                } else {
                    rwSummary[warYear].lost++;
                    rwSummary[warYear].total++;
                }

                let entry = `${rwId}|${startDay}`;
                let ownFaction = '';
                let opponentFaction = '';
                for (const factionId in factions) {
                    const faction = factions[factionId];
                    const factionName = faction['name'];

                    if (factionId === homeFaction)
                        ownFaction = `${factionName} [${factionId}]`;
                    else
                        opponentFaction = `${factionName} [${factionId}]`;
                }

                entry += ` - ${ownFaction} vs ${opponentFaction}`;

                selectEntriesArray.unshift(entry);
            }

            var entryCount = 0;
            const entriesLimit = 10;

            const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson;

            const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;

            const rwReportEmbed = initializeEmbed('Faction RW History - ' + faction_name);
            rwReportEmbed.setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${faction_id}` });

            for (const year in rwSummary) {
                const { total, won, lost } = rwSummary[year];
                const successRate = (won / total) * 100;
                printLog(year + " " + total + " " + successRate.toFixed(2) + "%");
                rwReportEmbed.addFields({ name: year, value: `:blue_circle: \`${'Total'.padEnd(12, ' ')}:\` ${total}\n:green_circle: \`${'Won'.padEnd(12, ' ')}:\` ${won}\n:red_circle: \`${'Lost'.padEnd(12, ' ')}:\` ${lost}\n:chart_with_upwards_trend: \`${'Success rate'.padEnd(12, ' ')}:\` **${successRate.toFixed(2)}%**`, inline: true });
            }

            const options = [];
            for (const entryString of selectEntriesArray) {
                const [rwId, entry] = entryString.split('|');
                const option = {
                    label: entry,    // Label for the dropdown option
                    value: rwId      // Value for the dropdown option
                };

                options.push(option);
                entryCount++;

                if (entryCount <= entriesLimit) selectDropdown.addOptions({ label: entry, value: rwId });
            }

            const row = new ActionRowBuilder().addComponents(selectDropdown);
            const message = await interaction.editReply({ embeds: [rwReportEmbed], components: [row], ephemeral: false })


            // Add a collector for the select menu interaction
            const filter = i => i.customId === 'ranked_wars_dropdown' && i.user.id === interaction.user.id;

            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                const selectedValue = i.values[0];  // Gets the selected value
                const selectedOption = options.find(option => option.value === selectedValue); // Find corresponding label

                console.log('Selected ranked war ID:', selectedValue);
                console.log('Selected label:', selectedOption.label);  // Log the label


                await i.update({
                    content: `You selected ranked war: ${selectedValue} - ${selectedOption.label}`,
                    components: [], // Optionally remove the dropdown after selection
                });

                const csv = await getRankedWarDetails(selectedValue);
                const fileName = `./exports/rw_report_${homeFaction}_${selectedValue}.csv`;

                fs.writeFileSync(fileName, csv);
                const attachment = new AttachmentBuilder(fileName);

                await i.followUp({ files: [attachment], ephemeral: true  });

            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({
                        content: 'You did not select a ranked war in time.',
                        components: [],  // Remove the dropdown if no selection was made
                    });
                }
            });

        }
    },
};

async function getRankedWarDetails(rwId) {

    const rwResponse = await callTornApi('torn', 'rankedwarreport', rwId, undefined, undefined, undefined, undefined, 'rotate');

    if (rwResponse[0]) {
        const rankedWarJson = rwResponse[2];
        const rankedwarreport = rankedWarJson['rankedwarreport'];
        const factions = rankedwarreport['factions'];


        for (const factionId in factions) {
            if (factionId === homeFaction) {
                const members = factions[factionId].members;
                var entry = 'Name;ID;Level;Attacks;Score\n';

                for (const memberId in members) {
                    entry += `${members[memberId].name};${memberId};${members[memberId].level};${members[memberId].attacks};${members[memberId].score}\n`;
                }

                //console.log(factions);
                return entry;
            }
        }
    }
}
