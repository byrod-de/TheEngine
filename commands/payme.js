const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { logCommandUser, initializeEmbed, getFactionConfigFromChannel } = require('../helper/misc');
const { numberWithCommas, cleanUpString } = require('../helper/formattings');
const he = require('he');

const sassySuccessMessages = [
    "Don't spend it all at once!",
    "Try not to blow it on candy.",
    "A little treat for yourself, huh?",
    "Try to make it last this time!",
    "Handle with care, big spender!",
    "Better save some for a rainy day!"
];

const sassyUnavailableMessages = [
    "You can’t claim the request *sigh*... maybe check your flight schedule next time?",
    "A bold move, claiming requests while unavailable. Spoiler: ||it didn’t work.||",
    "Nice try! But I see you’re busy elsewhere. Multitasking much?",
    "You’re not *quite* here right now. Maybe when you’re less... unavailable?",
    "Attempt denied. You’ve got other places to be, champ!",
    "Not today! Maybe come back when you’re actually around, hmm?",
    "Oops! Looks like you’re *slightly* indisposed at the moment. Try again when you’re here.",
    "Request denied! Looks like you've got one foot out the door.",
    "Hold up! You’re too far away to play banker today.",
    "Claiming requests while MIA? Bold move, but nope!"
];


module.exports = {
    data: new SlashCommandBuilder()
        .setName('payme')
        .setDescription('Request faction balance!')
        .addStringOption(option =>
            option.setName('balance')
                .setDescription('Enter the balance you want to request. Formats: any number, 1m, 1b, ALL. Default: ALL')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('expiry')
                .setDescription('Optional: Enter the time in minutes before the request expires. 0 for "send whenever".')
                .setRequired(false)
        ),

    async execute(interaction) {
        logCommandUser(interaction);

        const factionData = getFactionConfigFromChannel(interaction) || {};
        const factionId = factionData.id || ''; // Safely extract factionId
        
        if (!factionId) {
            const notificationEmbed = initializeEmbed(`Error 418 - You're a teapot`, 'error');
            notificationEmbed.setDescription(
                `:teapot: Nice try!\nThis command can only be used in a faction-related channel!`
            );
            await interaction.reply({ embeds: [notificationEmbed], ephemeral: true });
            return; // Exit early if no factionId
        }

        const bankerRoleId = factionData.discordConf.bankerRoleId || ''; // Extract factionId safely

        const hasRole = true //await verifyRoleAccess(interaction, factionData);
        if (!hasRole) return;

        const requestedBalance = interaction.options.getString('balance') ?? 'ALL';
        const discordId = interaction.user.id;
        const user = await userInformation(discordId, factionId);

        if (!user) {
            const notificationEmbed = initializeEmbed(`Error`, 'error');
            notificationEmbed.setDescription(
                `🚫 Unable to retrieve user information. Please try again later.`
            );
            return await interaction.reply({ embeds: [notificationEmbed], ephemeral: true });
        }

        const userBalance = await getUserBalance(user.player_id, factionId);

        if (userBalance == null) {
            const notificationEmbed = initializeEmbed(`Error`, 'error');
            notificationEmbed.setDescription(
                `🚫 Unable to retrieve balance information. Please try again later.`
            );
            return await interaction.reply({ embeds: [notificationEmbed], ephemeral: true });
        }

        const bankRequestEmbed = initializeEmbed('Money Requested', 'overwrite', factionData.embedColor);
        const tornUser = user.name;
        const tornId = user.player_id;

        bankRequestEmbed.setTitle(`${cleanUpString(tornUser)} [${tornId}]`)
            .setDescription(`Banking request from <@${discordId}>`);

        try {
            const requestedAmount = parseBalance(requestedBalance.toLowerCase(), userBalance);
            const expiryTime = interaction.options.getInteger('expiry') ?? 0;  // Get expiry time (minutes)

            if (requestedAmount > userBalance) {
                bankRequestEmbed.addFields({
                    name: '🚫 Error',
                    value: `You requested \$${numberWithCommas(requestedAmount)} but only have \$${numberWithCommas(userBalance)}.`,
                    inline: true
                });
                return await interaction.reply({ embeds: [bankRequestEmbed], ephemeral: true });
            }

            if (requestedAmount === 0) {
                bankRequestEmbed.addFields({
                    name: '🚫 Error',
                    value: `You requested \$${numberWithCommas(requestedAmount)}, that is zero (0) dollars. Very funny...`,
                    inline: true
                });
                return await interaction.reply({ embeds: [bankRequestEmbed], ephemeral: true });
            }

            bankRequestEmbed
                .setTitle(`✅ Request sent`)
                .addFields({
                    name: 'Request Details',
                    value: `Request for \$${numberWithCommas(requestedAmount)} has been sent by <@${discordId}>!`,
                    inline: true
                });

            // Add buttons for "Cancel request" and "Claim"
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('cancel_request')
                        .setLabel('Cancel request')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('claim_request')
                        .setLabel('Claim')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.channel.send({ content: `Hey <@&${bankerRoleId}>, you got work to do!`, ephemeral: false });
            const message = await interaction.reply({ embeds: [bankRequestEmbed], components: [actionRow], ephemeral: false });

            const collector = message.createMessageComponentCollector({ time: expiryTime > 0 ? expiryTime * 60 * 1000 : 0 });

            collector.on('collect', async (i) => {
                if (i.customId === 'cancel_request') {
                    if (i.user.id !== discordId) {
                        return i.reply({ content: "🚫 Only the requester can cancel this request.", ephemeral: true });
                    }

                    bankRequestEmbed.setTitle(":x: Request Cancelled")
                        .setDescription(`<@${discordId}> cancelled the request.`)
                        .setColor("Red")
                        .setFields([]);
                    await i.update({ embeds: [bankRequestEmbed], components: [] });
                    collector.stop();

                } // Modify the "claim_request" section inside the collector.on('collect') function
                else if (i.customId === 'claim_request') {
                    if (!i.member.roles.cache.has(bankerRoleId)) {
                        return i.reply({ content: "🚫 Only bankers can claim this request.", ephemeral: true });
                    }
                
                    bankRequestEmbed.setTitle(":hourglass: Request Claimed")
                        .setDescription(`The request has been claimed by <@${i.user.id}>. \n [Banker Link](https://www.torn.com/factions.php?step=your#/tab=controls&giveMoneyTo=${tornId}&money=${requestedAmount})`)
                        .setColor("Yellow");
                
                    // Check if banker is available
                    const bankerStatus = await checkBankerStatus(i.user.id);
                    if (bankerStatus != null) {
                        if (bankerStatus.status.state === 'Traveling' || bankerStatus.status.state === 'Abroad') {
                            await i.reply({ content: `:x: <@${i.user.id}>, you are currently ${bankerStatus.status.state}.\n\n${getRandomSassyMessage(sassyUnavailableMessages)}`, ephemeral: true });
                            return;
                        }
                    }
                
                    const currentTime = Math.floor(Date.now() / 1000);
                    // Update message to mark as claimed and disable buttons
                    await i.update({ embeds: [bankRequestEmbed], components: [] });
                    await i.message.edit({ embeds: [bankRequestEmbed], components: [] });
                
                    // Stop the collector as request is claimed
                    collector.stop();
                
                    // Define the recursive fulfillment check function
                    const checkFulfillment = async (attemptsLeft) => {
                        const fulfilled = await checkIfRequestFulfilled(i, currentTime, requestedAmount, tornId, factionId);  // Call your fulfillment check function
                
                        if (fulfilled) {
                            bankRequestEmbed.setTitle(":white_check_mark: Request Fulfilled")
                                .setDescription(`The request for <@${discordId}> has been fulfilled.\n\n${getRandomSassyMessage(sassySuccessMessages)}`)
                                .setColor("Green")
                                .setFields([]);
                            await i.message.edit({ embeds: [bankRequestEmbed], components: [] });
                        } else if (attemptsLeft > 0) {
                            // Retry in 5 minutes if not fulfilled
                            setTimeout(() => checkFulfillment(attemptsLeft - 1), 5 * 60 * 1000);
                        } else {
                            // Final failure message
                            bankRequestEmbed.setTitle(":x: Request not fulfilled")
                                .setDescription(`The request for <@${discordId}> has not been fulfilled. Please contact your banker.`)
                                .setColor("Red")
                                .setFields([]);
                            await i.message.edit({ embeds: [bankRequestEmbed], components: [] });
                        }
                    };
                
                    // Start with the initial 1-minute check, then 3 retries at 5-minute intervals if needed
                    setTimeout(() => checkFulfillment(3), 1 * 60 * 1000);
                }
                
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    bankRequestEmbed.setTitle(":x: Request Expired")
                        .setDescription(`The request for <@${discordId}> has expired. Please try again later!`)
                        .setColor(0x979c9f)
                        .setFields([]);
                    message.edit({ embeds: [bankRequestEmbed], components: [] });
                }
            });

        } catch (error) {
            return interaction.reply({ content: `🚫 ${error.message}`, ephemeral: true });
        }
    }
};

