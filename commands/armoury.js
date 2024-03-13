const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { verifyChannelAccess } = require('../helper/misc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('armoury')
        .setDescription('Get a list of items in the faction\'s armoury stock!')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Select type')
                .addChoices(
                    { name: 'Temporaries', value: 'temporary' },
                    { name: 'Boosters', value: 'boosters' },
                    { name: 'Medical Items', value: 'medical' },
                    { name: 'Totals', value: 'totals' }
                )),

    async execute(interaction) {

        // Check if the user has access to the channel
        if (!await verifyChannelAccess(interaction, true, false)) return;

        const type = interaction.options.getString('type') ?? 'temporary';
        const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
        let selection = type;

        if (type === 'totals') {
            selection = 'armor,boosters,caches,cesium,drugs,medical,temporary,weapons';
        }

        const response = await callTornApi('faction', `basic,${selection},timestamp`);



        if (response[0]) {
            const factionJson = response[2];

            const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson;

            const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;

            const armouryEmbed = new EmbedBuilder()
                .setColor(0xdf691a)
                .setTitle('Armoury Overview - ' + capitalizedType)
                .setAuthor({ name: `${faction_tag} -  ${faction_name}`, iconURL: faction_icon_URL, url: `https://www.torn.com/factions.php?step=profile&ID=${faction_id}` })
                .setDescription('Overview of armoury stock')
                .setTimestamp()
                .setFooter({ text: 'powered by TornEngine', iconURL: 'https://tornengine.netlify.app/images/logo-100x100.png' });


            if (type === 'temporary') {
                const temporary = factionJson?.temporary || [];
                let miscTemps = '';

                for (var id in temporary) {
                    const item = temporary[id];

                    if (item.name === 'Epinephrine'
                        || item.name === 'Melatonin'
                        || item.name === 'Serotonin'
                        || item.name === 'Tyrosine') {
                        armouryEmbed.addFields({ name: `:syringe: ${item.name}`, value: `\`\`\`Quantity: ${item.quantity}\nAvailable: ${item.available}\nLoaned: ${item.loaned}\`\`\``, inline: true });
                    } else {
                        miscTemps += `* ${item.name} - ${item.quantity}\n`;
                    }
                }

                if (miscTemps !== '') {
                    armouryEmbed.addFields({ name: ':bricks: Other temps', value: `\`\`\`${miscTemps}\`\`\``, inline: false });
                }
            }

            if (type === 'boosters') {
                const booster = factionJson?.boosters || [];

                let energyDrinks = '';
                let alcohol = '';
                let miscBoosters = '';

                for (var id in booster) {
                    const item = booster[id];
                    switch (item.type) {
                        case 'Energy Drink': energyDrinks += `* ${item.name} - ${item.quantity}\n`; break;
                        case 'Alcohol': alcohol += `* ${item.name} - ${item.quantity}\n`; break;
                        default: miscBoosters += `* ${item.name} - ${item.quantity}\n`; break;
                    }
                }
                armouryEmbed.addFields({ name: ':battery: Energy drinks', value: `\`\`\`${energyDrinks}\`\`\``, inline: true });
                armouryEmbed.addFields({ name: ':beers: Alcohol', value: `\`\`\`${alcohol}\`\`\``, inline: true });
                armouryEmbed.addFields({ name: ':nut_and_bolt: Other boosters', value: `\`\`\`${miscBoosters}\`\`\``, inline: true });
            }

            if (type === 'medical') {
                const medical = factionJson?.medical || [];

                let bloodBags = '';
                let specialBloodBags = '';
                let miscMed = '';

                for (var id in medical) {
                    const item = medical[id];
                    if (item.name.includes('Blood Bag')) {
                        if (item.name.includes('Irradiated') || item.name.includes('Empty')) {
                            specialBloodBags += `* ${item.name} - ${item.quantity}\n`;
                        } else {
                            bloodBags += `* ${item.name} - ${item.quantity}\n`;
                        }
                    } else {
                        miscMed += `* ${item.name} - ${item.quantity}\n`;
                    }
                }

                armouryEmbed.addFields({ name: `:stethoscope: Special Blood Bags`, value: `\`\`\`${specialBloodBags}\`\`\``, inline: true });
                armouryEmbed.addFields({ name: `:syringe: Other Meds`, value: `\`\`\`${miscMed}\`\`\``, inline: true });
                armouryEmbed.addFields({ name: `:drop_of_blood: Blood Bags`, value: `\`\`\`${bloodBags}\`\`\``, inline: false });
            }

            if (type === 'totals') {
                const totals = {};
                const highestQuantityItems = {};

                const selectionArray = selection.split(',');

                selectionArray.forEach(element => {
                    const subElements = factionJson[element];
                    let totalQuantity = 0;
                    let highestQuantityItem = { name: '', quantity: 0 }; // Initialize with default values
                    if (subElements) {
                        subElements.forEach(item => {
                            totalQuantity += item.quantity;
                            if (item.quantity > highestQuantityItem.quantity) {
                                highestQuantityItem = { name: item.name, quantity: item.quantity };
                            }
                        });
                    }
                    totals[element] = totalQuantity;
                    highestQuantityItems[element] = highestQuantityItem;
                });

                let totalsString = '';
                let grandTotal = 0;
                for (const element in totals) {
                    const capitalizedElement = element.charAt(0).toUpperCase() + element.slice(1);
                    totalsString += `${capitalizedElement.padEnd(10, ' ')}: ${totals[element].toLocaleString('en').padStart(7, ' ')}\n`;
                    grandTotal += totals[element];
                }
                totalsString += `-----------------------\nTotal 0 : ${grandTotal.toLocaleString('en').padStart(7, ' ')}`;

                let highestQuantityItemsString = '';
                for (const element in highestQuantityItems) {
                    const capitalizedElement = element.charAt(0).toUpperCase() + element.slice(1);
                    highestQuantityItemsString += `${capitalizedElement.padEnd(10, ' ')}- ${highestQuantityItems[element].name.padEnd(20, ' ')}: ${highestQuantityItems[element].quantity.toLocaleString('en').padStart(7, ' ')}\n`;
                }

                armouryEmbed.addFields(
                    { name: 'Totals', value: `\`\`\`${totalsString}\`\`\``, inline: false },
                    { name: 'Highest Quantity Items per Category', value: `\`\`\`${highestQuantityItemsString}\`\`\``, inline: false }
                );
            }

            await interaction.reply({ embeds: [armouryEmbed], ephemeral: false });
        } else {
            await interaction.reply(`\`\`\`${response[1]}\n${responseHist[1]}\`\`\``);
        }
    },
};
