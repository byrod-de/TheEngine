const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const yaml = require('yaml');

const { printLog } = require('./helper/misc');

const commands = [];
// Grab all the command files from the commands directory you created earlier
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const activeModules = fs.readFileSync('./conf/activeModules.conf', 'utf8');

let discordConf;

try {
	const config = yaml.parse(fs.readFileSync('./conf/config.yaml', 'utf8'));
	discordConf = config.discordConf;
} catch (e) {
	console.log(e);
}


// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
	if (!activeModules.includes(file)) {
		console.log(`Skipped....... ${file}`);
		continue;
	}
	console.log(`${String.fromCharCode(0x2713)} Deploying: ${file}`);
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(discordConf.token);

// and deploy your commands!
(async () => {
	try {
		printLog(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(discordConf.clientId, discordConf.guildId),
			{ body: commands },
		);

		printLog(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();
