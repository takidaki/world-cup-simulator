/**
 * Odds Extractor Module
 * Extracts and processes odds from The Odds API bookmaker data
 */

/**
 * Extract odds from bookmakers using Pinnacle-first strategy
 * @param {Array} bookmakers - Array of bookmaker objects from The Odds API
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @returns {Object|null} Extracted odds or null if incomplete
 */
export function extractOdds(bookmakers, homeTeam, awayTeam) {
    if (!bookmakers || bookmakers.length === 0) return null;

    // Strategy: Pinnacle first, then average from all available
    const pinnacle = bookmakers.find(b => b.key === 'pinnacle' || b.title.toLowerCase().includes('pinnacle'));

    if (pinnacle) {
        const odds = extractBookmakerOdds(pinnacle, homeTeam, awayTeam);
        if (odds) return odds;
    }

    // Fallback: calculate average across all bookmakers
    return calculateAverageOdds(bookmakers, homeTeam, awayTeam);
}

/**
 * Extract odds from a single bookmaker
 * @param {Object} bookmaker - Bookmaker object
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @returns {Object|null} Odds object or null if incomplete
 */
function extractBookmakerOdds(bookmaker, homeTeam, awayTeam) {
    const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
    const totalsMarket = bookmaker.markets?.find(m => m.key === 'totals');

    if (!h2hMarket || !totalsMarket) {
        console.log('⚠️ Missing markets:', {
            bookmaker: bookmaker.key,
            hasH2H: !!h2hMarket,
            hasTotals: !!totalsMarket
        });
        return null;
    }

    const homeOdds = h2hMarket.outcomes?.find(o => o.name === homeTeam)?.price;
    const drawOdds = h2hMarket.outcomes?.find(o => o.name === 'Draw')?.price;
    const awayOdds = h2hMarket.outcomes?.find(o => o.name === awayTeam)?.price;

    const overOdds = totalsMarket.outcomes?.find(o => o.name === 'Over')?.price;
    const underOdds = totalsMarket.outcomes?.find(o => o.name === 'Under')?.price;

    if (!homeOdds || !drawOdds || !awayOdds || !overOdds || !underOdds) {
        console.log('⚠️ Missing odds:', {
            bookmaker: bookmaker.key,
            lookingFor: { homeTeam, awayTeam },
            availableTeams: h2hMarket.outcomes?.map(o => o.name),
            homeOdds, drawOdds, awayOdds, overOdds, underOdds
        });
        return null;
    }

    return {
        home: homeOdds.toFixed(2),
        draw: drawOdds.toFixed(2),
        away: awayOdds.toFixed(2),
        over: overOdds.toFixed(2),
        under: underOdds.toFixed(2)
    };
}

/**
 * Calculate average odds from multiple bookmakers
 * @param {Array} bookmakers - Array of bookmaker objects
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @returns {Object|null} Average odds or null if insufficient data
 */
function calculateAverageOdds(bookmakers, homeTeam, awayTeam) {
    const homeOddsList = [];
    const drawOddsList = [];
    const awayOddsList = [];
    const overOddsList = [];
    const underOddsList = [];

    for (const bookmaker of bookmakers) {
        const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
        const totalsMarket = bookmaker.markets?.find(m => m.key === 'totals');

        if (h2hMarket) {
            const homeOdds = h2hMarket.outcomes?.find(o => o.name === homeTeam)?.price;
            const drawOdds = h2hMarket.outcomes?.find(o => o.name === 'Draw')?.price;
            const awayOdds = h2hMarket.outcomes?.find(o => o.name === awayTeam)?.price;

            if (homeOdds) homeOddsList.push(homeOdds);
            if (drawOdds) drawOddsList.push(drawOdds);
            if (awayOdds) awayOddsList.push(awayOdds);
        }

        if (totalsMarket) {
            const overOdds = totalsMarket.outcomes?.find(o => o.name === 'Over')?.price;
            const underOdds = totalsMarket.outcomes?.find(o => o.name === 'Under')?.price;

            if (overOdds) overOddsList.push(overOdds);
            if (underOdds) underOddsList.push(underOdds);
        }
    }

    // Must have at least one bookmaker with complete data
    if (homeOddsList.length === 0 || drawOddsList.length === 0 || awayOddsList.length === 0 ||
        overOddsList.length === 0 || underOddsList.length === 0) {
        return null;
    }

    const average = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
        home: average(homeOddsList).toFixed(2),
        draw: average(drawOddsList).toFixed(2),
        away: average(awayOddsList).toFixed(2),
        over: average(overOddsList).toFixed(2),
        under: average(underOddsList).toFixed(2)
    };
}
