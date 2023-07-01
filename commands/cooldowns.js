const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('cooldowns')
        .setDescription('Returns your Torn cooldowns! You need to store a key with Minimal Access first.'),

    async execute(interaction) {

        let response = await callTornApi('user', 'basic,bars,cooldowns,profile,timestamp');

        if (response[0]) {
            let cooldownsJson = response[2];

            let tornUser = cooldownsJson['name'];
            let tornId = cooldownsJson['player_id'];

            let apiTime = cooldownsJson['timestamp'];
            let ts = new Date(apiTime * 1000);

            let position = cooldownsJson['faction']['position'];
            let faction_name = cooldownsJson['faction']['faction_name'];
            let faction_tag = cooldownsJson['faction']['faction_tag'];
            let faction_id = cooldownsJson['faction']['faction_id'];

            let faction_icon = 'https://tornengine.netlify.app/images/logo-100x100.png';

            if (faction_id != 0) {
                let responseFaction = await callTornApi('faction', 'basic', faction_id);

                if (responseFaction[0]) {
                    let factionJson = responseFaction[2];
                    faction_icon = `https://factiontags.torn.com/` + factionJson['tag_image'];
                }
            }

            let cooldownEmbed = new EmbedBuilder()
                .setColor(0xdf691a)
                .setTitle(`${tornUser} [${tornId}]`)
                .setURL(`https://www.torn.com/profiles.php?XID=${tornId}`)
                .setAuthor({ name: `${position} of ${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                .setDescription(`Cooldowns`)
                .setTimestamp(ts)
                .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });;

            let drugCD = cooldownsJson['cooldowns']['drug'];
            let drugTime = apiTime + drugCD;
            ts = new Date(drugTime * 1000);
            let drugTimeFormatted = `<t:${drugTime}:f>`;
            let drugTimeR = `<t:${drugTime}:R>`;
            if (drugCD == 0) {
                drugTimeFormatted = ' > no cooldown';
                drugTimeR = '';
            }

            let medicalCD = cooldownsJson['cooldowns']['medical'];
            let medicalTime = apiTime + medicalCD;
            ts = new Date(medicalTime * 1000);
            let medicalTimeFormatted = `<t:${medicalTime}:f>`;
            let medicalTimeR = `<t:${medicalTime}:R>`;
            if (medicalCD == 0) {
                medicalTimeFormatted = ' > no cooldown';
                medicalTimeR = '';
            }

            let boosterCD = cooldownsJson['cooldowns']['booster'];
            let boosterTime = apiTime + boosterCD;
            ts = new Date(boosterTime * 1000);
            let boosterTimeFormatted = `<t:${boosterTime}:f>`;
            let boosterTimeR = `<t:${boosterTime}:R>`;
            if (boosterCD == 0) {
                boosterTimeFormatted = ' > no cooldown';
                boosterTimeR = '';
            }

            cooldownEmbed.addFields({ name: 'Drug CD', value: `${drugTimeFormatted} ${drugTimeR}`, inline: false });
            cooldownEmbed.addFields({ name: 'Medical CD', value: `${medicalTimeFormatted} ${medicalTimeR}`, inline: false });
            cooldownEmbed.addFields({ name: 'Booster CD', value: `${boosterTimeFormatted} ${boosterTimeR}`, inline: false });

            let energyCur = cooldownsJson['energy']['current'];
            let energyMax = cooldownsJson['energy']['maximum'];
            let energyFull = cooldownsJson['energy']['fulltime'];
            let energyFullTime = apiTime + energyFull;
            ts = new Date(energyFullTime * 1000);
            let energyFullTimeFormatted = `<t:${energyFullTime}:f>`;
            let energyFullTimeR = `<t:${energyFullTime}:R>`;
            if (energyFull == 0) {
                energyFullTimeFormatted = ' > full';
                energyFullTimeR = '';
            }

            let nerveCur = cooldownsJson['nerve']['current'];
            let nerveMax = cooldownsJson['nerve']['maximum'];
            let nerveFull = cooldownsJson['nerve']['fulltime'];
            let nerveFullTime = apiTime + nerveFull;
            ts = new Date(nerveFullTime * 1000);
            let nerveFullTimeFormatted = `<t:${nerveFullTime}:f>`;
            let nerveFullTimeR = `<t:${nerveFullTime}:R>`;
            if (nerveFull == 0) {
                nerveFullTimeFormatted = ' > full';
                nerveFullTimeR = '';
            }

            let lifeCur = cooldownsJson['life']['current'];
            let lifeMax = cooldownsJson['life']['maximum'];
            let lifeFull = cooldownsJson['life']['fulltime'];
            let lifeFullTime = apiTime + nerveFull;
            ts = new Date(lifeFullTime * 1000);
            let lifeFullTimeFormatted = `<t:${lifeFullTime}:f>`;
            let lifeFullTimeR = `<t:${lifeFullTime}:R>`;
            if (lifeFull == 0) {
                lifeFullTimeFormatted = ' > full';
                lifeFullTimeR = '';
            }

            cooldownEmbed.addFields({ name: 'Energy', value: `[ ${energyCur} | ${energyMax}]\n${energyFullTimeFormatted} ${energyFullTimeR}`, inline: false });
            cooldownEmbed.addFields({ name: 'Nerve', value: `[ ${nerveCur} | ${nerveMax}]\n${nerveFullTimeFormatted} ${nerveFullTimeR}`, inline: false });
            cooldownEmbed.addFields({ name: 'Life', value: `[ ${lifeCur} | ${lifeMax}]\n${lifeFullTimeFormatted} ${lifeFullTimeR}`, inline: false });

            await interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
        } else {
            await interaction.reply({ content: response[1], ephemeral: true });
        }

    },
};
