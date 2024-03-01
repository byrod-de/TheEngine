const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { token, statusChannelId, statusUpdateInterval, territoryChannelId, territoryUpdateInterval,
	armouryChannelId, armouryUpdateInterval, retalChannelId, retalUpdateInterval, warChannelId, warUpdateInterval, memberChannelId, memberUpdateInterval } = require('./conf/config.json');

const moment = require('moment');
const os = require('os');
const hostname = os.hostname();

const { checkTerritories, checkArmoury, checkRetals, checkWar, checkMembers, sendStatusMsg, verifyKeys } = require('./functions/async');

const { printLog, updateOrDeleteEmbed } = require('./helper/misc');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}


client.once(Events.ClientReady, c => {
	let currentDate = moment().format().replace('T', ' ');
	let statusMessage = `Successfully started on ${hostname}! Logged in as ${c.user.tag}`;
	
	let statusChannel = client.channels.cache.get(statusChannelId);
	if (statusChannel !== undefined) {
		sendStatusMsg(statusChannel, statusUpdateInterval, statusMessage);
		setInterval(() => sendStatusMsg(statusChannel, statusUpdateInterval), 1000 * 60 * statusUpdateInterval);
	}

	client.user.setPresence({
		activities: [{ name: "Torn(dot)com", type: 3 }],
		status: "online",
	})
});

client.on('ready', () => {
	let currentDate = moment().format().replace('T', ' ');

	let territoryChannel = client.channels.cache.get(territoryChannelId);
	let armouryChannel = client.channels.cache.get(armouryChannelId);
	let memberChannel = client.channels.cache.get(memberChannelId);
	let retalChannel = client.channels.cache.get(retalChannelId);
	let warChannel = client.channels.cache.get(warChannelId);

	if (territoryChannel !== undefined) {
		setInterval(() => checkTerritories(territoryChannel), 1000 * 60 * territoryUpdateInterval);
	}

	if (armouryChannel !== undefined) {
		setInterval(() => checkArmoury(armouryChannel), 1000 * 60 * armouryUpdateInterval);
	}

	if (retalChannel !== undefined) {
		setInterval(() => checkRetals(retalChannel), 1000 * 60 * retalUpdateInterval);
	}

	if (warChannel !== undefined) {
		setInterval(() => checkWar(warChannel, memberChannel), 1000 * 60 * warUpdateInterval);
	}

	if (memberChannel !== undefined) {
		setInterval(() => checkMembers(memberChannel), 1000 * 60 * memberUpdateInterval);
	}

	// Run the API key verification once every 24 hours after the start of the script
	const verificationInterval = 60 * 24; // 24 hours
	let statusChannel = client.channels.cache.get(statusChannelId);
	if (statusChannel !== undefined) {
		setInterval(() => verifyKeys(statusChannel), 1000 * 60 * verificationInterval);
	}
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

client.login(token);
