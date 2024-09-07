const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('node:fs');

const { getMemberContributions } = require('../functions/async');
const { callTornApi } = require('../functions/api');
const { importCsvToSheet } = require('../functions/google');

const { verifyChannelAccess, readConfig, initializeEmbed } = require('../helper/misc');
const { capitalize, formatTornDate } = require('../helper/formattings');

const { adminChannelId } = readConfig().limitedAccessConf;

const contributions = require('../conf/tornParams.json').contributions;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('faction-contributions')
        .setDescription('Gets member contributions for your faction!')
        .addStringOption(option =>
            option.setName('selection')
                .setDescription('Select the data you want to request')
                .setRequired(true)
                .addChoices(
                    ...contributions.map(cont => ({ name: capitalize(cont), value: cont }))
                )
        )
        .addBooleanOption(option =>
            option.setName('export')
                .setDescription('Export as csv')
                .setRequired(false))
    ,

    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, true)) return;

        const command = interaction.options.getString('selection');
        const commandArray = [];
        commandArray.push(command);
        
        console.log(commandArray);
        const exportData = interaction.options.getBoolean('export') ?? false;

        const contributionsFilename = await getMemberContributions(commandArray);

        const memberResponse = await callTornApi('faction', 'basic,timestamp', undefined, undefined, undefined, undefined, undefined, 'rotate', undefined, undefined);
        let membersList;
        if (memberResponse[0]) {
            const factionJson = memberResponse[2];
            membersList = factionJson['members'];
        }


        const embed = initializeEmbed('Contributions');
        embed.addFields({ name: `Status`, value: `Contributions for ${command} pulled. ${contributionsFilename}`, inline: false });

        await interaction.reply({ embeds: [embed], ephemeral: false });

        if (exportData && contributionsFilename !== '') {
            if (interaction.channelId != adminChannelId) {
                interaction.followUp({ content: `The export can only be used in the admin <#${adminChannelId}> channel.`, ephemeral: true });
                return;
            }
            const contributionsFile = fs.readFileSync(contributionsFilename, 'utf-8');
            const contributionsJson = JSON.parse(contributionsFile);

            const csvData = [];
            csvData.push(`Member Name;ID;Value;Category`);
            for (var id in contributionsJson) {

                const memberContribution = contributionsJson[id];
                const memberName = membersList[id].name;
                const value = memberContribution.contributed;

                csvData.push(`${memberName};${id};${value};${command}`);
            }

            const timestamp = contributionsFilename.match(/_(\d+)\.json$/)[1];

            const csvFilePath = contributionsFilename.replace('.json', '.csv').replace(timestamp, formatTornDate(timestamp)).replaceAll(':', '-').replaceAll('+00-00', '');

            fs.writeFileSync(csvFilePath, csvData.join('\n'), 'utf-8');
    
            const attachment = new AttachmentBuilder(csvFilePath);
            await interaction.followUp({ files: [attachment], ephemeral: true });

            await importCsvToSheet(csvFilePath);
        }


    },
};
