const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, statusChannelId, statusGuildId } = require('./config.json');
const moment = require('moment');
const os = require('os');
const hostname = os.hostname();

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
	let currentDate = moment().format().replace('T',' ');
	let statusMessage = `Successfully started on ${hostname}! Logged in as ${c.user.tag} at ${currentDate}`;
	console.log(statusMessage);
	let statusChannel = client.channels.cache.get(statusChannelId);
	statusChannel.send(`\`\`\`${statusMessage}\`\`\``);

	if (statusChannel !== undefined) {
		setInterval(send_msg, 1000 * 60 * 15);
	}

	client.user.setPresence({
    activities: [{ name: "running wild" }],
    status: "online",
  })
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
	let currentDate = moment().format().replace('T',' ');
	let statusMessage = `Still running on ${hostname}! ${currentDate}`;
	let statusChannel = client.channels.cache.get(statusChannelId);

	statusChannel.send(`\`\`\`${statusMessage}\`\`\``);
}



client.login(token);
