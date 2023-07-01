const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { statusChannelId } = require('../config.json');
const { callTornApi } = require('../functions/api');
const moment = require('moment');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

module.exports = {
	data: new SlashCommandBuilder()
		.setName('status')
		.setDescription('Provides status information about the bot!'),

	async execute(interaction) {
    let currentDate = moment().format().replace('T',' ');
    let statusMessage = `${currentDate} > Still running!`;

    let result = await callTornApi('torn', 'timestamp');
    await interaction.reply(`\`\`\`${statusMessage}\n${result[1]}\`\`\``);
	},
};
