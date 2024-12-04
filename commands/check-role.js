const { SlashCommandBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { initializeEmbed, readConfig, verifyAdminAccess, logCommandUser, printLog } = require('../helper/misc');

const { factions } = readConfig();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('check-role')
        .setDescription('List members with specific role mismatches by faction!'),

    async execute(interaction) {
        logCommandUser(interaction);

        if (!await verifyAdminAccess(interaction, readConfig().limitedAccessConf)) return;

        const { guild } = interaction; // Get the guild (server) from the interaction
        await interaction.deferReply();

        try {
            // Step 1: Fetch all members from the Discord guild
            const members = await guild.members.fetch();

            // Step 2: Get faction data
            const factionData = {};

            for (const factionId in factions) {
                if (factions.hasOwnProperty(factionId)) {
                    const factionConfig = factions[factionId];
                    const isFactionEnabled = factionConfig.enabled || false;
                    const apiKey = factionConfig.apiKey || null;

                    if (isFactionEnabled && apiKey) {
                        printLog(`${factionId.padStart(5, ' ')} > Faction found: ${factionConfig.name} is ${isFactionEnabled ? 'enabled' : 'disabled'}`);

                        const factionInfo = await callTornApi(
                            'faction',
                            'basic',
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            'external',
                            apiKey
                        );

                        if (factionInfo[0]) {
                            const factionJson = factionInfo[2];
                            const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon_URL } = factionJson;
                            const factionMembers = factionJson.members; // Contains the member list
                            const verifiedRoleId = factionConfig.discordConf.verifieRoleId || null;

                            factionData[factionId] = {
                                name: faction_name,
                                id: faction_id,
                                tag: faction_tag,
                                icon: faction_icon_URL,
                                roleId: verifiedRoleId,
                                members: factionMembers,
                                embedColor: factionConfig.embedColor
                            };
                        }
                    }
                }
            }

            // Step 3: Process mismatches per faction
            const resultsByFaction = {};

            for (const [factionId, factionInfo] of Object.entries(factionData)) {
                resultsByFaction[factionId] = {
                    name: factionInfo.name,
                    id: factionInfo.id,
                    tag: factionInfo.tag,
                    icon: factionInfo.icon,
                    roleId: factionInfo.roleId,
                    notWithRole: [],
                    notInFaction: [],
                    hasRole: [],
                    embedColor: factionInfo.embedColor
                };

                // Check for "Not with Role" and "Has Role"
                for (const member of members.values()) {
                    const displayName = member.displayName || member.user.username;
                    const idMatch = displayName.match(/\[(\d+)\]$/);
                    const extractedId = idMatch ? idMatch[1] : null;

                    if (extractedId && factionInfo.members.hasOwnProperty(extractedId)) {
                        if (!member.roles.cache.has(factionInfo.roleId)) {
                            resultsByFaction[factionId].notWithRole.push(`${member} (${displayName})`);
                        } else {
                            resultsByFaction[factionId].hasRole.push(member.toString()); // Clickable mention
                        }
                    }
                }

                // Check for "Not in Faction"
                for (const member of members.values()) {
                    if (member.roles.cache.has(factionInfo.roleId)) {
                        const displayName = member.displayName || member.user.username;
                        const idMatch = displayName.match(/\[(\d+)\]$/);
                        const extractedId = idMatch ? idMatch[1] : null;

                        if (!extractedId || !factionInfo.members.hasOwnProperty(extractedId)) {
                            resultsByFaction[factionId].notInFaction.push(`${member} (${displayName})`);
                        }
                    }
                }
            }

            // Step 4: Send Responses per Faction
            for (const [factionId, factionResults] of Object.entries(resultsByFaction)) {
                const { name, id, tag, icon, roleId, notWithRole, notInFaction, hasRole, embedColor } = factionResults;
                const faction_icon_URL = `https://factiontags.torn.com/${icon}`;

                // Prepare embeds for the faction
                if (notWithRole.length > 0) {
                    const notWithRoleEmbed = initializeEmbed(`${name} - Discord Members with missing roles`, 'overwrite', embedColor)
                        .setDescription(
                            notWithRole.join('\n').slice(0, 4000) || 'No members found.'
                        )
                        .addFields({ name: 'Role Missing', value: `<@&${roleId}>` })
                        .setAuthor({ name: `${tag} - ${name}`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${id}` });
                    await interaction.channel.send({ embeds: [notWithRoleEmbed] });
                }

                if (notInFaction.length > 0) {
                    const notInFactionEmbed = initializeEmbed(`${name} - Discord Members with role but not in faction`, 'overwrite', embedColor)
                        .setDescription(
                            notInFaction.join('\n').slice(0, 4000) || 'No members found.'
                        )
                        .addFields({ name: 'Role', value: `<@&${roleId}>` })
                        .setAuthor({ name: `${tag} - ${name}`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${id}` });
                    await interaction.channel.send({ embeds: [notInFactionEmbed] });
                }

                if (hasRole.length > 0) {
                    const hasRoleEmbed = initializeEmbed(`${name} - Discord Members with correct role`, 'overwrite', embedColor)
                        .setDescription(
                            hasRole.join('\n').slice(0, 4000) || 'No members found.'
                        )
                        .addFields({ name: 'Role', value: `<@&${roleId}>` })
                        .setAuthor({ name: `${tag} - ${name}`, iconURL: faction_icon_URL, url: `https://byrod.cc/f/${id}` });
                    await interaction.channel.send({ embeds: [hasRoleEmbed] });
                }
            }

            // Final acknowledgment of completion
            await interaction.followUp('Faction check complete!');
        } catch (error) {
            printLog('Error checking members against factions:', error);

            const errorEmbed = initializeEmbed('Error', 'error')
                .setDescription('An error occurred while checking members against factions.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
