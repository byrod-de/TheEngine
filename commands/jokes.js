const { SlashCommandBuilder } = require('discord.js');
const { printLog } = require('../helper/misc');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('jokes')
		.setDescription('Tells a joke... no guarantee it is funny, though.'),

	async execute(interaction) {
	    let apiURL = 'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=single';
        printLog(apiURL);

        let apiResponse = await fetch(apiURL);

        if (apiResponse.ok) { // if HTTP-status is 200-299
            // get the response body (the method explained below)
            let jsonResponse = await apiResponse.json();
            let response = jsonResponse['joke'].replace("Chuck", "King").replace("Norris", "Lion");
            await interaction.reply({ content: `${response}`, ephemeral: false });
        }
	},
};
