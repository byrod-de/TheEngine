const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { apiKey, comment } = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankedwars')
    .setDescription('Get a list of finished Torn Ranked Wars')
    .addIntegerOption(option =>
      option.setName('lasthours')
        .setDescription('Number of hours to go back with (default: 5).')),

  async execute(interaction) {
    const lasthours = interaction.options.getInteger('lasthours') ?? 5;
    console.log(`Number of hours ${lasthours}`);

    let rwURL = 'https://api.torn.com/torn/?selections=rankedwars&key=' + apiKey + '&comment=' + comment;
    console.log(` > ${rwURL}`);

    let rwResponse = await fetch(rwURL);

    let fieldsAdded = 0;

    if (rwResponse.ok) { // if HTTP-status is 200-299
      // get the response body (the method explained below)
      let jsonRwResponse = await rwResponse.json();

      if (jsonRwResponse.hasOwnProperty('error')) {

        await interaction.reply(`\`\`\`Error Code ${jsonRwResponse['error'].code},  ${jsonRwResponse['error'].error}.\`\`\``)

      } else {

        let rankedWars = jsonRwResponse['rankedwars'];

        let rwEmbed = new EmbedBuilder()
          .setColor(0x1199bb)
          .setTitle('Ranked Wars')
          .setDescription(`Ranked Wars which ended within the last ${lasthours} hours`)
          .setTimestamp();

        for (let rwId in rankedWars) {

          let rankedWar = rankedWars[rwId];

          let faction1Name = '', faction2Name = '', faction1ID = '', faction2ID = '', faction1Score = '', faction2Score = '';
          let counter = 0;

          let warStatus = '', rankedWarReport;
          let faction1Items = '', faction2Items = '';
          let now = Date.now() / 1000;


          if ((rankedWar.war.end != 0) && (now - rankedWar.war.end <= lasthours * 60 * 60) && (fieldsAdded <= 25)) {

            let rwReportlURL = 'https://api.torn.com/torn/' + rwId + '?selections=rankedwarreport&key=' + apiKey + '&comment=' + comment;
            console.log(` >> ${rwReportlURL}`);

            let rwReportResponse = await fetch(rwReportlURL);

            if (rwReportResponse.ok) {
              let jsonRwReportResponse = await rwReportResponse.json();
              rankedWarReport = jsonRwReportResponse['rankedwarreport'];
            }

            warStatus = 'ended';

            console.log(` >>> ${warStatus}`);


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
        await interaction.reply({ content: `Command /rankedwars executed for the last ${lasthours} hours `, ephemeral: true })


          await interaction.channel.send({ embeds: [rwEmbed], ephemeral: false });
      }
    } else {
      alert("HTTP-Error: " + response.status);
    }
  },
};
