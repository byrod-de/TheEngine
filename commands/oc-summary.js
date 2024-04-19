const { SlashCommandBuilder } = require('discord.js');
const { getOCStats } = require('../functions/async');
const { verifyChannelAccess } = require('../helper/misc');


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
        ),

    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, true)) return;

        var selectedDateValue;

        if (interaction.options.getSubcommand() === 'months') selectedDateValue = interaction.options.getInteger('month');
        if (interaction.options.getSubcommand() === 'last-x-days') selectedDateValue = interaction.options.getInteger('days');

        const ocEmbed = await getOCStats(interaction.options.getSubcommand(), selectedDateValue);


        await interaction.reply({ embeds: [ocEmbed], ephemeral: false });
    },
};
