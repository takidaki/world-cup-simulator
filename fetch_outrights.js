const https = require('https');
const fs = require('fs');

const API_KEY = process.env.ODDS_API_KEY || process.argv[2];
const SPORT_KEY = "soccer_fifa_world_cup_winner";
const REGIONS = "eu,uk"; // You can change this
const MARKETS = "outrights";

if (!API_KEY) {
    console.error("Error: Please provide your Odds API key as an argument or set the ODDS_API_KEY environment variable.");
    console.error("Usage: node fetch_outrights.js YOUR_API_KEY");
    process.exit(1);
}

const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds/?apiKey=${API_KEY}&regions=${REGIONS}&markets=${MARKETS}`;

console.log(`Fetching outrights from The Odds API for ${SPORT_KEY}...`);

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.error(`Error fetching data: ${res.statusCode} - ${data}`);
            return;
        }

        try {
            const parsedData = JSON.parse(data);
            fs.writeFileSync('world_cup_outrights.json', JSON.stringify(parsedData, null, 2));
            console.log("Successfully saved outright odds to world_cup_outrights.json!");
            
            // Extract average odds for each team to show a quick summary
            if (parsedData.length > 0) {
                const bookies = parsedData;
                const teamOdds = {};
                
                bookies.forEach(bookie => {
                    const market = bookie.bookmakers?.[0]?.markets?.find(m => m.key === 'outrights');
                    if (market) {
                        market.outcomes.forEach(outcome => {
                            if (!teamOdds[outcome.name]) teamOdds[outcome.name] = [];
                            teamOdds[outcome.name].push(outcome.price);
                        });
                    }
                });
                console.log("Found odds for " + Object.keys(teamOdds).length + " teams.");
            }
        } catch (e) {
            console.error("Error parsing JSON response:", e);
        }
    });
}).on('error', (err) => {
    console.error("Request failed: ", err.message);
});
