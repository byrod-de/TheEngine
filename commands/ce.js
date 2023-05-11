const { SlashCommandBuilder } = require('discord.js');
const { apiKey, comment } = require('../config.json');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('ce-ranking')
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

                let faction = factionJson['name'];
                let factionId = factionJson['ID'];
                
                let value = ``;
                let header = `Crime Experience for faction **${faction} [${factionId}]**\n`;

                for (let i = 0; i < crimeexp.length; i++) {
                    let rank = i + 1;
                    let entry = rank.toString().padStart(3) + ' | ' + factionJson.members[crimeexp[i]].name + '\n';
                    value = value + entry;
                }

                await interaction.reply({ content: `${header}\`\`\`${value}\`\`\``, ephemeral: false });
            }
        }


    },
};
