const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./conf/config.json');
const fs = require('node:fs');
const { printLog } = require('./helper/misc');


const commands = [];
// Grab all the command files from the commands directory you created earlier
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const activeModules = fs.readFileSync('./conf/activeModules.conf', 'utf8');


// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
	if (!activeModules.includes(file)) {
		console.log(`${file} --> Skipped...`);
		continue;
	}
	console.log(`Deploying --> ${file}`);
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(token);

// and deploy your commands!
(async () => {
	try {
		printLog(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		printLog(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();
