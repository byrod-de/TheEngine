const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { apiKey, comment} = require('../config.json');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('verify')
		.setDescription('Verify user towards Torn API.'),

	async execute(interaction) {

        let discordID = interaction.user.id;

		let vfURL = `https://api.torn.com/user/${discordID}?selections=basic,discord&key=${apiKey}&comment=${comment}`;
        console.log(` > ${vfURL}`);

        let vfResponse = await fetch(vfURL);

        if (vfResponse.ok) { // if HTTP-status is 200-299

            let cooldownsJson = await vfResponse.json();
            let tornUser = cooldownsJson['name'];
            let tornId = cooldownsJson['player_id'];

            let member = await interaction.guild.members.fetch(discordID);
            //member.setNickname(`${tornUser} [${tornId}]`);

            await interaction.reply(`\`\`\`This command was run by ${interaction.user.username} [${interaction.user.id}], who is joined on ${tornUser} [${tornId}] on Torn.\`\`\``);
            
        }
	},
};
