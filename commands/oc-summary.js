const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { limitedAccessChannelIds, limitedAccessCategories } = require('../conf/config.json');
const { getOCStats } = require('../functions/async');

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


        var selectedMonthValue = interaction.options.getInteger('month');

        const ocEmbed = await getOCStats(selectedMonthValue);


        await interaction.reply({ embeds: [ocEmbed], ephemeral: false });
    },
};
