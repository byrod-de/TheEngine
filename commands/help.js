const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment');
const fs = require('node:fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Help to all commands.'),

  async execute(interaction) {

    let helpEmbed = new EmbedBuilder()
      .setColor(0xdf691a)
      .setTitle(`TornEngine`)
      .setURL(`https://tornengine.netlify.app/`)
      .setDescription('TheEngine Slash Commands Overview')
      .setTimestamp()
      .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });;

    const commands = [];
    // Grab all the command files from the commands directory you created earlier
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

    // Grab the description of each command's data
    for (const file of commandFiles) {
      const command = require(`./${file}`);

      helpEmbed.addFields({ name: `/${command.data.name}`, value: `${command.data.description}`, inline: false });
    }

    currentDate = moment().format().replace('T', ' ');

    await interaction.reply({ embeds: [helpEmbed], ephemeral: false });
  },
};
