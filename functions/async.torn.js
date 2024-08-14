const { printLog, initializeEmbed} = require('../helper/misc');
const { capitalize } = require('../helper/formattings');
const { callTornApi } = require('./api');


async function checkCrimeEnvironment(tornDataChannel, tornDataUpdateInterval) {

    if (tornDataChannel) {
        const responseEnvironment = await callTornApi('torn', 'shoplifting,searchforcash,timestamp');

        if (responseEnvironment[0]) {
            const envorinmentJson = responseEnvironment[2];
            const searchForCash = envorinmentJson['searchforcash'];
            const shoplifting = envorinmentJson['shoplifting'];

            let searchForCashValue = '';
            let shopliftingValue = '';

            const environmentEmbed = initializeEmbed('Torn Insights');
            environmentEmbed.setDescription('Crimes Environment Data');

            for (const key in searchForCash) {
                const entry = `**${capitalize(key)}**\n- ${searchForCash[key].title}:\n- ${searchForCash[key].percentage}%\n`;
                searchForCashValue += entry;
            }

            environmentEmbed.addFields({ name: ':dollar: Search For Cash', value: searchForCashValue, inline: true });

            for (const key in shoplifting) {
                let details = '';
                for (const subKey in shoplifting[key]) {
                    let disabled = ':o:';
                    if (shoplifting[key][subKey].disabled) disabled = ':green_circle:';
                    details += `- ${disabled} ${shoplifting[key][subKey].title}\n`;
                }

                const entry = `**${capitalize(key)}** \n${details}`;
                shopliftingValue += entry;

            }

            environmentEmbed.addFields({ name: ':department_store: Shoplifting', value: shopliftingValue, inline: true });

            const message = await tornDataChannel.send({ embeds: [attackEmbed], ephemeral: false });

        }
    }
}

async function getTornEvents(tornDataChannel) {

    if (tornDataChannel) {
        const responseEvents = await callTornApi('torn', 'calendar', undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'v2');

        if (responseEvents[0]) {
            const eventsJson = responseEvents[2];

            const today = new Date().getTime() / 1000;
            const events = eventsJson.calendar.events.sort((a, b) => a.start - b.start);
            const filteredEvents = events.filter(event => event.end >= today);
            const eventString = filteredEvents.map(event => `**${event.title}**\n*${event.description}*\n- Start: <t:${event.start}:D>\n- End: <t:${event.end}:D>`).join('\n\n');

            const eventsEmbed = initializeEmbed(':calendar: Events');
            eventsEmbed.addFields({ name: 'Upcoming Events', value: eventString, inline: false });

            const competitions = eventsJson.calendar.competitions.sort((a, b) => a.start - b.start);
            const filteredCompetitions = competitions.filter(competition => competition.end >= today);
            const competitionString = filteredCompetitions.map(competition => `**${competition.title}**\n- Start: <t:${competition.start}:D>\n- End: <t:${competition.end}:D>`).join('\n\n');

            const competitionEmbed = initializeEmbed(':medal: Competitions');
            competitionEmbed.addFields({ name: 'Upcoming Competitions', value: competitionString, inline: false });

            const message = await tornDataChannel.send({ embeds: [eventsEmbed, competitionEmbed], ephemeral: false });


        }    
    }
}



module.exports = { checkCrimeEnvironment, getTornEvents };