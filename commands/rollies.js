const { SlashCommandBuilder } = require('discord.js');
const { initializeEmbed } = require('../helper/misc');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('rollies')
        .setDescription('Roll the dice!!')
        .addIntegerOption(option =>
            option.setName('dice')
            .setDescription('Select your dice')
            .addChoices(
                { name: 'Roll a D20', value: 20 },
                { name: 'Roll a D12', value: 12 },
                { name: 'Roll a D10', value: 10 },
                { name: 'Roll a D8', value: 8 },
                { name: 'Roll a D6', value: 6 },
                { name: 'Roll a D4', value: 4 },
                { name: 'Coinflip', value: 2 },
            ))
            .addBooleanOption(option =>
                option.setName('show')
                    .setDescription('Show response')),

    /**
     * Asynchronously executes the interaction by rolling a dice and generating a result based on the dice value. 
     *
     * @param {Object} interaction - the interaction object
     * @return {Promise<void>} a promise that resolves when the interaction is executed
     */
    async execute(interaction) {
        const dice = interaction.options.getInteger('dice') ?? 20;
        const show = interaction.options.getBoolean('show') ?? false;

        let result = Math.floor(Math.random() * dice) + 1;
        let value = '';

        if (dice == 2) {
            if (result == 1) {
                result = 'Heads';
                value = 'Coinflip Result';
            } else {
                result = 'Tails';
                value = 'Coinflip Result';
            }
        } else {
            if (result == 1 && dice == 20) {
                result = 'Natural 1 *sad trombone*';
            }

            if (result == 20) {
                result = 'Natural *f-cking* 20!';
            }

            value = 'Result dice roll D' + dice;
        }

        const rolliesEmbed = initializeEmbed('Rollies!')
        .setFooter({ text: 'inspired by Frumpkin', iconURL: 'https://tornengine.netlify.app/images/byrod/Frumpkin.png' });

        await interaction.reply({ embeds: [rolliesEmbed], ephemeral: !show });
    }
};
