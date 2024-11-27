const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

const { printLog, logCommandUser } = require('../helper/misc');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('filters')
        .setDescription('Handle filters.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List filters.')
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Filter categories')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Items for Armoury', value: 'armouryFilter' },
                            { name: 'Territory factions', value: 'ttFactionIDs' },
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add filter.')
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Filter categories')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Items for Armoury', value: 'armouryFilter' },
                            { name: 'Territory factions', value: 'ttFactionIDs' },
                        )
                )
                .addStringOption(option =>
                    option.setName('entry')
                        .setDescription('New entry')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        logCommandUser(interaction);

        const tornParamsFile = fs.readFileSync('./conf/tornParams.json');
        let tornParams = JSON.parse(tornParamsFile);

        if (interaction.options.getSubcommand() === 'list') {


            let category = interaction.options.getString('category');

            let paramList = '';

            var arrayLength = tornParams[category].length;
            for (var i = 0; i < arrayLength; i++) {
                printLog(tornParams[category][i]);
                paramList = paramList + tornParams[category][i] + '\n';
            }

            await interaction.reply(`\`\`\`\n${paramList}\`\`\``)
        }

        if (interaction.options.getSubcommand() === 'add') {
            let category = interaction.options.getString('category');
            let entry = interaction.options.getString('entry');

            await interaction.reply(`\`\`\`\n${category} => ${entry}\`\`\``)

        }
    }
}
