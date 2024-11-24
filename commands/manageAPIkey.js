const fs = require('node:fs');

const { SlashCommandBuilder } = require('discord.js');
const { verifyAPIKey, verifyKeys } = require('../functions/api');
const { printLog, checkAPIKey, readConfig, verifyAdminAccess, initializeEmbed } = require('../helper/misc');

const apiConfigPath = './conf/apiConfig.json';

const { comment } = readConfig().apiConf;
const { errorColor, successColor } = readConfig().discordConf;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manageapikey')
        .setDescription('Manage an API key in configuration.')
        .addStringOption(option =>
            option.setName('operation')
                .setDescription('Operation to perform')
                .addChoices(
                    { name: 'Add', value: 'add' },
                    { name: 'Delete', value: 'delete' },
                    { name: 'List', value: 'list' },
                    { name: 'Verify', value: 'verify' }
                )
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('apikey')
                .setDescription('Torn API Key')
                .setRequired(false)),

    async execute(interaction) {

        // Check if the user has access to the channel
        if (!await verifyAdminAccess(interaction, readConfig().limitedAccessConf)) return;

        const keyToManage = interaction.options.getString('apikey') || 'NOT_SET';
        const operation = interaction.options.getString('operation');

        let embed = initializeEmbed('Manage API Key' + ' - ' + operation);

        let checkedAPIKey = '';
        if (keyToManage !== 'NOT_SET') {
            checkedAPIKey = checkAPIKey(keyToManage);
        }
        if (checkedAPIKey.includes('Error') && keyToManage !== 'NOT_SET') {
            embed.setColor(errorColor)
                .setDescription('API Key not valid or inactive!');

            embed.addFields(
                { name: 'Error Message', value: checkedAPIKey, inline: false },
            );
        } else {

            if (operation === 'add') {
                let newKey = {
                    key: keyToManage,
                    active: false,
                    reviver: false,
                };

                await verifyAPIKey(newKey, comment);

                printLog(`Verified API Key: ${newKey.key}`, newKey.active);

                if (!newKey.active) {
                    embed.setColor(errorColor)
                        .setDescription(newKey.errorReason);

                    embed.addFields(
                        { name: 'Active', value: newKey.active.toString(), inline: false },
                        { name: 'API Key', value: newKey.key, inline: false },
                    );
                } else {

                    const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));

                    apiConfig.apiKeys.push(newKey);

                    fs.writeFileSync(apiConfigPath, JSON.stringify(apiConfig, null, 4));

                    embed.setColor(successColor)
                        .setTitle(`${newKey.name} [${newKey.id.toString()}]`)
                        .setURL(`https://byrod.cc/p/${newKey.id}`)
                        .setDescription(`API Key Stored`);

                    embed.addFields(
                        { name: 'Torn User', value: newKey.name, inline: false },
                        { name: 'Torn ID', value: newKey.id.toString(), inline: false },
                        { name: 'Discord ID', value: newKey.discordId.toString(), inline: false },
                        { name: 'Access Level', value: newKey.access_level.toString(), inline: false },
                        { name: 'Access Type', value: newKey.access_type.toString(), inline: false },
                        { name: 'API Key', value: newKey.key, inline: false },
                        { name: 'Reviver', value: newKey.reviver.toString(), inline: false },
                        { name: 'Faction Access', value: newKey.factionAccess.toString(), inline: false },
                    );
                }
            } else if (operation === 'delete') {
           
                const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));
            
                const indexToRemove = apiConfig.apiKeys.findIndex(key => key.key === keyToManage || key.id === keyToManage);
            
                if (indexToRemove !== -1) {
                    apiConfig.apiKeys.splice(indexToRemove, 1);
                    const message = printLog(`Key with key '${keyToManage}' or removed successfully.`);
                    embed.setColor(successColor)
                        .setDescription(message);
                } else {
                    const message = printLog(`Key with key '${keyToManage}' not found.`);
                    embed.setColor(errorColor)
                        .setDescription(message);
                }
            
                fs.writeFileSync(apiConfigPath, JSON.stringify(apiConfig, null, 2));
            } else if (operation === 'list') {
                const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath));

                for (const key of apiConfig.apiKeys) {

                    const symbols = {
                        1: ':white_circle:',
                        2: ':green_circle:',
                        3: ':yellow_circle:',
                        4: ':red_circle:',
                      };

                    const active = key.active ? '✅' : '❌';
                    const reviver = key.reviver ? '✅' : '❌';
                    const access_type = symbols[key.access_level] || '❓';
                    const factionAccess = key.factionAccess ? '✅' : '❌';
                    

                    const fieldValue = `\`Active :\` ${active}\n\`Reviver:\` ${reviver}\n\`Access :\` ${access_type} - ${key.access_type.toString()}\n\`Faction:\` ${factionAccess}\n\`Key    :\` ${key.key.substring(0, 5)}\n`;
                    embed.addFields(
                        { name: key.name, value: fieldValue, inline: false },
                    );
                }

                embed.setColor(successColor);
            } else if (operation === 'verify') {
                embed = await verifyKeys(null, 1, true);
            }
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}
