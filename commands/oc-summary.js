const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getOCStats } = require('../functions/async');
const { verifyChannelAccess, readConfig } = require('../helper/misc');

const { adminChannelId } = readConfig().limitedAccessConf;


module.exports = {
    data: new SlashCommandBuilder()
        .setName('oc-summary')
        .setDescription('Gets Organized Crime Stats for your faction!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('months')
                .setDescription('Get stats for a specific month.')
                .addIntegerOption(option =>
                    option.setName('month')
                        .setDescription('Select the month')
                        .setRequired(true)
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
                        )
                )
                .addBooleanOption(option =>
                    option.setName('export')
                        .setDescription('Export CSV')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('last-x-days')
                .setDescription('Get stats for the last X days.')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Enter the number of days')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('export')
                        .setDescription('Export CSV')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, true)) return;

        const command = interaction.options.getSubcommand();
        const exportData = interaction.options.getBoolean('export') ?? false;


        var selectedDateValue;

        if (command === 'months') selectedDateValue = interaction.options.getInteger('month');
        if (command === 'last-x-days') selectedDateValue = interaction.options.getInteger('days');

        const ocData = await getOCStats(interaction.options.getSubcommand(), selectedDateValue, exportData);

        await interaction.reply({ embeds: [ocData.embed], ephemeral: false });

        if (exportData) {
            if (interaction.channelId != adminChannelId) {
                interaction.followUp({ content: `The export can only be used in the admin <#${adminChannelId}> channel.`, ephemeral: true });
                return;
            }
            const attachment = new AttachmentBuilder(ocData.csvFilePath);
            await interaction.followUp({ files: [attachment], ephemeral: true });
        }

    },
};