// Helper functions remain unchanged


const parseBalance = (balance, userBalance) => {
    balance = balance.replace(/[\s,$]/g, '');
    const validFormat = /^(\d+(?:\.\d+)?[mb]?)$|^(all)$/i;
    if (!validFormat.test(balance)) {
      throw new Error(`Invalid format (${balance})! Please enter a valid balance in formats: any number, 1m, 1b, or ALL.`);
    }
    if (balance === 'all') return userBalance;
    if (balance.endsWith('m')) return parseFloat(balance) * 1_000_000;
    if (balance.endsWith('b')) return parseFloat(balance) * 1_000_000_000;
    return parseFloat(balance);
  };

const userInformation = async (discordId, factionId) => {
    const response = await callTornApi('user', 'basic,discord,profile', discordId, undefined, undefined, undefined, undefined, 'default', undefined, undefined, undefined, factionId);
    return response[0] && response[2] ? response[2] : null;
};

const getUserBalance = async (playerId, factionId) => {
    const response = await callTornApi('faction', 'donations', undefined, undefined, undefined, undefined, undefined, 'default', undefined, undefined, undefined, factionId);

    return response[0] && response[2]?.donations?.[playerId]?.money_balance !== undefined 
        ? response[2].donations[playerId].money_balance 
        : null;
};

const checkBankerStatus = async (discordId) => {
    const response = await callTornApi('user', 'basic', discordId);
    return response[0] && response[2] ? response[2] : null;
};

const checkIfRequestFulfilled = async (i, currentTime, requestedAmount, tornId, factionId) => {
    // Logic to check if the request has been fulfilled goes here
    const response = await callTornApi('faction', 'fundsnews', undefined, currentTime, undefined, undefined, undefined, 'default', undefined, undefined, undefined, factionId);

    if (response[0]) {
        const newsJson = response[2].fundsnews;

        for (const newsId in newsJson) {
            const news = newsJson[newsId];
            if (news.news.includes('given')) {
                if (news.news.includes(tornId) && news.news.includes(`\$${numberWithCommas(requestedAmount)} `)) {
                    return true;
                }
            }
        }
    }
    return false;
};


const getRandomSassyMessage = (sassyMessages) => {
    return sassyMessages[Math.floor(Math.random() * sassyMessages.length)];
};