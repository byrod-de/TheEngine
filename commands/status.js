const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { token, statusChannelId, statusGuildId } = require('../config.json');
const moment = require('moment');
const os = require('os');
const hostname = os.hostname();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

module.exports = {
	data: new SlashCommandBuilder()
		.setName('status')
		.setDescription('Provides status information about the bot!'),

	async execute(interaction) {
    let currentDate = moment().format().replace('T',' ');
    let statusMessage = `Alive! time: ${currentDate}`;

    await interaction.reply(statusMessage);

    let statusChannel = client.channels.cache.get(statusChannelId);
    if (statusChannel !== undefined) {
      statusChannel.send(`\`\`\`${statusMessage}\`\`\``);
    }
	},
};
