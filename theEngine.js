const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, statusChannelId, statusUpdateInterval, territoryChannelId, territoryUpdateInterval,
	armouryChannelId, armouryUpdateInterval, retalChannelId, retalUpdateInterval, warChannelId, warUpdateInterval, memberChannelId, memberUpdateInterval } = require('./conf/config.json');

const moment = require('moment');
const os = require('os');
const hostname = os.hostname();

const { checkTerritories, checkArmoury, checkRetals, checkWar, checkMembers, checkOCs, sendStatusMsg, verifyKeys } = require('./functions/async');

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
	const statusMessage = `Successfully started on ${hostname}! Logged in as ${c.user.tag}`;

	const statusChannel = client.channels.cache.get(statusChannelId);

	if (statusChannel !== undefined) {
		sendStatusMsg(statusChannel, statusUpdateInterval, statusMessage);
		setInterval(() => sendStatusMsg(statusChannel, statusUpdateInterval), 1000 * 60 * statusUpdateInterval);
	}


	//0: Playing
	//1: Streaming
	//2: Listening
	//3: Watching
	const activityPool = [
		{ name: "in the basement", type: 0 },
		{ name: "Torn(dot)com!", type: 0 },
		{ name: "nothing", type: 1 },
		{ name: "from the attic", type: 1 },
		{ name: "people blaming Ched", type: 2 },
		{ name: "Crimes 2.0", type: 3 },
	];

	const randomActivity = activityPool[Math.floor(Math.random() * activityPool.length)];

	client.user.setPresence({
		activities: [{ name: randomActivity.name, type: randomActivity.type }],
		status: "online",
	});
});

client.on('ready', () => {

	const territoryChannel = client.channels.cache.get(territoryChannelId);
	const armouryChannel = client.channels.cache.get(armouryChannelId);
	const memberChannel = client.channels.cache.get(memberChannelId);
	const retalChannel = client.channels.cache.get(retalChannelId);
	const warChannel = client.channels.cache.get(warChannelId);
	const statusChannel = client.channels.cache.get(statusChannelId);

	// Run the API key verification once every 24 hours after the start of the script
	const verificationInterval = 24; // 24 hours

	if (territoryChannel !== undefined) {
		setInterval(() => checkTerritories(territoryChannel, territoryUpdateInterval), 1000 * 60 * territoryUpdateInterval);
	}

	if (armouryChannel !== undefined) {
		setInterval(() => checkArmoury(armouryChannel, armouryUpdateInterval), 1000 * 60 * armouryUpdateInterval);
	}

	if (retalChannel !== undefined) {
		setInterval(() => checkRetals(retalChannel, retalUpdateInterval), 1000 * 60 * retalUpdateInterval);
	}

	if (warChannel !== undefined) {
		setInterval(() => checkWar(warChannel, memberChannel, warUpdateInterval), 1000 * 60 * warUpdateInterval);
	}

	if (memberChannel !== undefined) {
		setInterval(() => checkMembers(memberChannel, memberUpdateInterval), 1000 * 60 * memberUpdateInterval);
		setInterval(() => checkOCs(memberChannel, memberUpdateInterval), 1000 * 60 * 60 * memberUpdateInterval);
	}
	
	if (statusChannel !== undefined) {
		setInterval(() => verifyKeys(statusChannel, verificationInterval), 1000 * 60 * 60 * verificationInterval);
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
