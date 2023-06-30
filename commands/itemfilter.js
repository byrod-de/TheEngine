const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const { printLog } = require('../helper/misc');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('itemfilter')
        .setDescription('List currently set item filter.'),

    async execute(interaction) {

        let tornParamsFile = fs.readFileSync('./tornParams.json');

        let tornParams = JSON.parse(tornParamsFile);

        let itemList = '';

        var arrayLength = tornParams.armouryFilter.length;
        for (var i = 0; i < arrayLength; i++) {
            console.log(tornParams.armouryFilter[i]);
            itemList = itemList + tornParams.armouryFilter[i] + '\n';
            //Do something
        }
        printLog(tornParams.armouryFilter.toString());

        let paramsEmbed = new EmbedBuilder()
            .setColor(0xdf691a)
            .setTitle(`Item Filter`)
            .setDescription(`List of items displayed by the armoury logger`)
            .setTimestamp()
            .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

        paramsEmbed

        await interaction.reply(`\`\`\`\n${itemList}\`\`\``)
    }
}
