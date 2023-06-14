const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { apiKey, comment } = require('../config.json');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('crimeexp')
        .setDescription('Gets CE Ranking for your faction! You need to store a key with Minimal Access first.'),

    async execute(interaction) {
        let ceURL = `https://api.torn.com/faction/?selections=basic,crimeexp,timestamp&key=${apiKey}&comment=${comment}`;
        console.log(` > ${ceURL}`);

        let ceResponse = await fetch(ceURL);

        if (ceResponse.ok) { // if HTTP-status is 200-299

            let factionJson = await ceResponse.json();

            if (factionJson.hasOwnProperty('error')) {
                if (factionJson['error'].code === 6) {
                    await interaction.reply(`\`\`\`User ${interaction.user.username} is not verified on Torn.\`\`\``);
                } else {
                    await interaction.reply(`\`\`\`Error Code ${factionJson['error'].code},  ${factionJson['error'].error}.\`\`\``)
                }
            } else {

                let members = factionJson ? Object.keys(factionJson.members) : null;
                if (!members || members.length <= 0) {
                    await interaction.reply({ content: `\`\`\`No members found!\`\`\``, ephemeral: false });
                    return;
                }

                let crimeexp = factionJson.crimeexp;
                if (!crimeexp || crimeexp.length <= 0) {
                    await interaction.reply({ content: `\`\`\`No crimeexp found!\`\`\``, ephemeral: false });
                    return;
                }

                let faction_name = factionJson['name'];
                let faction_id = factionJson['ID'];
                let faction_tag = factionJson['tag'];
                let faction_icon = `https://factiontags.torn.com/` + factionJson['tag_image'];


                let ceEmbed = new EmbedBuilder()
                .setColor(0xdf691a)
                .setTitle(`Crime Experience`)
                .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                .setDescription(`Faction members ordered by crime experience`)
                .setTimestamp()
                .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                
                let value = ``;
                let rank_split = 33;
                let start = 1;

                for (let i = 0; i < crimeexp.length; i++) {
                    let rank = i + 1;
                    let entry = `\`${rank.toString().padStart(3)}.\` ` + factionJson.members[crimeexp[i]].name + '\n';
                    value = value + entry;

                    if (rank % rank_split == 0 || rank == crimeexp.length) {
                        ceEmbed.addFields({name: `${start} to ${rank}`, value: value, inline: true });
                        value = ``;
                        start = rank;
                    }
                }

                await interaction.reply({ embeds: [ceEmbed], ephemeral: false });
            }
        }


    },
};
