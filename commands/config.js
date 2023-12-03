const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const moment = require('moment');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

module.exports = {
	data: new SlashCommandBuilder()
		.setName('config')
		.setDescription('Display config data of the bot!'),

	async execute(interaction) {

		if (message.member.hasPermission('ADMINISTRATOR')) console.log('User is an admin.');

    let currentDate = moment().format().replace('T',' ');
    let statusMessage = `${currentDate} > Still running!`;

    let result = await callTornApi('torn', 'timestamp');
    await interaction.reply(`\`\`\`Bot Status: ${statusMessage}\nAPI Status: ${result[1]}\`\`\``);
	},
};
