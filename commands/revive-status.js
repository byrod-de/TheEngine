const { SlashCommandBuilder } = require('discord.js');
const { getFactionReviveStatus, getOwnFactionReviveStatus } = require('../functions/async');
const { verifyChannelAccess, readConfig } = require('../helper/misc');

const { homeFaction } = readConfig().apiConf;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revive-status')
        .setDescription('Gets Revive Status! Add a factionid for checking any faction, leave it empty for yours.')
        .addIntegerOption(option =>
            option.setName('factionid')
                .setDescription('Faction ID')
                .setRequired(false)),
                

    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, false)) return;

        const factionID = interaction.options.getInteger('factionid') ?? homeFaction;

        const message = await interaction.reply({ content: `Executing Revive Status for ${factionID}, please wait...`, ephemeral: false });
        let reviveEmbed = '';

        if (factionID.toString() === homeFaction) reviveEmbed = await getOwnFactionReviveStatus(factionID, message);
        else reviveEmbed = await getFactionReviveStatus(factionID, message);

        if (!reviveEmbed) {
            await message.edit({ content: 'Revive status for ' + factionID + ' could not be determined.', ephemeral: false });
            return;
        }
        await message.edit({ content: '',embeds: [reviveEmbed], ephemeral: false });
    },
};
