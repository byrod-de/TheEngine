const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('jokes')
		.setDescription('Tell a joke...'),

	async execute(interaction) {
	    let apiURL = 'https://api.chucknorris.io/jokes/random';
        console.log(` > ${apiURL}`);

        let apiResponse = await fetch(apiURL);

        if (apiResponse.ok) { // if HTTP-status is 200-299
            // get the response body (the method explained below)
            let jsonResponse = await apiResponse.json();
            let response = jsonResponse['value'].replace("Chuck", "King").replace("Norris", "Lion");
            await interaction.reply({ content: `${response}`, ephemeral: false });
        }
	},
};
