const { SlashCommandBuilder } = require('discord.js');
const { apiKey, comment, verifieRoleId} = require('../config.json');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('verify')
		.setDescription('Verify user towards Torn API.')
        .addIntegerOption(option =>
            option.setName('tornid')
                .setDescription('Torn user ID.')),

	async execute(interaction) {

        const userID = interaction.options.getInteger('tornid') ?? interaction.user.id;

		let vfURL = `https://api.torn.com/user/${userID}?selections=basic,discord&key=${apiKey}&comment=${comment}`;
        console.log(` > ${vfURL}`);

        let vfResponse = await fetch(vfURL);

        if (vfResponse.ok) { // if HTTP-status is 200-299

            let memberJson = await vfResponse.json();

            if (memberJson.hasOwnProperty('error')){
                if (memberJson['error'].code === 6) {
                    await interaction.reply(`\`\`\`User ${interaction.user.username} is not verified on Torn.\`\`\``);
                } else {
                    await interaction.reply(`\`\`\`Error Code ${memberJson['error'].code},  ${memberJson['error'].error}.\`\`\``)
                }
            } else {

            let tornUser = memberJson['name'];
            let tornId = memberJson['player_id'];
            let discordID = memberJson['discord']['discordID'];

            if (discordID.length > 10) {
                let member = await interaction.guild.members.fetch(discordID);
                member.roles.add(verifieRoleId);
 
                try {
                    member.setNickname(`${tornUser} [${tornId}]`);
                } catch (e) {
                    console.log(e);
                } 
            }

            await interaction.reply(`\`\`\`This command was run by ${interaction.user.username}, member was verified as ${tornUser} [${tornId}] on Torn.\`\`\``);
            }
        }
	},
};
