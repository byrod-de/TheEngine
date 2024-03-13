const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { verifyChannelAccess } = require('../helper/misc');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('crimeexp')
        .setDescription('Gets CE Ranking for your faction!'),

    async execute(interaction) {

        // Check if the user has access to the channel and category
        if (!await verifyChannelAccess(interaction, true, true)) return;

        const response = await callTornApi('faction', 'basic,crimeexp,timestamp');

        if (!response[0]) {
            await interaction.reply({ content: response[1], ephemeral: true });
            return;
        }

        const factionJson = response[2];

        const members = factionJson?.members || [];
        const crimeexp = factionJson?.crimeexp || [];


        if (members.length === 0) {
            await interaction.reply({ content: 'No members found!', ephemeral: false });
            return;
        }

        const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson;

        const faction_icon_URL = `https://factiontags.torn.com/${factionJson['tag_image']}`;


        const ceEmbed = new EmbedBuilder()
            .setColor(0xdf691a)
            .setTitle('Crime Experience')
            .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
            .setDescription('Faction members ordered by crime experience')
            .setTimestamp()
            .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

        const rankSplit = 33;
        let start = 1;
        let value = '';

        for (let i = 0; i < crimeexp.length; i++) {
            const rank = i + 1;
            const entry = `\`${rank.toString().padStart(3)}.\` ${members[crimeexp[i]].name}\n`;
            value += entry;

            if (rank % rankSplit === 0 || rank === crimeexp.length) {
                ceEmbed.addFields({ name: `${start} to ${rank}`, value, inline: true });
                value = '';
                start = rank;
            }
        }

        await interaction.reply({ embeds: [ceEmbed], ephemeral: false });
    },
};
