const { SlashCommandBuilder } = require('discord.js');
const { initializeEmbed } = require('../helper/misc');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('rollies')
        .setDescription('Roll dice and generate a result based on the dice value. Supports XdY format.')
        .addStringOption(option =>
            option.setName('dice')
            .setDescription('(optional): Specifies the dice format in the format XdY. Defaults to 1d20.')
            .setRequired(false))
            .addBooleanOption(option =>
                option.setName('show')
                    .setDescription('(optional): Determines whether the response should be shown or not. Defaults to false.')),

    /**
     * Asynchronously executes the interaction by rolling a dice and generating a result based on the dice value. 
     *
     * @param {Object} interaction - the interaction object
     * @return {Promise<void>} a promise that resolves when the interaction is executed
     */
    async execute(interaction) {
        let diceString = interaction.options.getString('dice') ?? '1d20';
        const show = interaction.options.getBoolean('show') ?? false;
        

        if (diceString === 'Coin') {
            diceString = '1d2';
        }

        let [numDice, numSides] = diceString.split('d').map(Number);


        if (numDice === undefined || numSides === undefined || numSides===0) {
            const errorEmbed = initializeEmbed('Skill issue', 'error')
                .setDescription('Invalid dice format.\nPlease use the format `XdY`, where `X` is the number of dice and `Y` is the number of sides.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const allowedDice = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

        if (!allowedDice.includes('d' + numSides)) {
            const errorEmbed = initializeEmbed('Skill issue', 'error')
                .setDescription('Invalid dice size.\nPlease use one of the following dice sizes: `d2`, `d4`, `d6`, `d8`, `d10`, `d12`, `d20` or `d100`');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        if (numDice === 0) {
            numDice = 1;
        }

        let rolls = [];
        let total = 0;
        let value = '';

        for (let i = 0; i < numDice; i++) {
            const roll = Math.floor(Math.random() * numSides) + 1;
            rolls.push(roll);
            total += roll;
        }
    
        const rollsString = rolls.join(', ');
    
        if (numDice === 1) {
            if (numSides === 2) {
                if (rolls[0] === 1) {
                    value = 'Result of flipping a coin: **Heads**';
                } else {
                    value = 'Result of flipping a coin: **Tails**';
                }
            } else {
                value = `Result of rolling a D${numSides}, Total: **${total}**`;
            }
        } else {
            value = `Result: ${numDice}d${numSides} (${rollsString}), Total: **${total}**`;
        }

        let title = 'Rollies!';
        if (numSides === 20) {
            if (rolls.includes(20)) {
                value += '\n:fire: Natural f*ing 20! ';
                title = 'Critical Success!';
            }
            if (rolls[0] === 1) {
                value += '\n:skull_crossbones: Natural 1 ';
                title = 'Critical Fail!';
            }
        }

    
        const rolliesEmbed = initializeEmbed(title)
            .setFooter({ text: 'inspired by Frumpkin', iconURL: 'https://tornengine.netlify.app/images/byrod/Frumpkin.png' });
        rolliesEmbed.setDescription(`${value}`)
        await interaction.reply({ embeds: [rolliesEmbed], ephemeral: !show });
    
    }
};
