const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getWarActivity } = require('../functions/async');
const { verifyChannelAccess, readConfig } = require('../helper/misc');

const { homeFaction } = readConfig().apiConf;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('war-activity')
        .setDescription('Gets War activity! Add a factionid for checking any faction, leave it empty for yours.')
        .addIntegerOption(option =>
            option.setName('factionid')
                .setDescription('Faction ID')
                .setRequired(false)),


    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, false)) return;

        const factionID = interaction.options.getInteger('factionid') ?? homeFaction;

        const message = await interaction.reply({ content: `Executing war activity check for ${factionID}, please wait...`, ephemeral: false });

        const warActivityOutput = await getWarActivity(factionID, message);

        if (!warActivityOutput) {
            await interaction.editReply({ content: 'War activity for ' + factionID + ' could not be determined.', ephemeral: false });
            return;
        }
        if (warActivityOutput instanceof EmbedBuilder) {
            await interaction.editReply({ embeds: [warActivityOutput], ephemeral: false });
        } else {
            await interaction.editReply({ content: warActivityOutput, ephemeral: false });
        }
    },
};
