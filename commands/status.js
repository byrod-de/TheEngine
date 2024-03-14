const { SlashCommandBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const fs = require('fs');
const moment = require('moment');

const { verifyKeys } = require('../functions/api');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('status')
		.setDescription('Provides status information about the bot!'),

	async execute(interaction) {
    let currentDate = moment().format().replace('T',' ');
    let statusMessage = `${currentDate} > Still running!`;

    let result = await callTornApi('torn', 'timestamp');
    await interaction.reply(`\`\`\`Bot Status: ${statusMessage}\nAPI Status: ${result[1]}\`\`\``);

	//USE THIS TO TEST GEDOENS!

	verifyKeys(undefined, undefined, true);

	//END TESTING HERE

	},
};
