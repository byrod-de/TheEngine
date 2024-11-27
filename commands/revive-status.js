const { SlashCommandBuilder } = require('discord.js');
const { getFactionReviveStatus, getOwnFactionReviveStatus } = require('../functions/async');
const { verifyRoleAccess, initializeEmbed, getFactionConfigFromChannel, logCommandUser } = require('../helper/misc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revive-status')
        .setDescription('Gets Revive Status! Add a factionid for checking any faction, leave it empty for yours.')
        .addIntegerOption(option =>
            option.setName('factionid')
                .setDescription('Faction ID')
                .setRequired(false)),
                

    async execute(interaction) {

        logCommandUser(interaction);

        const factionData = getFactionConfigFromChannel(interaction) || {};
        const factionId = factionData.id || ''; // Safely extract factionId
        
        if (!factionId) {
            const notificationEmbed = initializeEmbed(`Error 418 - You're a teapot`, 'error');
            notificationEmbed.setDescription(
                `:teapot: Nice try!\nThis command can only be used in a faction-related channel!`
            );
            await interaction.reply({ embeds: [notificationEmbed], ephemeral: true });
            return; // Exit early if no factionId
        }

        const hasRole = await verifyRoleAccess(interaction, factionData);
        if (!hasRole) return;

        const factionToCheck = interaction.options.getInteger('factionid') ?? factionId;

        const message = await interaction.reply({ content: `Executing Revive Status for ${factionToCheck}, please wait...`, ephemeral: false });
        let reviveEmbed = '';

        if (factionToCheck.toString() === factionId.toString()) reviveEmbed = await getOwnFactionReviveStatus(factionToCheck, message);
        else reviveEmbed = await getFactionReviveStatus(factionToCheck, message);

        if (!reviveEmbed) {
            await message.edit({ content: 'Revive status for ' + factionToCheck + ' could not be determined.', ephemeral: false });
            return;
        }
        await message.edit({ content: '',embeds: [reviveEmbed], ephemeral: false });
    },
};
