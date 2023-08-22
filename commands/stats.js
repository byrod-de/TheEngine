const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { numberWithCommas, addSign } = require('../helper/formattings');
const he = require('he');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Returns your Torn stats! You need to store a key with Minimal Access first.'),

    async execute(interaction) {

        let response = await callTornApi('user', 'basic,battlestats,profile,timestamp');

        if (response[0]) {
            let statsJson = response[2];

            let tornUser = statsJson['name'];
            let tornId = statsJson['player_id'];

            let position = statsJson['faction']['position'];
            let faction_name = he.decode(statsJson['faction']['faction_name']);
            let faction_tag = statsJson['faction']['faction_tag'];
            let faction_id = statsJson['faction']['faction_id'];

            let faction_icon = 'https://tornengine.netlify.app/images/logo-100x100.png';

            if (faction_id != 0) {
                let responseFaction = await callTornApi('faction', 'basic', faction_id);

                if (responseFaction[0]) {
                    let factionJson = responseFaction[2];
                    faction_icon = `https://factiontags.torn.com/` + factionJson['tag_image'];
                }
            }

            let apiTime = statsJson['timestamp'];
            let ts = new Date(apiTime * 1000);

            let statsEmbed = new EmbedBuilder()
                .setColor(0xdf691a)
                .setTitle(`${tornUser} [${tornId}]`)
                .setURL(`https://www.torn.com/profiles.php?XID=${tornId}`)
                .setAuthor({ name: `${position} of ${faction_tag} -  ${faction_name}`, iconURL: faction_icon, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                .setDescription(`Battle Stats`)
                .setTimestamp(ts)
                .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });;

            let strength = statsJson['strength'];
            let speed = statsJson['speed'];
            let dexterity = statsJson['dexterity'];
            let defense = statsJson['defense'];
            let total = statsJson['total'];

            let strength_modifier = statsJson['strength_modifier'];
            let defense_modifier = statsJson['defense_modifier'];
            let speed_modifier = statsJson['speed_modifier'];
            let dexterity_modifier = statsJson['dexterity_modifier'];

            let effective_strength = Math.floor(strength * (1 + strength_modifier / 100));
            let effective_defense = Math.floor(defense * (1 + defense_modifier / 100));
            let effective_speed = Math.floor(speed * (1 + speed_modifier / 100));
            let effective_dexterity = Math.floor(dexterity * (1 + dexterity_modifier / 100));
            let effective_total = effective_strength + effective_defense + effective_dexterity + effective_speed;




            statsEmbed.addFields({
                name: 'Battlestats',
                value: `\`Strength  : ${numberWithCommas(strength).toString().padStart(21)}\` ${addSign(strength_modifier)}%\n` +
                    `\`Defense   : ${numberWithCommas(defense).toString().padStart(21)}\` ${addSign(defense_modifier)}%\n` +
                    `\`Speed     : ${numberWithCommas(speed).toString().padStart(21)}\` ${addSign(speed_modifier)}%\n` +
                    `\`Dexterity : ${numberWithCommas(dexterity).toString().padStart(21)}\` ${addSign(dexterity_modifier)}%\n` +
                    `\`Total     : ${numberWithCommas(total).toString().padStart(21)}\`\n`
                , inline: false
            });

            statsEmbed.addFields({
                name: 'Effective Stats',
                value: `\`Strength  : ${numberWithCommas(effective_strength).toString().padStart(21)}\`\n` +
                    `\`Defense   : ${numberWithCommas(effective_defense).toString().padStart(21)}\`\n` +
                    `\`Speed     : ${numberWithCommas(effective_speed).toString().padStart(21)}\`\n` +
                    `\`Dexterity : ${numberWithCommas(effective_dexterity).toString().padStart(21)}\`\n` +
                    `\`Total     : ${numberWithCommas(effective_total).toString().padStart(21)}\`\n`
                , inline: false
            });

            await interaction.reply({ embeds: [statsEmbed], ephemeral: true });

        } else {
            await interaction.reply({ content: response[1], ephemeral: true });
        }
    },
};
