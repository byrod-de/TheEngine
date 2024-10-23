const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { memberInformation } = require('../functions/async');
const { verifyChannelAccess, readConfig } = require('../helper/misc');

const { homeFaction } = readConfig().apiConf;

const moment = require('moment');

const options = [
    { label: 'Warring Stats', description: 'Get warring stats', value: 'warring', selection: 'rankedwarhits,raidhits,territoryclears,territoryjoins,rankedwarhits,rankedwarringwins,respectforfaction,attacksassisted,attackswon,retals' },
    { label: 'Activity Stats', description: 'Get activity stats', value: 'activity', selection: 'networth,refills,xantaken,statenhancersused,useractivity,energydrinkused' },
];


module.exports = {
    data: new SlashCommandBuilder()
        .setName('member-stalker')
        .setDescription('Request data for a specific date and selection')
        .addStringOption(option =>
            option.setName('selection')
                .setDescription('Select the data you want to request')
                .setRequired(true)
                .addChoices(
                    ...options.map(opt => ({ name: opt.label, value: opt.value }))
                )
        )
        .addIntegerOption(option =>
            option.setName('factionid')
                .setDescription('Faction ID')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Enter the date in YYYY-MM-DD format')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('export')
                .setDescription('Export as csv')
                .setRequired(false))
    ,

    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, false)) return;

        const dateInput = interaction.options.getString('date') || moment().subtract(1, 'days').format('YYYY-MM-DD');
        const selectedOptionValue = interaction.options.getString('selection');
        const factionID = interaction.options.getInteger('factionid') ?? homeFaction;
        const exportCSV = interaction.options.getBoolean('export') ?? false;

        const selectedOption = options.find(option => option.value === selectedOptionValue);
        const apiSelection = selectedOption.selection;

        const inputDate = moment(dateInput, 'YYYY-MM-DD', true);
        const currentDate = moment();
        console.log(`Input date: ${inputDate}, Current date: ${currentDate}`);

        if (!inputDate.isValid() || inputDate.isAfter(moment(), 'day')) {
            return interaction.reply('Invalid date. Please enter a date in the past in the format YYYY-MM-DD.');
        }

        const startDateTimestamp = inputDate.startOf('day').unix();
        const endDateTimestamp = currentDate.endOf('day').unix();

        const message = await interaction.reply({ content: `Executing member activity check for ${apiSelection}, please wait...`, ephemeral: false });

        const memberOutput = await memberInformation(factionID, apiSelection, message, startDateTimestamp, endDateTimestamp, exportCSV);

        if (!memberOutput) {
            await interaction.editReply({ content: 'War activity for ' + factionID + ' could not be determined.', ephemeral: false });
            return;
        }

        await interaction.editReply({ embeds: [memberOutput.embed], ephemeral: false });

        if (memberOutput.csvFilePath) {
            const attachment = new AttachmentBuilder(memberOutput.csvFilePath);
            await interaction.followUp({ files: [attachment] });

            console.log(`CSV file exported to ${memberOutput.csvFilePath}`);
        }

    },
};
