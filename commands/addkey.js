const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { comment } = require('../config.json');

var misc = require('../helper/misc');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('addkey')
        .setDescription('Add your API key to the configuration.')
        .addStringOption(option =>
            option.setName('mykey')
                .setDescription('Torn API Key')
                .setRequired(true)),

    async execute(interaction) {
        //Get Dicord ID of the user executing the command
        const userID = interaction.user.id;
        const mykey = interaction.options.getString('mykey');

        //Check entered API key if valid
        let checkAPIKey = misc.checkAPIKey(mykey);
        if (checkAPIKey.includes('Error')) {
            await interaction.reply(`\`\`\`${checkAPIKey}\`\`\``);

        } else {

            let playerURL = `https://api.torn.com/user/${userID}?selections=basic,discord&key=${mykey}&comment=${comment}`;
            printLog(` > ${playerURL}`);

            let playerResponse = await fetch(playerURL);

            if (playerResponse.ok) { // if HTTP-status is 200-299

                let playerJson = await playerResponse.json();

                if (playerJson.hasOwnProperty('error')) {
                    if (playerJson['error'].code === 6) {
                        await interaction.reply(`\`\`\`User ${interaction.user.username} is not verified on Torn.\`\`\``);
                    } else {
                        await interaction.reply(`\`\`\`Error Code ${playerJson['error'].code},  ${playerJson['error'].error}.\`\`\``)
                    }
                } else {
                    let tornUser = playerJson['name'];
                    let tornId = playerJson['player_id'];
                    let discordID = playerJson['discord']['discordID'];

                    if (discordID !== userID) {
                        await interaction.reply(`\`\`\`This is not your API key!\`\`\``)
                    } else {

                        let keycheckURL = `https://api.torn.com/key/?selections=info&key=${mykey}`;

                        let keycheckResponse = await fetch(keycheckURL);

                        if (keycheckResponse.ok) { // if HTTP-status is 200-299
                            let keycheckJson = await keycheckResponse.json();

                            let access_level = keycheckJson['access_level'];
                            let access_type = keycheckJson['access_type'];

                            const jsonText = `{
                                "keyinfo": {
                                    "userID": "${userID}",
                                    "tornUser": "${tornUser}",
                                    "tornId": "${tornId}",
                                    "mykey": "${mykey}",
                                    "access_level": "${access_level}",
                                    "access_type": "${access_type}"
                                }
                              }`;

                            misc.storeAPIKey(jsonText);

                            await interaction.reply(`\`\`\`\n${userID}\n${tornUser}\n${tornId}\n${access_level}\n${access_type}\n${mykey}\`\`\``)
                        }
                    }
                }
            }
        }
    }
}