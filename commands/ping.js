const { SlashCommandBuilder } = require('discord.js');
const moment = require('moment');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong and the current timestamp!'),

	async execute(interaction) {
		currentDate = moment().format().replace('T',' ');

    await interaction.reply({ content: `\`\`\`Pong! ${currentDate}\`\`\``, ephemeral: false });
	},
};
