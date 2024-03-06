const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callTornApi } = require('../functions/api');
const { limitedAccessChannelIds, limitedAccessCategories } = require('../conf/config.json');


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
                )),

    async execute(interaction) {

        if (!limitedAccessChannelIds.includes(interaction.channelId)) {
            
            let accessList = '';

            if (limitedAccessChannelIds.length > 0) {
              accessList = limitedAccessChannelIds.map(id => `<#${id}>`).join(' or ');
            }
            
            if (limitedAccessCategories.length > 0) {
              if (accessList) {
                accessList += ' or the ';
              } 
              accessList += limitedAccessCategories.map(id => `**<#${id}>**`).join(' or ') + ' category';
            }
            await interaction.reply({ content: `Nice try! This command can only be used in ${accessList}. If you cannot see the channel, you are not meant to use this command :wink:`, ephemeral: true });
            return;
        }
        
        const type = interaction.options.getString('type') ?? 'temporary';
        const name = interaction.options.getString('name') ?? '';
        const response = await callTornApi('faction', `basic,${type},timestamp`);

        if (response[0]) {
            const factionJson = response[2];

            const { name: faction_name, ID: faction_id, tag: faction_tag, tag_image: faction_icon } = factionJson;

            const faction_icon_URL = `https://factiontags.torn.com/${faction_icon}`;

            const armouryEmbed = new EmbedBuilder()
                .setColor(0xdf691a)
                .setTitle('Armoury Overview - ' + name)
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
        
        await interaction.reply({ embeds: [armouryEmbed], ephemeral: false });
    } else {
        await interaction.reply(`\`\`\`${response[1]}\n${responseHist[1]}\`\`\``);
    }
},
};
