const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { timestampCache } = require('../functions/async');
const { initializeEmbed } = require('../helper/misc');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Provides status information about the bot!'),

    async execute(interaction) {
        const currentDate = moment().format().replace('T', ' ');
        const statusMessage = `Still running!`;
        const result = await callTornApi('torn', 'timestamp');

        const startUpTime = timestampCache.get('startUpTime');
        console.log(startUpTime);

        const botStatusEmbed = initializeEmbed('Bot Status');

        if (startUpTime) botStatusEmbed.addFields({ name: 'Start Up Time', value: `\`${startUpTime}\``, inline: false });
        botStatusEmbed.addFields({ name: 'Bot Status', value: `\`${currentDate} > ${statusMessage}\``, inline: false });
        botStatusEmbed.addFields({ name: 'API Status', value: `\`${result[1]}\``, inline: false });

        await interaction.reply({ embeds: [botStatusEmbed], ephemeral: false });

        /*
        const button1 = new ButtonBuilder()
            .setCustomId('primary')
            .setLabel('Primary Button')
            .setStyle(ButtonStyle.Primary);

        const select = new StringSelectMenuBuilder()
            .setCustomId('starter')
            .setPlaceholder('Make a selection!')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Bulbasaur')
                    .setDescription('The dual-type Grass/Poison Seed Pokémon.')
                    .setValue('bulbasaur'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Charmander')
                    .setDescription('The Fire-type Lizard Pokémon.')
                    .setValue('charmander'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Squirtle')
                    .setDescription('The Water-type Tiny Turtle Pokémon.')
                    .setValue('squirtle'),
            );

        const row = new ActionRowBuilder().addComponents(select);

        const message = await interaction.channel.send({ content: 'Component Test!', components: [row] });

        const filter = i => i.user.id === interaction.user.id;

        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.isButton()) {
                if (i.customId === 'primary') {
                    await i.reply('You clicked the primary button!');
                }
            } else if (i.isStringSelectMenu()) {
                if (i.customId === 'starter') {
                    await i.reply(`You selected ${i.values[0]}!`);
                }
            }
        });

        collector.on('end', collected => {
            //interaction.channel.send(`Collected ${collected.size} interactions.`);
			
        });
        */
    },
};
