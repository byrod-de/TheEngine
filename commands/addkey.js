const fs = require('node:fs');

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { verifyAPIKey } = require('../functions/async');
const { printLog, checkAPIKey, readConfig } = require('../helper/misc');

const apiConfigPath = './conf/apiConfig.json';

const comment = readConfig().apiConf.comment;



module.exports = {
    data: new SlashCommandBuilder()
        .setName('addkey')
        .setDescription('Add an API key to the configuration.')
        .addStringOption(option =>
            option.setName('apikey')
                .setDescription('Torn API Key')
                .setRequired(true)),

    async execute(interaction) {
        const keyToAdd = interaction.options.getString('apikey');

        let embed = new EmbedBuilder()
        .setTimestamp()
        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

        //Check entered API key if valid
        let checkedAPIKey = checkAPIKey(keyToAdd);
        if (checkedAPIKey.includes('Error')) {
            embed.setColor(0xd9534f)
            .setDescription('API Key not valid or inactive!');

            embed.addFields(
                { name: 'Error Message', value: checkedAPIKey, inline: false },
            );

            await interaction.reply({ embeds: [embed], ephemeral: true })
        } else {

            const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));

            let tornId = 0;
            let tornUser = 'dummy';
            let discordId = 0;

            let newKey = {
                key: keyToAdd,
                id: tornId,
                active: false,
                discordId: 0,
                reviver: false,
            };

            await verifyAPIKey(newKey, comment);

            printLog(`Verified API Key: ${newKey.key}`, newKey.active);

            if (!newKey.active) {
                embed.setColor(0xd9534f)
                .setDescription(newKey.errorReason);

                embed.addFields(
                    { name: 'Active', value: newKey.active.toString(), inline: false },
                    { name: 'API Key', value: newKey.key, inline: false },
                );

                await interaction.reply({ embeds: [embed], ephemeral: true })
                return;
            }

            const response = await callTornApi('user', 'basic,discord', undefined, undefined, undefined, undefined, undefined, "external", newKey.key);

            if (response[0]) {
                const playerJson = response[2];
                tornUser = playerJson['name'];
                tornId = playerJson['player_id'];
                discordId = playerJson.discord['discordID'];

                const reviveResponse = await callTornApi('user', '', '2', undefined, undefined, undefined, undefined, "external", newKey.key);
                if (response[0]) {
                    const reviveJson = reviveResponse[2];
                    if (reviveJson.revivable == 1) {
                        newKey.reviver = true;
                    }
                }
            }

            newKey.id = tornId;
            newKey.discordId = discordId;
            newKey.name = tornUser;

            apiConfig.apiKeys.push(newKey);

            fs.writeFileSync(apiConfigPath, JSON.stringify(apiConfig, null, 4));

            embed.setColor(0x5cb85c)
            .setTitle(`${tornUser} [${tornId}]`)
            .setURL(`https://www.torn.com/profiles.php?XID=${tornId}`)
            .setDescription(`API Key Stored`);

            embed.addFields(
                { name: 'Torn User', value: tornUser, inline: false },
                { name: 'Torn ID', value: tornId.toString(), inline: false },
                { name: 'Discord ID', value: newKey.discordId.toString(), inline: false },
                { name: 'Access Level', value: newKey.access_level.toString(), inline: false },
                { name: 'Access Type', value: newKey.access_type.toString(), inline: false },
                { name: 'API Key', value: newKey.key, inline: false },
                { name: 'Reviver', value: newKey.reviver.toString(), inline: false },
            );

            await interaction.reply({ embeds: [embed], ephemeral: true })

        }
    }
}
