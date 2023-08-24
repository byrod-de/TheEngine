const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { token, statusChannelId, statusUpdateInterval, territoryChannelId, territoryUpdateInterval,
	armouryChannelId, armouryUpdateInterval, retalChannelId, retalUpdateInterval } = require('./conf/config.json');

const moment = require('moment');
const os = require('os');
const hostname = os.hostname();

const { checkTerritories, checkArmoury, checkRetals, send_msg, verifyKeys } = require('./functions/async');

const { printLog } = require('./helper/misc');

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
	let statusMessage = `Successfully started on ${hostname}! Logged in as ${c.user.tag} at ${currentDate}`;
	printLog(statusMessage);
	let statusChannel = client.channels.cache.get(statusChannelId);
	if (statusChannel !== undefined) {
		statusChannel.send(`\`\`\`${statusMessage}\`\`\``);
		setInterval(() => send_msg(statusChannel), 1000 * 60 * statusUpdateInterval);
	}

	client.user.setPresence({
		activities: [{ name: "running wild" }],
		status: "online",
	})
});

client.on('ready', () => {
	let currentDate = moment().format().replace('T', ' ');

	let territoryChannel = client.channels.cache.get(territoryChannelId);
	if (territoryChannel !== undefined) {
		let statusMessage = `${currentDate} > Territory stalker started!`;
		territoryChannel.send(`\`\`\`${statusMessage}\`\`\``);
		setInterval(() => checkTerritories(territoryChannel), 1000 * 60 * territoryUpdateInterval);
	}

	let armouryChannel = client.channels.cache.get(armouryChannelId);
	if (armouryChannel !== undefined) {
		let statusMessage = `${currentDate} > Armoury logger started!`;
		armouryChannel.send(`\`\`\`${statusMessage}\`\`\``);
		setInterval(() => checkArmoury(armouryChannel), 1000 * 60 * armouryUpdateInterval);
	}

	let retalChannel = client.channels.cache.get(retalChannelId);

	if (retalChannel !== undefined) {
		let statusMessage = `${currentDate} > Retal bot started!`;
		retalChannel.send(`\`\`\`${statusMessage}\`\`\``);
		setInterval(() => checkRetals(retalChannel), 1000 * 60 * retalUpdateInterval);
	}


	// Run the API key verification once every 24 hours after the start of the script
	const verificationInterval = 1000 * 60 * 60 * 24; // 24 hours in milliseconds
	setInterval(async () => {
		try {
			printLog('Verifying API keys...');
			await verifyKeys();
			printLog('API keys verification complete.');
		} catch (error) {
			printLog('Error verifying API keys:', error);
		}
	}, verificationInterval);
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
