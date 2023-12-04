const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rollies')
        .setDescription('Challenge someone to a rollies game!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user you want to challenge.')
                .setRequired(true)),

    async execute(interaction) {
        const challenger = interaction.user;
        const challenged = interaction.options.getUser('user');

        if (!challenged) {
            await interaction.reply('You need to challenge someone. Mention a user.');
            return;
        }

        const roll = () => Math.floor(Math.random() * 20) + 1;
        const challengerRoll = roll();
        const challengedRoll = roll();

        let result = 'It\'s a tie!';

        if (challengerRoll > challengedRoll) {
            result = `${challenger.username} wins with a roll of ${challengerRoll}!`;
        } else if (challengedRoll > challengerRoll) {
            result = `${challenged.username} wins with a roll of ${challengedRoll}!`;
        }

        const rolliesEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Rollies Game')
            .setDescription(`${challenger.username} challenged ${challenged.username} to a rollies game!`)
            .addFields('Rolls', `${challenger.username}: ${challengerRoll}\n${challenged.username}: ${challengedRoll}`)
            .addFields('Result', result)
            .setTimestamp();

        await interaction.reply({ embeds: [rolliesEmbed], ephemeral: true });
    },
};
