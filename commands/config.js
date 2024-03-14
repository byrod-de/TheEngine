const { SlashCommandBuilder } = require('discord.js');
const { readConfig } = require('../helper/misc');
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
        try {
            const operation = interaction.options.getString('operation');

            switch (operation) {
                case 'display':
                    await interaction.reply(`Current config values:\n\`\`\`${yaml.stringify(config)}\`\`\``);
                    break;

                case 'change':
                    const key = interaction.options.getString('key');
                    const value = interaction.options.getString('value');
                    if (!key || !value) {
                        await interaction.reply('Usage: /config change --key <key> --value <value>');
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
                            await interaction.reply(`Error: Parent object '${parentObject}' does not exist.`);
                            return;
                        }
                        if (!config[parentObject][propertyName]) {
                            await interaction.reply(`Error: Property '${propertyName}' does not exist in '${parentObject}'.`);
                            return;
                        }
                        config[parentObject][propertyName] = value;
                    } else if (!parentObject && propertyName) {
                        if (!config[propertyName]) {
                            await interaction.reply(`Error: Property '${propertyName}' does not exist.`);
                            return;
                        }
                        config[propertyName] = value;
                    } else {
                        await interaction.reply(`Error: Invalid key '${key}'.`);
                        return;
                    }

                    // Write the updated config back to file
                    fs.writeFileSync(configFilename, yaml.stringify(config));
                    await interaction.reply(`Config value for '${key}' updated to '${value}'.`);
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
            await interaction.reply('Error handling config command.');
        }
    }
};
