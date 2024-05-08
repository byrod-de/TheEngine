const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('node:fs');
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
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('export')
                .setDescription('Export as csv')),


    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, false)) return;

        const factionID = interaction.options.getInteger('factionid') ?? homeFaction;
        const exportCSV = interaction.options.getBoolean('export') ?? false;


        const message = await interaction.reply({ content: `Executing war activity check for ${factionID}, please wait...`, ephemeral: false });

        const warActivityOutput = await getWarActivity(factionID, message, exportCSV);

        if (!warActivityOutput) {
            await interaction.editReply({ content: 'War activity for ' + factionID + ' could not be determined.', ephemeral: false });
            return;
        }

            await interaction.editReply({ embeds: [warActivityOutput.embed], ephemeral: false });

        if (warActivityOutput.csvFilePath) {
            const attachment = new AttachmentBuilder(warActivityOutput.csvFilePath);
            await interaction.followUp({ files: [attachment] });


            console.log(`CSV file exported to ${warActivityOutput.csvFilePath}`);
        }
    },
};
