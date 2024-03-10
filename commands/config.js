const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const yaml = require('yaml');
const configFilename = 'conf/config.yaml';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Manage bot configuration options')
        .addSubcommand(subcommand =>
            subcommand
                .setName('display')
                .setDescription('Display current config values')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('change')
                .setDescription('Change a config value')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key of the config value to change')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('value')
                        .setDescription('The new value to set for the config key')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reload')
                .setDescription('Reload the config file')
        ),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'display':
                    // Read the YAML configuration file
                    const configData = fs.readFileSync(configFilename, 'utf8');
                    // Parse the YAML data
                    const config = yaml.parse(configData);
                    await interaction.reply(`Current config values:\n${JSON.stringify(config, null, 2)}`);
                    break;
                case 'change':
                    const key = interaction.options.getString('key');
                    const value = interaction.options.getString('value');
                    if (!key || !value) {
                        await interaction.reply('Usage: /config change --key <key> --value <value>');
                        return;
                    }
                    // Read the YAML configuration file
                    const configFile = yaml.parse(fs.readFileSync(configFilename, 'utf8'));
                    // Update the config value
                    configFile[key] = value;
                    // Write the updated config back to file
                    fs.writeFileSync(configFilename, yaml.stringify(configFile));
                    await interaction.reply(`Config value for '${key}' updated to '${value}'.`);
                    break;
                case 'reload':
                    // Reload the cache
                    delete require.cache[require.resolve('../' + configFilename)];
                    await interaction.reply('Config file reloaded successfully.');
                    break;
                default:
                    await interaction.reply('Invalid subcommand.');
            }
        } catch (error) {
            console.error('Error handling config command:', error);
            await interaction.reply('Error handling config command.');
        }
    },
};
