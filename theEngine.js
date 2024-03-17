const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const os = require('os');
const hostname = os.hostname();

const moment = require('moment');
const NodeCache = require("node-cache");
const startUpCache = new NodeCache();

const { readConfig } = require('./helper/misc');
const { checkTerritories, checkArmoury, checkRetals, checkWar, checkMembers, checkOCs, sendStatusMsg } = require('./functions/async');
const { verifyKeys } = require('./functions/api');
const { discordConf, statusConf, territoryConf, armouryConf, retalConf, rankedWarConf, memberConf, verificationConf } = readConfig();

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
	let startUpTime = moment().format().replace('T', ' ');

	const statusMessage = `Successfully started on ${hostname}! Logged in as ${c.user.tag}`;

	const statusChannel = client.channels.cache.get(statusConf.channelId);

	if (statusChannel !== undefined) {
		sendStatusMsg(statusChannel, statusConf.updateInterval, statusMessage, startUpTime);
		setInterval(() => sendStatusMsg(statusChannel, statusConf.updateInterval, startUpTime), 1000 * 60 * statusConf.updateInterval);
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

	const territoryChannel = client.channels.cache.get(territoryConf.channelId);
	const armouryChannel = client.channels.cache.get(armouryConf.channelId);
	const memberChannel = client.channels.cache.get(memberConf.channelId);
	const retalChannel = client.channels.cache.get(retalConf.channelId);
	const rankedWarChannel = client.channels.cache.get(rankedWarConf.channelId);
	const verificationChannel = client.channels.cache.get(verificationConf.channelId);

	if (territoryChannel !== undefined) {
		setInterval(() => checkTerritories(territoryChannel, territoryConf.updateInterval), 1000 * 60 * territoryConf.updateInterval);
	}

	if (armouryChannel !== undefined) {
		setInterval(() => checkArmoury(armouryChannel, armouryConf.updateInterval), 1000 * 60 * armouryConf.updateInterval);
	}

	if (retalChannel !== undefined) {
		setInterval(() => checkRetals(retalChannel, retalConf.updateInterval), 1000 * 60 * retalConf.updateInterval);
	}

	if (rankedWarChannel !== undefined) {
		setInterval(() => checkWar(rankedWarChannel, memberChannel, rankedWarConf.updateInterval), 1000 * 60 * rankedWarConf.updateInterval);
	}

	if (memberChannel !== undefined) {
		setInterval(() => checkMembers(memberChannel, memberConf.updateInterval), 1000 * 60 * memberConf.updateInterval);
		setInterval(() => checkOCs(memberChannel, memberConf.updateInterval), 1000 * 60 * 60 * memberConf.updateInterval);
	}
	
	if (verificationChannel !== undefined) {
		setInterval(() => verifyKeys(verificationChannel, verificationConf.updateInterval), 1000 * 60 * 60 * verificationConf.updateInterval);
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

client.login(discordConf.token);
