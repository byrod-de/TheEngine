const fs = require('fs');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { verifyAPIKey } = require('../functions/async');
const { printLog, checkAPIKey } = require('../helper/misc');
const { comment } = require('../conf/config.json');

const apiConfigPath = './conf/apiConfig.json';


module.exports = {
    data: new SlashCommandBuilder()
        .setName('addkey')
        .setDescription('Add your API key to the configuration.')
        .addStringOption(option =>
            option.setName('mykey')
                .setDescription('Torn API Key')
                .setRequired(true)),

    async execute(interaction) {
        //Get Dicord ID of the user executing the command
        const userID = interaction.user.id;
        const mykey = interaction.options.getString('mykey');

        //Check entered API key if valid
        let checkedAPIKey = checkAPIKey(mykey);
        if (checkedAPIKey.includes('Error')) {
            await interaction.reply(`\`\`\`${checkedAPIKey}\`\`\``);
        } else {

            let response = await callTornApi('user', 'basic,discord', userID, undefined, undefined, undefined, undefined, "rotate");

            if (response[0]) {
                let playerJson = response[2];

                let tornUser = playerJson['name'];
                let tornId = playerJson['player_id'];

                const newKey = {
                    key: mykey,
                    id: tornId,
                    active: false,
                };

                const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));

                await verifyAPIKey(newKey, comment);
                printLog(`Verified API Key: ${newKey.key}.`);

                apiConfig.apiKeys.push(newKey);

                fs.writeFileSync(apiConfigPath, JSON.stringify(apiConfig, null, 4));

                const embed = new EmbedBuilder()
                    .setColor(0xdf691a)
                    .setTitle(`${tornUser} [${tornId}]`)
                    .setURL(`https://www.torn.com/profiles.php?XID=${tornId}`)
                    .setDescription(`API Key Stored`)
                    .setTimestamp()
                    .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

                embed.addFields(
                    { name: 'Torn User', value: tornUser, inline: false },
                    { name: 'Torn ID', value: tornId.toString(), inline: false },
                    { name: 'Access Level', value: newKey.access_level.toString(), inline: false },
                    { name: 'Access Type', value: newKey.access_type.toString(), inline: false },
                    { name: 'API Key', value: newKey.key, inline: false },

                );

                await interaction.reply({ embeds: [embed], ephemeral: true })

            }
        }
    }

}
