const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const os = require('os');
const hostname = os.hostname();

const cron = require('node-cron');

const moment = require('moment');

const { readConfig, cleanChannel } = require('./helper/misc');
const { checkTerritories, checkArmoury, checkRetals, checkWar, checkMembers, checkOCs, sendStatusMsg, getMemberContributions, memberStats } = require('./functions/async');
const { getTornEvents } = require('./functions/async.torn');
const { verifyKeys } = require('./functions/api');
const { discordConf, statusConf, territoryConf, armouryConf, retalConf, travelConf, rankedWarConf, memberConf, verificationConf, tornDataConf } = readConfig();

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

	// Schedule getMemberContributions to run daily at 00:00 and 12:00
	cron.schedule('0 0,12 * * *', async () => {
		console.log('Running getMemberContributions task...');
		await getMemberContributions();
	});

	// Schedule memberStats to run daily at 00:00
	cron.schedule('0 0 * * *', async () => {
	//	cron.schedule('*/5 * * * *', async () => {

		const channels = { member: client.channels.cache.get(memberConf.channelId), };

		if (channels.member) {
			console.log('Running memberStats task...');
			await memberStats(channels.member, undefined);
		}
	});
});

client.on('ready', () => {
	const channels = {
		territory: client.channels.cache.get(territoryConf.channelId),
		armoury: client.channels.cache.get(armouryConf.channelId),
		member: client.channels.cache.get(memberConf.channelId),
		travel: client.channels.cache.get(travelConf.channelId),
		retal: client.channels.cache.get(retalConf.channelId),
		rankedWar: client.channels.cache.get(rankedWarConf.channelId),
		verification: client.channels.cache.get(verificationConf.channelId),
		torndata: client.channels.cache.get(tornDataConf.channelId),
	};

	if (channels.territory) {
		setInterval(() => checkTerritories(channels.territory, territoryConf.updateInterval), 1000 * 60 * territoryConf.updateInterval);
	}

	if (channels.armoury) {
		setInterval(() => checkArmoury(channels.armoury, armouryConf.updateInterval), 1000 * 60 * armouryConf.updateInterval);
	}

	if (channels.retal) {
		cleanChannel(channels.retal);
		setInterval(() => checkRetals(channels.retal, retalConf.updateInterval), 1000 * 60 * retalConf.updateInterval);
	}

	let isTravelInformationRunning = false;

	if (channels.rankedWar) {
		if (channels.travel && (channels.travel.id !== channels.rankedWar.id)) {
			cleanChannel(channels.travel);
		}
		if (channels.rankedWar) {
			cleanChannel(channels.rankedWar);
		}
		setInterval(() => {
			if (!isTravelInformationRunning) {
				isTravelInformationRunning = true;
				checkWar(channels.rankedWar, channels.member, rankedWarConf.updateInterval, channels.travel)
					.finally(() => {
						isTravelInformationRunning = false;
					});
			}
		}, 1000 * 60 * rankedWarConf.updateInterval);
	}

	if (channels.member) {
		setInterval(() => checkMembers(channels.member, memberConf.updateInterval), 1000 * 60 * memberConf.updateInterval);
		setInterval(() => checkOCs(channels.member, memberConf.updateInterval), 1000 * 60 * 60 * memberConf.updateInterval);
	}

	if (channels.verification) {
		setInterval(() => verifyKeys(channels.verification, verificationConf.updateInterval), 1000 * 60 * 60 * verificationConf.updateInterval);
	}

	if (channels.torndata) {
		setInterval(() => getTornEvents(channels.torndata, tornDataConf.updateInterval), 1000 * 60 * tornDataConf.updateInterval);
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
