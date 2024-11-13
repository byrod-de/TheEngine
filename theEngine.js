const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const os = require('os');
const hostname = os.hostname();

const moment = require('moment');

const { readConfig, cleanChannel, printLog } = require('./helper/misc');
const { checkArmoury, checkRetals, checkWar, checkMembers, checkOCs, sendStatusMsg } = require('./functions/async');
const { verifyKeys } = require('./functions/api');
const { discordConf, botConf, factions } = readConfig();

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

	const statusConf = botConf.status;

	const statusMessage = `Successfully started on ${hostname}! Logged in as ${c.user.tag}`;
	const statusChannel = client.channels.cache.get(statusConf.channelId);

	if (statusChannel) {
		sendStatusMsg(statusChannel, statusConf.updateInterval, statusMessage, startUpTime);
		setInterval(() => sendStatusMsg(statusChannel, statusConf.updateInterval, startUpTime), 1000 * 60 * statusConf.updateInterval);
	}

	let jsonData;
	let activityPool;
	try {
		jsonData = JSON.parse(fs.readFileSync('./conf/activityPool.json'));
		activityPool = jsonData.activity;
	} catch (error) {
		printLog("Error reading activityPool from file system.");
	}


	if (!activityPool) {
		printLog("No activityPool found.");
		return;
	}
	const randomActivity = activityPool[Math.floor(Math.random() * activityPool.length)]
	console.log(randomActivity.name);

	client.user.setPresence({
		activities: [{ name: randomActivity.name, type: randomActivity.type }],
		status: "online",
	});
});

client.on('ready', () => {

	const verificationConf = botConf.verification;
	const verificationChannel = client.channels.cache.get(verificationConf.channelId);

	if (verificationChannel) {
		setInterval(() => verifyKeys(verificationChannel, verificationConf.updateInterval), 1000 * 60 * 60 * verificationConf.updateInterval);
	}

	for (const factionId in factions) {
		if (factions.hasOwnProperty(factionId)) {
			const factionConfig = factions[factionId];
			printLog(`${factionId} > faction found: ${factionConfig.name}`);

			const channels = {
				armoury: client.channels.cache.get(factionConfig.channels.armouryChannelId),
				member: client.channels.cache.get(factionConfig.channels.memberChannelId),
				travel: client.channels.cache.get(factionConfig.channels.travelChannelId),
				retal: client.channels.cache.get(factionConfig.channels.retalChannelId),
				rankedWar: client.channels.cache.get(factionConfig.channels.rankedWarChannelId),
			};

			if (channels.member) {
				const memberUpdateInterval = factionConfig.updateIntervals.member || 5;
				setInterval(() => checkMembers(channels.member, memberUpdateInterval, factionId), 1000 * 60 * memberUpdateInterval);
				setInterval(() => checkOCs(channels.member, memberUpdateInterval, factionId), 1000 * 60 * memberUpdateInterval);
			}

			if (channels.armoury) {
				const armouryUpdateInterval = factionConfig.updateIntervals.armoury || 5;
				setInterval(() => checkArmoury(channels.armoury, factionId), 1000 * 60 * armouryUpdateInterval);
			}

			if (channels.retal) {
				const retalUpdateInterval = factionConfig.updateIntervals.retal || 5;
				setInterval(() => checkRetals(channels.retal, factionId), 1000 * 60 * retalUpdateInterval);
			}

			let isTravelInformationRunning = false;

			if (channels.rankedWar) {
				const rankedWarUpdateInterval = factionConfig.updateIntervals.rankedWar || 5;
				if (channels.travel && (channels.travel.id !== channels.rankedWar.id)) {
					cleanChannel(channels.travel);
				}
				if (channels.rankedWar) {
					cleanChannel(channels.rankedWar);
				}
				setInterval(() => {
					if (!isTravelInformationRunning) {
						isTravelInformationRunning = true;
						checkWar(channels.rankedWar, channels.member, rankedWarUpdateInterval, channels.travel, factionId)
							.finally(() => {
								isTravelInformationRunning = false;
							});
					}
				}, 1000 * 60 * rankedWarUpdateInterval);
			}
		}
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

client.login(discordConf.token).catch(console.error);
