const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { printLog } = require('../helper/misc');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankedwars')
    .setDescription('Get a list of finished Torn Ranked Wars! You can add a number of hours to go back with (default: 5).')
    .addIntegerOption(option =>
      option.setName('lasthours')
        .setDescription('Number of hours to go back with (default: 5).')),

  async execute(interaction) {
    const lasthours = interaction.options.getInteger('lasthours') ?? 5;
    printLog(`Number of hours ${lasthours}`);

    let response = await callTornApi('torn', 'rankedwars');

    if (response[0]) {
      let jsonRwResponse = response[2];

      let fieldsAdded = 0;

      let rankedWars = jsonRwResponse['rankedwars'];

      let rwEmbed = new EmbedBuilder()
        .setColor(0xdf691a)
        .setTitle('Ranked Wars')
        .setDescription(`Ranked Wars which ended within the last ${lasthours} hours`)
        .setTimestamp()
        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });;

      for (let rwId in rankedWars) {

        let rankedWar = rankedWars[rwId];

        let faction1Name = '', faction2Name = '', faction1ID = '', faction2ID = '', faction1Score = '', faction2Score = '';
        let counter = 0;

        let warStatus = '', rankedWarReport;
        let faction1Items = '', faction2Items = '';
        let now = Date.now() / 1000;


        if ((rankedWar.war.end != 0) && (now - rankedWar.war.end <= lasthours * 60 * 60) && (fieldsAdded <= 25)) {

          let responseReport = await callTornApi('torn', 'rankedwarreport', rwId);

          if (responseReport[0]) {
            let jsonRwReportResponse = responseReport[2];

            rankedWarReport = jsonRwReportResponse['rankedwarreport'];

            warStatus = 'ended';

            printLog(` >>> ${warStatus}`);

            for (let factionID in rankedWar.factions) {

              let faction = rankedWar.factions[factionID];

              if (counter == 0) {
                faction1Name = faction.name;
                faction1Score = faction.score;
                faction1ID = factionID;
                counter = 1;

                for (let itemsId in rankedWarReport.factions[factionID].rewards.items) {
                  if (faction1Items == '') {
                    faction1Items = rankedWarReport.factions[factionID].rewards.items[itemsId].quantity.toString().padStart(3) + 'x ' + rankedWarReport.factions[factionID].rewards.items[itemsId].name.padEnd(15) + '\n';
                  } else {
                    faction1Items = faction1Items + rankedWarReport.factions[factionID].rewards.items[itemsId].quantity.toString().padStart(11) + 'x ' + rankedWarReport.factions[factionID].rewards.items[itemsId].name.padEnd(15) + '\n';
                  }
                }

              } else {
                faction2Name = faction.name;
                faction2Score = faction.score;
                faction2ID = factionID;

                for (let itemsId in rankedWarReport.factions[factionID].rewards.items) {
                  if (faction2Items == '') {
                    faction2Items = rankedWarReport.factions[factionID].rewards.items[itemsId].quantity.toString().padStart(3) + 'x ' + rankedWarReport.factions[factionID].rewards.items[itemsId].name.padEnd(15) + '\n';
                  } else {
                    faction2Items = faction2Items + rankedWarReport.factions[factionID].rewards.items[itemsId].quantity.toString().padStart(11) + 'x ' + rankedWarReport.factions[factionID].rewards.items[itemsId].name.padEnd(15) + '\n';
                  }
                }
              }
            }

            let value = faction1Name
              + '\n```Score  : ' + faction1Score.toString().padStart(5)
              + '\nRewards:' + faction1Items
              + '```\n'
              + faction2Name
              + '\n```Score  : ' + faction2Score.toString().padStart(5)
              + '\nRewards:' + faction2Items
              + '```'
              + `War ended <t:${rankedWar.war.end}:R>\n`;

            rwEmbed.addFields({ name: `${faction1Name} vs ${faction2Name}`, value: `${value}`, inline: false });

            fieldsAdded = fieldsAdded + 1;

          }
        }
      }
      await interaction.reply({ embeds: [rwEmbed], ephemeral: true });

    } else {
      await interaction.reply({ content: response[1], ephemeral: true });
    }
  },
};
