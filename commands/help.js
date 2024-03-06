const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const config = require('../conf/config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Help to all commands.'),

  async execute(interaction) {

    let helpEmbed = new EmbedBuilder()
      .setColor(0xdf691a)
      .setTitle(`TornEngine`)
      .setURL(`https://tornengine.netlify.app/`)
      .setDescription('Slash Commands Overview')
      .setTimestamp()
      .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

    // Grab all the command files from the commands directory you created earlier
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    const activeModules = fs.readFileSync('./conf/activeModules.conf', 'utf8');

    // Grab the description of each command's data
    for (const file of commandFiles) {
      const command = require(`./${file}`);
      if (!activeModules.includes(file)) {
        continue;
      }

      helpEmbed.addFields({ name: `/${command.data.name}`, value: `${command.data.description}`, inline: false });
    }

    // Check if each channel ID exists
    // Check if each channel ID exists
    const existingChannelsSet = new Set(); // Set to store unique channel IDs
    for (const key of Object.keys(config)) {
      if (!key.includes('ChannelId')) continue;
      if (key.includes('statusChannelId')) continue;


      const channelId = config[key];
      // Skip non-channel ID values
      if (!channelId || typeof channelId !== 'string' || !channelId.match(/^\d+$/)) continue;

      const channel = interaction.guild.channels.cache.get(channelId);

      if (channel) {
        existingChannelsSet.add(`<#${channel.id}>`); // Add channel ID to the Set
        console.log(`Channel with ID ${channelId} exists: ${channel.name}`);
      } else {
        console.log(`Channel with ID ${channelId} does not exist.`);
      }
    }

    // Convert the Set back to an array
    const existingChannels = Array.from(existingChannelsSet);

    // Add a field with the list of existing channels
    if (existingChannels.length > 0) {
      helpEmbed.addFields({ name: 'Bot Channels', value: existingChannels.join('\n') });
    }

    await interaction.reply({ embeds: [helpEmbed], ephemeral: false });
  },
};
