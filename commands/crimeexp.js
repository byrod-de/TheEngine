const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { verifyChannelAccess } = require('../helper/misc');
const { cleanUpString } = require('../helper/formattings');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('crimeexp')
        .setDescription('Gets CE Ranking for your faction!'),

    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, true)) return;

        const response = await callTornApi('faction', 'basic,crimeexp,crimes,timestamp');

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


        const ceEmbed = new EmbedBuilder()
            .setColor(0xdf691a)
            .setTitle('Crime Experience')
            .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
            .setDescription('Faction members ordered by crime experience.\n*Members marked with an asterisk (\\*) are currently in a PA.*\n*The faction has currently ' + numberOfPAs + ' active PA teams.*')
            .setTimestamp()
            .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

        let rankSplit = Math.floor(crimeexp.length / 4);
        let start = 1;
        let value = '';
        let embedCount = 0;

        for (let i = 0; i < crimeexp.length; i++) {
            const rank = i + 1;
            let entry = `\`${rank.toString().padStart(3)}.\` ${cleanUpString(members[crimeexp[i]].name)}`;
            if (crimeParticipants.includes(crimeexp[i].toString())) {
                entry += ' \*';
            }

            value += entry + '\n';

            if (rank % rankSplit === 0 || rank === crimeexp.length) {
                embedCount++;

                ceEmbed.addFields({ name: `${start} to ${rank}`, value, inline: true });
                if (embedCount % 2 === 0) ceEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false }); value = '';
                start = rank;
            }
        }

        await interaction.reply({ embeds: [ceEmbed], ephemeral: false });
    },
};
