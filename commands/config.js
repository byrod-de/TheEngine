const { SlashCommandBuilder } = require('discord.js');
const { verifyAdminAccess, readConfig, logCommandUser } = require('../helper/misc');
const fs = require('fs');
const yaml = require('yaml');
const configFilename = './conf/config.yaml';
let config = readConfig();


module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Manage bot configuration options')
        .addStringOption(option =>
            option.setName('operation')
                .setDescription('Operation to perform')
                .addChoices(
                    { name: 'Display', value: 'display' },
                    { name: 'Change', value: 'change' },
                    //{ name: 'Reload', value: 'reload' },
                )
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('key')
                .setDescription('The key of the config value to change')
                .setRequired(false) // Set to true if it's required for the "change" operation
        )
        .addStringOption(option =>
            option.setName('value')
                .setDescription('The new value to set for the config key')
                .setRequired(false) // Set to true if it's required for the "change" operation
        ),

    async execute(interaction) {
        logCommandUser(interaction);

        // Check if the user has access to the channel
        if (!await verifyAdminAccess(interaction, readConfig().limitedAccessConf)) return;

        try {
            const operation = interaction.options.getString('operation');

            switch (operation) {
                case 'display':
                    await interaction.reply({ content: `Current config values:\n\`\`\`${yaml.stringify(config)}\`\`\``, ephemeral: true });
                    break;

                case 'change':
                    const key = interaction.options.getString('key');
                    const value = interaction.options.getString('value');
                    if (!key || !value) {
                        await interaction.reply({ content: 'Usage: /config change --key <key> --value <value>', ephemeral: true });
                        return;
                    }

                    // Split key into parentObject and propertyName
                    let parentObject, propertyName;
                    if (key.includes('.')) {
                        const keyParts = key.split('.');
                        parentObject = keyParts[0];
                        propertyName = keyParts[1];
                    } else {
                        parentObject = null;
                        propertyName = key;
                    }

                    // Handle request: If a key is named but no context, reply with a warning without changing the value
                    if (parentObject && propertyName) {
                        if (!config[parentObject]) {
                            await interaction.reply({ content: `Error: Parent object '${parentObject}' does not exist.`, ephemeral: true });
                            return;
                        }
                        if (!config[parentObject][propertyName]) {
                            await interaction.reply({ content: `Error: Property '${propertyName}' does not exist in '${parentObject}'.`, ephemeral: true });
                            return;
                        }
                        config[parentObject][propertyName] = value;
                    } else if (!parentObject && propertyName) {
                        if (!config[propertyName]) {
                            await interaction.reply({ content: `Error: Property '${propertyName}' does not exist.`, ephemeral: true });
                            return;
                        }
                        config[propertyName] = value;
                    } else {
                        await interaction.reply({ content: `Error: Invalid key '${key}'.`, ephemeral: true });
                        return;
                    }

                    // Write the updated config back to file
                    fs.writeFileSync(configFilename, yaml.stringify(config));
                    await interaction.reply({ content: `Config value for '${key}' updated to '${value}'.`, ephemeral: true });
                    break;
                case 'reload':
                    await interaction.reply('Hold on, bot will be restarted.');
                    //restartBot();
                    break;
                default:
                    await interaction.reply('Invalid subcommand.');
            }
        } catch (error) {
            console.error('Error handling config command:', error);
            await interaction.reply({ content: 'Error handling config command.', ephemeral: true });
        }
    }
};
