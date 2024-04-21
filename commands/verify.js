const { SlashCommandBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { printLog, readConfig } = require('../helper/misc');

const { verifieRoleId } = readConfig().discordConf;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify a user towards Torn API!')
        .addIntegerOption(option =>
            option.setName('tornid')
                .setDescription('Torn user ID.')),

    async execute(interaction) {

        const userID = interaction.options.getInteger('tornid') ?? interaction.user.id;

        let response = await callTornApi('user', 'basic,discord', userID);

        if (response[0]) {
            let memberJson = response[2];

            let tornUser = memberJson['name'];
            let tornId = memberJson['player_id'];
            let discordID = memberJson['discord']['discordID'];

            if (discordID.length > 10) {

                try {
                    let member = await interaction.guild.members.fetch(discordID);
                    member.setNickname(`${tornUser} [${tornId}]`);
                    member.roles.add(verifieRoleId);
                    printLog(`${tornUser} [${tornId}] verified on Torn.`);
                    await interaction.reply(`\`\`\`This command was run by ${interaction.user.username}, member was verified as ${tornUser} [${tornId}] on Torn.\`\`\``);

                } catch (e) {
                    printLog(`Some error occured: ${e}`);
                    await interaction.reply(`\`\`\`Some error occured: ${e}\`\`\``);

                }
            }
        } else {
            await interaction.reply({ content: response[1], ephemeral: true });
        }
    },
};
