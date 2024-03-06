const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const moment = require('moment');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

module.exports = {
	data: new SlashCommandBuilder()
		.setName('config')
		.setDescription('Display config data of the bot!'),

	async execute(interaction) {


		const member = await interaction.guild.members.fetch(interaction.user.id);

		if (member.permissions.has('ADMINISTRATOR')) {
		  console.log('User is an admin.');
		}

		const roleId = '898587013912072232'; // Replace with the actual role ID

		const role = interaction.guild.roles.cache.get(roleId);
		if (role && member.roles.cache.has(roleId)) {
		  console.log(`User has the ${role.name} role.`);
		}

    let currentDate = moment().format().replace('T',' ');
    let statusMessage = `${currentDate} > Still running!`;

    let result = await callTornApi('torn', 'timestamp');
    await interaction.reply(`\`\`\`Bot Status: ${statusMessage}\nAPI Status: ${result[1]}\`\`\``);
	},
};
