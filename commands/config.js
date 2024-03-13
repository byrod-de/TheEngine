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
                    { name: 'Reload', value: 'reload' },
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
            const subcommand = interaction.options.getString('operation');

            switch (subcommand) {
                case 'display':
                    // Read the YAML configuration file
                    const configData = fs.readFileSync(configFilename, 'utf8');
                    // Parse the YAML data
                    const configValues = yaml.parse(configData);
                    await interaction.reply(`Current config values:\n\`\`\`${yaml.stringify(configValues)}\`\`\``);
                    break;
                case 'change':
                    const key = interaction.options.getString('key');
                    const value = interaction.options.getString('value');
                    if (!key || !value) {
                        await interaction.reply('Usage: /config change --key <key> --value <value>');
                        return;
                    }
                    // Read the YAML configuration file
                    let configFile = yaml.parse(fs.readFileSync(configFilename, 'utf8'));
                    console.log(configFile);

                    // Handle request 2: If a key is named but no context, reply with a warning without changing the value
                    const keyParts = key.split('.');
                    if (keyParts.length > 1 && !configFile.hasOwnProperty(keyParts[0])) {
                        await interaction.reply(`Warning: Context '${keyParts[0]}' does not exist for key '${key}'.`);
                        return;
                    }

                    // Handle request 1: Do not add new keys if they do not exist
                    if (!configFile.hasOwnProperty(key)) {
                        await interaction.reply(`Key '${key}' does not exist in the config.`);
                        return;
                    }

                    // Update the config value
                    configFile[key] = value;

                    // Write the updated config back to file
                    fs.writeFileSync(configFilename, yaml.stringify(configFile));

                    await interaction.reply(`Config value for '${key}' updated to '${value}'.`);
                    break;
                case 'reload':
                    // Reload the cache
                    delete require.cache[require.resolve('../' + configFilename)];
                    configData = fs.readFileSync(configFilename, 'utf8');
                    config = yaml.parse(configData);
                    console.log(config);
                    await interaction.reply('Config file reloaded successfully.');
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
