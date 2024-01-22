const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { printLog } = require('../helper/misc');

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
            )),

    async execute(interaction) {
        const dice = interaction.options.getInteger('dice') ?? 20;

        let result = Math.floor(Math.random() * dice) + 1;

        const rolliesEmbed = new EmbedBuilder()
        .setColor(0xdf691a)
        .setTitle(`Rollies!`)
        .setDescription(`Roll the dice!`)
        .setTimestamp()
        .setFooter({ text: 'powered by TornEngine, inspired be Critical Role', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

        if (dice == 2) {
            if (result == 1) {
                rolliesEmbed.addFields(
                    { name: 'Heads', value: 'Result Coinflip', inline: false },
                );
            } else {
                rolliesEmbed.addFields(
                    { name: 'Tails', value: 'Result Coinflip', inline: false },
                );
            }
        } else {
            if (result == 1) {
                result = 'Natural 1 *sad trombone*';
            }

            if (result == 20) {
                result = 'Natural fucking 20!';
            }
            rolliesEmbed.addFields(
                { name: `${result}`, value: `Result dice roll D${dice}`, inline: false },
            );
        }
        await interaction.reply({ embeds: [rolliesEmbed], ephemeral: true });
    }
};
