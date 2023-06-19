const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { token, statusChannelId, territoryChannelId, apiKey, comment } = require('./config.json');
const { ttFactionIDs } = require('./tornParams.json');

const moment = require('moment');
const os = require('os');
const hostname = os.hostname();

const NodeCache = require("node-cache");
const myCache = new NodeCache();

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
	console.log(statusMessage);
	let statusChannel = client.channels.cache.get(statusChannelId);
	if (statusChannel !== undefined) {
		statusChannel.send(`\`\`\`${statusMessage}\`\`\``);
		setInterval(send_msg, 1000 * 60 * 60);
	}

	client.user.setPresence({
		activities: [{ name: "running wild" }],
		status: "online",
	})
});

client.on('ready', () => {
	let territoryChannel = client.channels.cache.get(territoryChannelId);
	if (territoryChannel !== undefined) {
		let statusMessage = `Started Checking TT changes for ${ttFactionIDs}!`;
		territoryChannel.send(`\`\`\`${statusMessage}\`\`\``);
		setInterval(checkTerritories, 1000 * 60);
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


async function send_msg() {
	let currentDate = moment().format().replace('T', ' ');
	let statusMessage = `Still running on ${hostname}! ${currentDate}`;
	let statusChannel = client.channels.cache.get(statusChannelId);

	let apiURL = `https://api.torn.com/torn/?selections=timestamp&key=${apiKey}&comment=${comment}`;
	//console.log(` > ${apiURL}`);

	let apiResponse = await fetch(apiURL);

	if (apiResponse.ok) { // if HTTP-status is 200-299

		let apiJson = await apiResponse.json();

		if (apiJson.hasOwnProperty('error')) {
			statusMessage = statusMessage + `\nError Code ${apiJson['error'].code},  ${apiJson['error'].error}.`;
		} else {
			statusMessage = statusMessage + `\nTorn API available!`;
		}
	} else {
		statusMessage = statusMessage + `\nGeneral http error.`;
	}

	statusChannel.send(`\`\`\`${statusMessage}\`\`\``);
}

async function checkTerritories() {
	for (let i = 0; i < ttFactionIDs.length; ++i) {
		let faction_id = ttFactionIDs[i];

		let currentDate = moment().format().replace('T', ' ');
		let territoryChannel = client.channels.cache.get(territoryChannelId);

		let territoryURL = `https://api.torn.com/faction/${faction_id}?selections=territory,basic&key=${apiKey}&comment=${comment}`;
		console.log(` > ${territoryURL}`);

		let territoryResponse = await fetch(territoryURL);

		if (territoryResponse.ok) { // if HTTP-status is 200-299

			let territoryJson = await territoryResponse.json();

			if (territoryJson.hasOwnProperty('error')) {
				territoryChannel.send(`Error Code ${territoryJson['error'].code},  ${territoryJson['error'].error}.`);
			} else {
				let faction_name = territoryJson['name'];
				let faction_tag = territoryJson['tag'];
				let faction_icon = `https://factiontags.torn.com/` + territoryJson['tag_image'];


				let territoryEmbed = new EmbedBuilder()
					.setColor(0xdf691a)
					.setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
					.setTimestamp()
					.setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

				let territories = territoryJson ? Object.keys(territoryJson.territory).sort() : null;
				if (!territories || territories.length <= 0) {
					return;
				}

				let cachedTTs = myCache.get(faction_id);
				if (cachedTTs !== undefined) {

					let diffInCache = cachedTTs.filter(x => !territories.includes(x));

					if (diffInCache.length > 0)
						territoryEmbed.addFields({ name: 'Abandoned', value: `${faction_name} abandoned ${diffInCache.toString()}.`, inline: false })

					let diffInTTs = territories.filter(x => !cachedTTs.includes(x));
					if (diffInTTs.length > 0)
						territoryEmbed.addFields({ name: 'Claimed', value: `${faction_name} claimed ${diffInTTs.toString()}.`, inline: false })


					if (diffInCache.length > 0 || diffInTTs.length > 0) {
						territoryChannel.send({ embeds: [territoryEmbed], ephemeral: false })
					};

				} else {
					console.log('Cache empty');
				}

				if (myCache.set(faction_id, territories, 120)) console.log(territories + ' added to cache');
			}
		} else {
			territoryChannel.send(`General http error.`);
		}
	}
}

client.login(token);
