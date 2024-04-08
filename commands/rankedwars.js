const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { printLog, readConfig } = require('../helper/misc');
const he = require('he');

const { embedColor } = readConfig().discordConf;

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
        .setColor(embedColor)
        .setTitle('Ranked Wars')
        .setDescription(`Ranked Wars which ended within the last ${lasthours} hours`)
        .setTimestamp()
        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

      const now = Date.now() / 1000;

      for (let rwId in rankedWars) {
        let rankedWar = rankedWars[rwId];
        let factionIDs = Object.keys(rankedWar.factions);
        let winner = rankedWar.war.winner;

        if (factionIDs.length === 2 && winner != 0) {
          const faction1ID = factionIDs[0];
          const faction2ID = factionIDs[1];

          if ((rankedWar.war.end != 0) && (now - rankedWar.war.end <= lasthours * 60 * 60) && (fieldsAdded < 25)) {
            let responseReport = await callTornApi('torn', 'rankedwarreport', rwId);

            if (responseReport[0]) {
              let jsonRwReportResponse = responseReport[2];
              let rankedWarReport = jsonRwReportResponse['rankedwarreport'];

              let faction1 = rankedWar.factions[faction1ID];
              let faction2 = rankedWar.factions[faction2ID];

              let faction1Name = he.decode(faction1.name);
              let faction2Name = he.decode(faction2.name);
              let faction1Score = faction1.score;
              let faction2Score = faction2.score;

              let faction1Items = '';
              let faction2Items = '';

              let winnerEmoji = '🏆'; // Define the trophy emoji
              let loserEmoji = '☠️';  // Define the loser emoji
              
              if (winner.toString() === faction1ID.toString()) {
                faction1Name = `${winnerEmoji} ${faction1Name}`;
                faction2Name = `${loserEmoji} ${faction2Name}`;
              } else if (winner.toString() === faction2ID.toString()) {
                faction1Name = `${loserEmoji} ${faction1Name}`;
                faction2Name = `${winnerEmoji} ${faction2Name}`;
              }

              for (let itemsId in rankedWarReport.factions[faction1ID].rewards.items) {
                if (faction1Items == '') {
                  faction1Items = rankedWarReport.factions[faction1ID].rewards.items[itemsId].quantity.toString().padStart(3) + 'x ' + rankedWarReport.factions[faction1ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                } else {
                  faction1Items = faction1Items + rankedWarReport.factions[faction1ID].rewards.items[itemsId].quantity.toString().padStart(11) + 'x ' + rankedWarReport.factions[faction1ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                }
              }

              for (let itemsId in rankedWarReport.factions[faction2ID].rewards.items) {
                if (faction2Items == '') {
                  faction2Items = rankedWarReport.factions[faction2ID].rewards.items[itemsId].quantity.toString().padStart(3) + 'x ' + rankedWarReport.factions[faction2ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                } else {
                  faction2Items = faction2Items + rankedWarReport.factions[faction2ID].rewards.items[itemsId].quantity.toString().padStart(11) + 'x ' + rankedWarReport.factions[faction2ID].rewards.items[itemsId].name.padEnd(15) + '\n';
                }
              }


              const warStatus = 'ended';  // Assuming this value is determined elsewhere

              let value = `War ${warStatus} <t:${rankedWar.war.end}:R>\n\`\`\`${faction1Name}\nScore  : ${faction1Score.toString().padStart(5)}\nRewards:${faction1Items}\`\`\`\`\`\`${faction2Name}\nScore  : ${faction2Score.toString().padStart(5)}\nRewards:${faction2Items}\`\`\``;

              rwEmbed.addFields({ name: `${faction1Name.replace(winnerEmoji, '').replace(loserEmoji, '')} vs ${faction2Name.replace(winnerEmoji, '').replace(loserEmoji, '')}`, value, inline: false });

              fieldsAdded = fieldsAdded + 1;
            }
          }
        }
      }

      if (fieldsAdded > 0) {
        await interaction.reply({ embeds: [rwEmbed], ephemeral: true });
      } else {
        await interaction.reply({ content: 'No recent ranked wars found.', ephemeral: true });
      }
    } else {
      await interaction.reply({ content: response[1], ephemeral: true });
    }
  },
};