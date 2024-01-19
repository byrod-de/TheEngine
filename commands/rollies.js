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
        let challengedRoll = null;

        const rolliesEmbed = new EmbedBuilder()
            .setColor(0xdf691a)
            .setTitle('Rollies Game')
            .setDescription(`${challenger.username} challenged ${challenged.username} to a rollies game!`)
            .addFields({ name: 'Rolls', value: `${challenger.username}: ${challengerRoll}\n${challenged.username}: ${challengedRoll || 'Waiting for roll...'}`, inline: false },
                { name: 'Result', value: 'It\'s a tie!', inline: false })
            .setTimestamp()
            .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

        // Send the initial message
        const message = await interaction.reply({ embeds: [rolliesEmbed], ephemeral: true });

        // Wait for challenged player to confirm with a reaction
        await message.react('✅');

        const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === challenged.id;
        const collector = message.createReactionCollector({ filter, time: 30000 });

        collector.on('collect', async () => {
            challengedRoll = roll();
            rolliesEmbed.fields[0].value = `${challenger.username}: ${challengerRoll}\n${challenged.username}: ${challengedRoll}`;
            rolliesEmbed.fields[1].value = `${challenged.username} rolled!`;
            await interaction.editReply({ embeds: [rolliesEmbed] });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp('Rollies game ended because the challenged player did not confirm the roll in time.');
            }
        });
    },
};
