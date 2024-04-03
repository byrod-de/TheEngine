const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { timestampCache } = require('../functions/async');
const moment = require('moment');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('status')
		.setDescription('Provides status information about the bot!'),

	async execute(interaction) {
		const currentDate = moment().format().replace('T', ' ');
		const statusMessage = `Still running!`;
		const result = await callTornApi('torn', 'timestamp');

		const startUpTime = timestampCache.get('startUpTime');
		console.log(startUpTime);

		const botStatusEmbed = new EmbedBuilder()
        .setColor(0xdf691a)
        .setTitle('Bot Status')
        .setTimestamp()
        .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

		if (startUpTime) botStatusEmbed.addFields({ name: 'Start Up Time', value: `\`${startUpTime}\``, inline: false });
		botStatusEmbed.addFields({ name: 'Bot Status', value: `\`${currentDate} > ${statusMessage}\``, inline: false });
		botStatusEmbed.addFields({ name: 'API Status', value: `\`${result[1]}\``, inline: false });

		await interaction.reply({ embeds: [botStatusEmbed], ephemeral: false });
	},
};
