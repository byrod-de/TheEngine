const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { getUsersByRole } = require('../functions/async');
const { initializeEmbed, readConfig } = require('../helper/misc');
const homeFaction = readConfig().apiConf.homeFaction;


module.exports = {
    data: new SlashCommandBuilder()
        .setName('check_role')
        .setDescription('List members with specific role!'),

    async execute(interaction) {
        const { guild } = interaction;

        const botMember = guild.members.cache.get('1101599520493666354'); // Get the bot's GuildMember object

        if (botMember.permissions.has('VIEW_AUDIT_LOG')) {
            console.log('Bot has permission to list members in the guild.');
        } else {
            console.log('Bot does not have permission to list members in the guild.');
            const roleEmbed = initializeEmbed('Role Check', 'error')
                .setDescription('I don\'t have permission to list members in the guild. Please give me permission to view audit logs.');
            await interaction.reply({ embeds: [roleEmbed], ephemeral: false });
            return;
        }

        try {
            const rolename = '';

            const members = await getUsersByRole(guild, rolename);
            console.log(members);

            if (members.length != 0) {
                for (const user of members) {
                    console.log(user.id, user.username);
                }
            }

            const memberNames = members
                .map((user) => user.username)
                .sort((a, b) => a.localeCompare(b))
                .join('\n');

            const roleEmbed = initializeEmbed('Role Check')
                .setDescription(`Members with role ${rolename}:\n${memberNames}`);
            await interaction.reply({ embeds: [roleEmbed], ephemeral: false });
        } catch (error) {
            console.error('Error fetching guild members:', error);
            const roleEmbed = initializeEmbed('Role Check', 'error')
                .setDescription('An error occurred while fetching guild members.');
            await interaction.reply({ embeds: [roleEmbed], ephemeral: false });
        }
    },
};