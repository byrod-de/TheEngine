const { SlashCommandBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { verifyRoleAccess, initializeEmbed, getFactionConfigFromChannel } = require('../helper/misc');
const { cleanUpString } = require('../helper/formattings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crimeexp')
        .setDescription('Gets CE Ranking for your faction!'),

    async execute(interaction) {

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
        
        const hasRole = true //await verifyRoleAccess(interaction, factionData);
        if (!hasRole) return;

        const response = await callTornApi('faction', 'basic,crimeexp,crimes,timestamp', factionId, undefined, undefined, undefined, undefined, 'default', undefined, undefined, undefined, factionId);

        if (!response[0]) {
            await interaction.reply({ content: response[1], ephemeral: true });
            return;
        }

        const factionJson = response[2];

        const members = factionJson?.members || [];
        const crimeexp = factionJson?.crimeexp || [];
        const crimes = factionJson?.crimes || [];

        const crimeParticipants = [];

        let numberOfPAs = 0;
        for (const id in crimes) {
            const crime = crimes[id];

            if (crime.crime_id === 8) {
                if (crime.initiated === 0) {
                    crime.participants.forEach(participant => {
                        crimeParticipants.push(Object.keys(participant)[0]);
                    });
                    numberOfPAs++;
                }
            }
        }

        if (members.length === 0) {
            await interaction.reply({ content: 'No members found!', ephemeral: false });
            return;
        }

        const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson;

        const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;


        const ceEmbed = initializeEmbed('Crime Experience', 'overwrite', factionData.embedColor);
        ceEmbed.setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${faction_id}` })
            .setDescription('Faction members ordered by crime experience.\n*Members printed in italic are currently not in a PA.*\n*The faction has currently ' + numberOfPAs + ' active PA teams.*');

        let rankSplit = Math.floor(crimeexp.length / 4);
        let start = 1;
        let value = '';
        let embedCount = 0;

        for (let i = 0; i < crimeexp.length; i++) {
            const rank = i + 1;
            let entry = `\`${rank.toString().padStart(3)}.\` ${cleanUpString(members[crimeexp[i]].name)}`;
            if (!crimeParticipants.includes(crimeexp[i].toString())) {
                entry = `*${entry}*`;
            }

            value += entry + '\n';

            if (rank % rankSplit === 0 || rank === crimeexp.length) {
                embedCount++;

                ceEmbed.addFields({ name: `${start} to ${rank}`, value, inline: true });
                if (embedCount % 2 === 0) ceEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false });
                value = '';
                start = rank;
            }
        }

        await interaction.reply({ embeds: [ceEmbed], ephemeral: false });
    },
};
