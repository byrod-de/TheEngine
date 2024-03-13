const { SlashCommandBuilder } = require('discord.js');
const { getOCStats } = require('../functions/async');
const { verifyChannelAccess } = require('../helper/misc');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('oc-summary')
        .setDescription('Gets Organized Crime Stats for your faction!')
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

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, true)) return;


        var selectedMonthValue = interaction.options.getInteger('month');

        const ocEmbed = await getOCStats(selectedMonthValue);


        await interaction.reply({ embeds: [ocEmbed], ephemeral: false });
    },
};
