const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { timestampCache } = require('../functions/async');
const { initializeEmbed } = require('../helper/misc');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('item-check')
        .setDescription('Provides status information items in Torn!'),

    async execute(interaction) {

        const marketEmbed = initializeEmbed('Item  Status');
        marketEmbed.setDescription('Select the item type you want to check!');

        

        const itemResponse = await callTornApi('torn', 'items', undefined, undefined, undefined, undefined, undefined, 'rotate');

        if (!itemResponse[0]) {
            await interaction.reply({ content: itemResponse[1], ephemeral: true });
            return;
        }

        await interaction.reply({ embeds: [marketEmbed], ephemeral: false });

        const itemJson = itemResponse[2];

        const itemTypes = [...new Set(Object.values(itemJson.items).map(item => item.type))];
        console.log(itemTypes);

        //Create one menu entry for each item type
        const selectMenuOptions = itemTypes.filter(type => type !== 'Unused').sort().map(type => ({
            label: type,
            value: type
        }));

        console.log(selectMenuOptions);

        const select = new StringSelectMenuBuilder()
            .setCustomId('item-type')
            .setPlaceholder('Make a selection!')
                .addOptions(selectMenuOptions);
            ;

        const row = new ActionRowBuilder().addComponents(select);

        const message = await interaction.channel.send({ content: 'Select an Item Type!', components: [row] });

        const filter = i => i.user.id === interaction.user.id;

        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.isStringSelectMenu()) {
                if (i.customId === 'item-type') {
                    const selectedType = i.values[0];
                    const itemsOfSelectedType = Object.values(itemJson.items).filter(item => item.type === selectedType);
                    const itemList = itemsOfSelectedType.map(item => `- ${item.name}`).join('\n');
                    await i.reply(`You selected ${selectedType}!\n${itemList}`);
                }
            }
        });

        collector.on('end', collected => {
            //interaction.channel.send(`Collected ${collected.size} interactions.`);
			
        });

    },
};
