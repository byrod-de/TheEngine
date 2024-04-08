const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { formatDiscordTimeWithOffset } = require('../helper/formattings');
const { readConfig } = require('../helper/misc');
const { embedColor } = readConfig().discordConf;

const he = require('he');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cooldowns')
        .setDescription('Returns your Torn cooldowns! You need to store a key with Minimal Access first.'),

    async execute(interaction) {
        const response = await callTornApi('user', 'basic,bars,cooldowns,profile,timestamp');

        if (response[0]) {
            const cooldownsJson = response[2];
            const apiTime = cooldownsJson['timestamp'];
            const ts = new Date(apiTime * 1000);

            const { formattedTime: drugTimeFormatted, relativeTime: drugTimeR } = formatDiscordTimeWithOffset(apiTime, cooldownsJson['cooldowns']['drug']);
            const { formattedTime: medicalTimeFormatted, relativeTime: medicalTimeR } = formatDiscordTimeWithOffset(apiTime, cooldownsJson['cooldowns']['medical']);
            const { formattedTime: boosterTimeFormatted, relativeTime: boosterTimeR } = formatDiscordTimeWithOffset(apiTime, cooldownsJson['cooldowns']['booster']);

            const { formattedTime: energyFullTimeFormatted, relativeTime: energyFullTimeR } = formatDiscordTimeWithOffset(apiTime, cooldownsJson['energy']['fulltime']);
            const { formattedTime: nerveFullTimeFormatted, relativeTime: nerveFullTimeR } = formatDiscordTimeWithOffset(apiTime, cooldownsJson['nerve']['fulltime']);
            const { formattedTime: lifeFullTimeFormatted, relativeTime: lifeFullTimeR } = formatDiscordTimeWithOffset(apiTime, cooldownsJson['life']['fulltime']);

            const energyCur = cooldownsJson['energy']['current'];
            const energyMax = cooldownsJson['energy']['maximum'];
            const nerveCur = cooldownsJson['nerve']['current'];
            const nerveMax = cooldownsJson['nerve']['maximum'];
            const lifeCur = cooldownsJson['life']['current'];
            const lifeMax = cooldownsJson['life']['maximum'];

            const tornUser = cooldownsJson['name'];
            const tornId = cooldownsJson['player_id'];
            const position = cooldownsJson['faction']['position'];
            const faction_name = he.decode(cooldownsJson['faction']['faction_name']);
            const faction_tag = cooldownsJson['faction']['faction_tag'];
            const faction_id = cooldownsJson['faction']['faction_id'];
            let faction_icon = 'https://tornengine.netlify.app/images/logo-100x100.png';

            if (faction_id !== 0) {
                const responseFaction = await callTornApi('faction', 'basic', faction_id);
                if (responseFaction[0]) {
                    const factionJson = responseFaction[2];
                    faction_icon = `https://factiontags.torn.com/` + factionJson['tag_image'];
                }
            }

            const cooldownEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${tornUser} [${tornId}]`)
                .setURL(`https://www.torn.com/profiles.php?XID=${tornId}`)
                .setAuthor({ name: `${position} of ${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                .setDescription(`Cooldowns`)
                .setTimestamp(ts)
                .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });

            cooldownEmbed.addFields(
                { name: 'Drug CD', value: `${drugTimeFormatted} ${drugTimeR}`, inline: false },
                { name: 'Medical CD', value: `${medicalTimeFormatted} ${medicalTimeR}`, inline: false },
                { name: 'Booster CD', value: `${boosterTimeFormatted} ${boosterTimeR}`, inline: false },
                { name: 'Energy', value: `[ ${energyCur} | ${energyMax}]\n${energyFullTimeFormatted} ${energyFullTimeR}`, inline: false },
                { name: 'Nerve', value: `[ ${nerveCur} | ${nerveMax}]\n${nerveFullTimeFormatted} ${nerveFullTimeR}`, inline: false },
                { name: 'Life', value: `[ ${lifeCur} | ${lifeMax}]\n${lifeFullTimeFormatted} ${lifeFullTimeR}`, inline: false }
            );

            await interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
        } else {
            await interaction.reply({ content: response[1], ephemeral: true });
        }
    },
};
