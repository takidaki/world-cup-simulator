/**
 * Admin Panel - World Cup Simulator
 * Fetches data from Wikipedia and The Odds API, pairs them, and generates CSV
 */

// State
let wikipediaGroups = null; // { A: ['Mexico', 'South Africa', ...], B: [...], ... }
let apiMatches = null; // Array of match objects with odds
let pairedData = null; // Array of paired matches with group assignments
let unpaimedMatches = []; // Array of matches that couldn't be auto-paired
let manualPairings = {}; // Manual group assignments: matchId -> groupLabel
let additionalMatches = []; // Array of manually added matches from CSV input

// DOM Elements
const fetchWikipediaBtn = document.getElementById('fetchWikipediaBtn');
const fetchOddsBtn = document.getElementById('fetchOddsBtn');
const autoPairBtn = document.getElementById('autoPairBtn');
const copyToClipboardBtn = document.getElementById('copyToClipboardBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const useInSimulatorBtn = document.getElementById('useInSimulatorBtn');
const saveManualPairingsBtn = document.getElementById('saveManualPairingsBtn');
const cancelManualPairingsBtn = document.getElementById('cancelManualPairingsBtn');

const oddsApiKeyEl = document.getElementById('oddsApiKey');
const wikipediaStatus = document.getElementById('wikipediaStatus');
const oddsStatus = document.getElementById('oddsStatus');
const csvOutput = document.getElementById('csvOutput');
const csvStatus = document.getElementById('csvStatus');
const debugLog = document.getElementById('debugLog');

const pairingPanel = document.getElementById('pairingPanel');
const pairingPlaceholder = document.getElementById('pairingPlaceholder');
const pairingComparison = document.getElementById('pairingComparison');
const groupsColumn = document.getElementById('groupsColumn');
const unmatchedColumn = document.getElementById('unmatchedColumn');
const pairingStats = document.getElementById('pairingStats');

// Additional CSV input elements
const additionalMatchDataEl = document.getElementById('additionalMatchData');
const mergeAdditionalDataBtn = document.getElementById('mergeAdditionalDataBtn');
const clearAdditionalDataBtn = document.getElementById('clearAdditionalDataBtn');
const additionalDataStatus = document.getElementById('additionalDataStatus');

// Utility: Add debug log
function addDebugLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    debugLog.innerHTML = logEntry + '\n' + debugLog.innerHTML;
    console.log(logEntry);
}

// Utility: Show status message
function showStatus(element, type, message) {
    const colors = {
        success: 'text-green-600',
        error: 'text-red-600',
        info: 'text-blue-600',
        warning: 'text-amber-600'
    };
    element.innerHTML = `<span class="${colors[type] || 'text-slate-600'}">${message}</span>`;
}

// Step 1A: Fetch Wikipedia Schedule
fetchWikipediaBtn.addEventListener('click', async () => {
    fetchWikipediaBtn.disabled = true;
    fetchWikipediaBtn.innerHTML = 'Fetching...';
    showStatus(wikipediaStatus, 'info', 'Fetching Wikipedia data...');
    addDebugLog('Starting Wikipedia fetch...');

    try {
        // Use Wikipedia API to fetch page content
        const wikiUrl = 'https://en.wikipedia.org/w/api.php?action=parse&page=2026_FIFA_World_Cup&prop=text&format=json&origin=*';

        const response = await fetch(wikiUrl);
        const data = await response.json();

        if (!data.parse || !data.parse.text) {
            throw new Error('Failed to fetch Wikipedia content');
        }

        const htmlContent = data.parse.text['*'];
        addDebugLog(`Fetched Wikipedia HTML (${htmlContent.length} chars)`);

        // Parse HTML to extract groups
        wikipediaGroups = parseWikipediaGroups(htmlContent);

        if (!wikipediaGroups || Object.keys(wikipediaGroups).length === 0) {
            throw new Error('Could not parse group data from Wikipedia');
        }

        addDebugLog(`Parsed ${Object.keys(wikipediaGroups).length} groups`);

        showStatus(wikipediaStatus, 'success', `✅ Fetched ${Object.keys(wikipediaGroups).length} groups from Wikipedia`);
        checkPairingReady();

    } catch (error) {
        addDebugLog(`ERROR: ${error.message}`);
        showStatus(wikipediaStatus, 'error', `❌ Error: ${error.message}`);
        wikipediaGroups = null;
    } finally {
        fetchWikipediaBtn.disabled = false;
        fetchWikipediaBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Fetch Wikipedia Schedule';
    }
});

// Parse Wikipedia HTML to extract groups
function parseWikipediaGroups(html) {
    addDebugLog('Parsing Wikipedia HTML for group tables...');

    // Create a temporary DOM element to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const groups = {};

    // Look for group tables (usually have headers like "Group A", "Group B", etc.)
    const tables = doc.querySelectorAll('table.wikitable');

    for (const table of tables) {
        // Check if this is a group table by looking for group label
        const caption = table.querySelector('caption');
        if (!caption) continue;

        const captionText = caption.textContent.trim();
        const groupMatch = captionText.match(/Group ([A-L])/i);

        if (groupMatch) {
            const groupLabel = groupMatch[1].toUpperCase();
            const teams = [];

            // Extract team names from the table rows
            const rows = table.querySelectorAll('tbody tr');

            for (const row of rows) {
                // Look for team name in the first or second column
                const cells = row.querySelectorAll('th, td');

                for (const cell of cells) {
                    // Team names are usually linked
                    const link = cell.querySelector('a');
                    if (link && link.title) {
                        let teamName = link.title
                            .replace(' national football team', '')
                            .replace(' national soccer team', '')
                            .replace(" men's national soccer team", '')
                            .replace(" men's national football team", '')
                            .replace(" men's", '')
                            .trim();

                        if (teamName && !teams.includes(teamName) && teams.length < 4) {
                            teams.push(teamName);
                        }
                    }
                }
            }

            if (teams.length === 4) {
                groups[groupLabel] = teams;
                addDebugLog(`Group ${groupLabel}: ${teams.join(', ')}`);
            }
        }
    }

    return groups;
}

// Step 1B: Fetch Odds API
fetchOddsBtn.addEventListener('click', async () => {
    const apiKey = oddsApiKeyEl.value.trim();

    if (!apiKey) {
        showStatus(oddsStatus, 'error', '❌ Please enter an API key first');
        return;
    }

    fetchOddsBtn.disabled = true;
    fetchOddsBtn.innerHTML = 'Fetching...';
    showStatus(oddsStatus, 'info', 'Fetching match odds from The Odds API...');
    addDebugLog('Starting Odds API fetch...');

    try {
        const apiUrl = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${apiKey}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        apiMatches = data;

        addDebugLog(`Fetched ${apiMatches.length} matches from API`);

        const remaining = response.headers.get('x-requests-remaining');
        showStatus(oddsStatus, 'success', `✅ Fetched ${apiMatches.length} matches (${remaining || '?'} API requests remaining)`);
        checkPairingReady();

    } catch (error) {
        addDebugLog(`ERROR: ${error.message}`);
        showStatus(oddsStatus, 'error', `❌ Error: ${error.message}`);
        apiMatches = null;
    } finally {
        fetchOddsBtn.disabled = false;
        fetchOddsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg> Fetch Match Odds';
    }
});


// Check if both data sources are ready
function checkPairingReady() {
    if (wikipediaGroups && apiMatches) {
        pairingPanel.classList.remove('hidden');
        pairingPlaceholder.classList.add('hidden');
        addDebugLog('Both data sources ready - pairing panel enabled');

        // Show side-by-side comparison immediately with all matches
        displayAllMatchesForPairing();
    }
}

// Step 2: Auto-pair matches with groups
autoPairBtn.addEventListener('click', () => {
    addDebugLog('Starting auto-pairing process...');

    pairedData = [];
    unpaimedMatches = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let manualCount = 0;

    // Build a mapping of team name to group
    const teamToGroup = new Map();
    for (const [group, teams] of Object.entries(wikipediaGroups)) {
        for (const team of teams) {
            // Store multiple variations
            teamToGroup.set(team.toLowerCase(), group);
            teamToGroup.set(team.replace(/\s+/g, '').toLowerCase(), group);
        }
    }

    addDebugLog(`Built team-to-group map with ${teamToGroup.size} entries`);

    // Process each API match
    for (let i = 0; i < apiMatches.length; i++) {
        const match = apiMatches[i];
        const matchId = `match_${i}`;
        const homeTeam = match.home_team;
        const awayTeam = match.away_team;

        // Check if this match was manually paired first
        const manualGroup = manualPairings[matchId];

        const odds = extractOddsFromMatch(match);
        if (!odds) continue; // Skip matches without complete odds

        if (manualGroup) {
            // Use manual pairing
            pairedData.push({
                group: manualGroup,
                homeTeam,
                awayTeam,
                ...odds
            });
            manualCount++;
            continue;
        }

        // Try to find group for both teams automatically
        const homeGroup = findGroup(homeTeam, teamToGroup);
        const awayGroup = findGroup(awayTeam, teamToGroup);

        // Only include if both teams are in the same group
        if (homeGroup && awayGroup && homeGroup === awayGroup) {
            pairedData.push({
                group: homeGroup,
                homeTeam,
                awayTeam,
                ...odds
            });
            matchedCount++;
        } else {
            // Store unmatched match
            unpaimedMatches.push({
                id: matchId,
                homeTeam,
                awayTeam,
                homeGroup,
                awayGroup,
                ...odds
            });
            unmatchedCount++;
        }
    }

    addDebugLog(`Pairing complete: ${matchedCount} auto-matched, ${manualCount} manual, ${unmatchedCount} unmatched`);

    if (pairedData.length > 0) {
        generateCSV();
    }

    if (unpaimedMatches.length > 0) {
        showStatus(csvStatus, 'warning', `⚠️ ${unpaimedMatches.length} matches could not be auto-paired. Use side-by-side pairing below.`);
        displayPairingComparison();
        addDebugLog(`${unpaimedMatches.length} unmatched matches available for manual pairing`);
    } else if (pairedData.length === 0) {
        showStatus(csvStatus, 'warning', '⚠️ No matches could be paired. Check team name variations.');
    } else {
        // All matched successfully
        pairingComparison.classList.add('hidden');
        showStatus(csvStatus, 'success', `✅ Successfully paired all ${pairedData.length} matches!`);
    }
});

// Find group for a team (with fuzzy matching)
function findGroup(teamName, teamToGroup) {
    // Direct lookups
    const normalized = teamName.toLowerCase();
    const noSpaces = teamName.replace(/\s+/g, '').toLowerCase();

    let group = teamToGroup.get(normalized) || teamToGroup.get(noSpaces);
    if (group) return group;

    // Additional fuzzy matching - try partial matches
    // e.g., "United States" should match "United States men's national soccer team"
    const teamLower = teamName.toLowerCase();

    for (const [key, value] of teamToGroup.entries()) {
        const keyLower = key.toLowerCase();

        // Check if either string contains the other
        if (keyLower.includes(teamLower) || teamLower.includes(keyLower)) {
            return value;
        }

        // Check without spaces
        const keyNoSpaces = key.replace(/\s+/g, '').toLowerCase();
        const teamNoSpaces = teamName.replace(/\s+/g, '').toLowerCase();

        if (keyNoSpaces.includes(teamNoSpaces) || teamNoSpaces.includes(keyNoSpaces)) {
            return value;
        }
    }

    return null;
}

// Extract odds from match object
function extractOddsFromMatch(match) {
    if (!match.bookmakers || match.bookmakers.length === 0) {
        return null;
    }

    // Try Pinnacle first, then average
    let bookmaker = match.bookmakers.find(b => b.key === 'pinnacle');
    if (!bookmaker) {
        bookmaker = match.bookmakers[0];
    }

    const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
    const totalsMarket = bookmaker.markets?.find(m => m.key === 'totals');

    if (!h2hMarket || !totalsMarket) {
        return null;
    }

    const homeOdds = h2hMarket.outcomes?.find(o => o.name === match.home_team)?.price;
    const drawOdds = h2hMarket.outcomes?.find(o => o.name === 'Draw')?.price;
    const awayOdds = h2hMarket.outcomes?.find(o => o.name === match.away_team)?.price;
    const overOdds = totalsMarket.outcomes?.find(o => o.name === 'Over')?.price;
    const underOdds = totalsMarket.outcomes?.find(o => o.name === 'Under')?.price;

    if (!homeOdds || !drawOdds || !awayOdds || !overOdds || !underOdds) {
        return null;
    }

    return {
        odd1: homeOdds.toFixed(2),
        oddX: drawOdds.toFixed(2),
        odd2: awayOdds.toFixed(2),
        oddUnder: underOdds.toFixed(2),
        oddOver: overOdds.toFixed(2)
    };
}

// Step 3: Generate CSV
function generateCSV() {
    // Combine paired data with additional matches
    const allMatches = [...pairedData];

    // Add additional matches if any
    if (additionalMatches.length > 0) {
        allMatches.push(...additionalMatches);
        addDebugLog(`Merging ${pairedData.length} API matches + ${additionalMatches.length} additional matches`);
    } else {
        addDebugLog(`Generating CSV from ${pairedData.length} paired matches...`);
    }

    // Sort by group
    allMatches.sort((a, b) => a.group.localeCompare(b.group));

    const csvLines = allMatches.map(match => {
        return `${match.group};${match.homeTeam};vs;${match.awayTeam};${match.odd1};${match.oddX};${match.odd2};${match.oddUnder};${match.oddOver}`;
    });

    const csvText = csvLines.join('\n');
    csvOutput.value = csvText;

    // Enable buttons
    copyToClipboardBtn.disabled = false;
    downloadCsvBtn.disabled = false;
    useInSimulatorBtn.disabled = false;

    const totalCount = allMatches.length;
    const message = additionalMatches.length > 0
        ? `✅ Generated CSV with ${totalCount} matches (${pairedData.length} API + ${additionalMatches.length} manual)`
        : `✅ Generated CSV with ${totalCount} matches`;

    showStatus(csvStatus, 'success', message);
    addDebugLog(`CSV generated successfully (${csvText.length} chars)`);
}

// Copy to clipboard
copyToClipboardBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(csvOutput.value);
        showStatus(csvStatus, 'success', '✅ Copied to clipboard!');
    } catch (error) {
        showStatus(csvStatus, 'error', '❌ Failed to copy to clipboard');
    }
});

// Download CSV
downloadCsvBtn.addEventListener('click', () => {
    const blob = new Blob([csvOutput.value], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world_cup_2026_odds.csv';
    a.click();
    URL.revokeObjectURL(url);
    showStatus(csvStatus, 'success', '✅ CSV downloaded!');
});

// Use in simulator (save to localStorage and redirect)
useInSimulatorBtn.addEventListener('click', () => {
    localStorage.setItem('worldCupMatchData', csvOutput.value);
    showStatus(csvStatus, 'success', '✅ Data saved! Redirecting to simulator...');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
});

// State for side-by-side pairing
let selectedGroup = null;

// Display all matches for initial pairing (before auto-pair)
function displayAllMatchesForPairing() {
    pairingComparison.classList.remove('hidden');

    // Count manual pairings
    const totalPairings = Object.keys(manualPairings).length;
    const totalMatches = apiMatches.filter(m => extractOddsFromMatch(m)).length;

    // Groups: Render as compact grid cards (12 groups in 6x2 grid)
    let groupsHtml = '';
    for (const [group, teams] of Object.entries(wikipediaGroups).sort()) {
        const isSelected = selectedGroup === group;
        const pairCount = Object.values(manualPairings).filter(g => g === group).length;

        groupsHtml += `
            <div class="group-item cursor-pointer transition border-2 rounded-lg ${isSelected ? 'bg-blue-500 text-white border-blue-700 shadow-lg scale-105' : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'}"
                 data-group="${group}"
                 style="padding: 10px;">
                <div class="flex items-center justify-between" style="margin-bottom: 6px;">
                    <div class="font-bold flex items-center" style="font-size: 15px; gap: 6px;">
                        <span class="flex items-center justify-center rounded-full ${isSelected ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}" style="width: 26px; height: 26px; font-size: 13px; font-weight: 700; flex-shrink: 0;">
                            ${group}
                        </span>
                    </div>
                    ${pairCount > 0 ? `<span class="${isSelected ? 'bg-blue-700 text-white' : 'bg-green-500 text-white'} rounded-full shadow" style="padding: 2px 7px; font-size: 10px; font-weight: 700;">${pairCount}</span>` : ''}
                </div>
                <div class="${isSelected ? 'text-blue-100' : 'text-slate-600'}" style="font-size: 9px; line-height: 1.3;">${teams.slice(0, 2).join(', ')}${teams.length > 2 ? '...' : ''}</div>
            </div>
        `;
    }
    groupsColumn.innerHTML = groupsHtml;

    // Matches: Render as compact grid cards (3 columns)
    let matchesHtml = '';
    for (let i = 0; i < apiMatches.length; i++) {
        const match = apiMatches[i];
        const matchId = `match_${i}`;
        const odds = extractOddsFromMatch(match);
        const isPaired = !!manualPairings[matchId];
        const pairedGroup = manualPairings[matchId];

        if (odds) {
            matchesHtml += `
                <div class="match-item cursor-pointer transition border-2 rounded-lg ${isPaired ? 'bg-green-100 border-green-500 shadow-md' : 'bg-white border-slate-200 hover:border-green-400 hover:shadow-md'}"
                     data-match-index="${i}"
                     style="padding: 10px;">
                    <div class="flex items-center justify-between" style="margin-bottom: 6px;">
                        <div class="font-semibold ${isPaired ? 'text-green-900' : 'text-slate-800'}" style="font-size: 11px; line-height: 1.2;">
                            ${isPaired ? '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-green-600" style="display: inline; margin-right: 3px;"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                            <div>${match.home_team}</div>
                            <div class="text-slate-500 font-normal text-center" style="margin: 2px 0;">vs</div>
                            <div>${match.away_team}</div>
                        </div>
                    </div>
                    ${isPaired ? `<div class="bg-green-600 text-white rounded text-center shadow mb-2" style="padding: 3px; font-size: 10px; font-weight: 700;">Group ${pairedGroup}</div>` : ''}
                    <div class="text-slate-600" style="font-size: 9px; line-height: 1.3;">
                        <div style="margin-bottom: 2px;"><span class="text-slate-500">1X2:</span> <span style="font-family: monospace; font-weight: 600;">${odds.odd1} / ${odds.oddX} / ${odds.odd2}</span></div>
                        <div><span class="text-slate-500">O/U:</span> <span style="font-family: monospace;">${odds.oddOver} / ${odds.oddUnder}</span></div>
                    </div>
                </div>
            `;
        }
    }

    if (matchesHtml === '') {
        matchesHtml = '<div class="col-span-3 p-8 text-center text-slate-500 text-sm">⚠️ No matches with complete odds data</div>';
    }

    unmatchedColumn.innerHTML = matchesHtml;

    // Update stats display
    if (pairingStats) {
        pairingStats.innerHTML = `
            <span class="inline-flex items-center gap-2">
                <span class="text-slate-200">Paired:</span>
                <span class="font-bold text-xl ${totalPairings > 0 ? 'text-green-300' : 'text-slate-300'}">${totalPairings}</span>
                <span class="text-slate-400">/</span>
                <span class="font-bold text-xl text-white">${totalMatches}</span>
            </span>
        `;
    }

    // Add click handlers for groups
    groupsColumn.querySelectorAll('.group-item').forEach(item => {
        item.addEventListener('click', () => {
            selectedGroup = item.dataset.group;
            addDebugLog(`Selected Group ${selectedGroup} for pairing`);
            displayAllMatchesForPairing(); // Refresh to show selection
        });
    });

    // Add click handlers for matches - for manual assignment before auto-pair
    unmatchedColumn.querySelectorAll('.match-item').forEach(item => {
        item.addEventListener('click', () => {
            if (!selectedGroup) {
                showStatus(csvStatus, 'warning', '⚠️ Please select a group first (left column)');
                return;
            }

            const matchIndex = parseInt(item.dataset.matchIndex);
            const match = apiMatches[matchIndex];

            // Create a match ID if it doesn't exist
            const matchId = `match_${matchIndex}`;

            // Toggle pairing
            if (manualPairings[matchId] === selectedGroup) {
                delete manualPairings[matchId];
                addDebugLog(`Unpaired: ${match.home_team} vs ${match.away_team} from Group ${selectedGroup}`);
                showStatus(csvStatus, 'info', `Unpaired match from Group ${selectedGroup}`);
            } else {
                manualPairings[matchId] = selectedGroup;
                addDebugLog(`Paired: ${match.home_team} vs ${match.away_team} → Group ${selectedGroup}`);
                showStatus(csvStatus, 'success', `✅ Paired to Group ${selectedGroup}`);
            }

            // Refresh display to show pairing status
            displayAllMatchesForPairing();
        });
    });
}

// Display side-by-side pairing comparison (for unmatched items after auto-pair)
function displayPairingComparison() {
    const unmatchedCount = unpaimedMatches.length;
    const pairedCount = unpaimedMatches.filter(m => manualPairings[m.id]).length;

    // Groups: Render as compact grid cards (12 groups in 6x2 grid)
    let groupsHtml = '';
    for (const [group, teams] of Object.entries(wikipediaGroups).sort()) {
        const isSelected = selectedGroup === group;
        const matchCount = unpaimedMatches.filter(m => manualPairings[m.id] === group).length;

        groupsHtml += `
            <div class="group-item cursor-pointer transition border-2 rounded-lg ${isSelected ? 'bg-blue-500 text-white border-blue-700 shadow-lg scale-105' : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'}"
                 data-group="${group}"
                 style="padding: 10px;">
                <div class="flex items-center justify-between" style="margin-bottom: 6px;">
                    <div class="font-bold flex items-center" style="font-size: 15px; gap: 6px;">
                        <span class="flex items-center justify-center rounded-full ${isSelected ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}" style="width: 26px; height: 26px; font-size: 13px; font-weight: 700; flex-shrink: 0;">
                            ${group}
                        </span>
                    </div>
                    ${matchCount > 0 ? `<span class="${isSelected ? 'bg-blue-700 text-white' : 'bg-green-500 text-white'} rounded-full shadow" style="padding: 2px 7px; font-size: 10px; font-weight: 700;">${matchCount}</span>` : ''}
                </div>
                <div class="${isSelected ? 'text-blue-100' : 'text-slate-600'}" style="font-size: 9px; line-height: 1.3;">${teams.slice(0, 2).join(', ')}${teams.length > 2 ? '...' : ''}</div>
            </div>
        `;
    }
    groupsColumn.innerHTML = groupsHtml;

    // Matches: Render as compact grid cards (3 columns)
    let matchesHtml = '';
    if (unpaimedMatches.length === 0) {
        matchesHtml = '<div class="col-span-3 p-12 text-center text-green-600 text-lg font-semibold flex flex-col items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>All matches paired!</div>';
    } else {
        for (const match of unpaimedMatches) {
            const assignedGroup = manualPairings[match.id];
            const isPaired = !!assignedGroup;

            matchesHtml += `
                <div class="match-item cursor-pointer transition border-2 rounded-lg ${isPaired ? 'bg-green-100 border-green-500 shadow-md' : 'bg-amber-50 border-amber-400 hover:border-amber-500 hover:shadow-md'}"
                     data-match-id="${match.id}"
                     style="padding: 10px;">
                    <div class="flex items-center justify-between" style="margin-bottom: 6px;">
                        <div class="font-semibold ${isPaired ? 'text-green-900' : 'text-slate-800'}" style="font-size: 11px; line-height: 1.2;">
                            ${isPaired ? '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-green-600" style="display: inline; margin-right: 3px;"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-500" style="display: inline; margin-right: 3px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'}
                            <div>${match.homeTeam}</div>
                            <div class="text-slate-500 font-normal text-center" style="margin: 2px 0;">vs</div>
                            <div>${match.awayTeam}</div>
                        </div>
                    </div>
                    ${isPaired ? `<div class="bg-green-600 text-white rounded text-center shadow mb-2" style="padding: 3px; font-size: 10px; font-weight: 700;">Group ${assignedGroup}</div>` : ''}
                    <div class="text-slate-600" style="font-size: 9px; line-height: 1.3;">
                        <div style="margin-bottom: 2px;"><span class="text-slate-500">1X2:</span> <span style="font-family: monospace; font-weight: 600;">${match.odd1} / ${match.oddX} / ${match.odd2}</span></div>
                        <div><span class="text-slate-500">O/U:</span> <span style="font-family: monospace;">${match.oddOver} / ${match.oddUnder}</span></div>
                    </div>
                    ${match.homeGroup || match.awayGroup ? `
                        <div class="flex items-center bg-amber-100 rounded" style="font-size: 8px; margin-top: 4px; padding: 3px; gap: 2px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-600">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span class="text-amber-800" style="font-weight: 600;">
                                ${match.homeGroup ? `${match.homeTeam.split(' ')[0]}: ${match.homeGroup}` : ''}
                                ${match.homeGroup && match.awayGroup ? ' • ' : ''}
                                ${match.awayGroup ? `${match.awayTeam.split(' ')[0]}: ${match.awayGroup}` : ''}
                            </span>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }
    unmatchedColumn.innerHTML = matchesHtml;

    // Update stats display
    if (pairingStats) {
        pairingStats.innerHTML = `
            <span class="inline-flex items-center gap-2">
                <span class="text-slate-200">Unmatched paired:</span>
                <span class="font-bold text-xl ${pairedCount > 0 ? 'text-green-300' : 'text-slate-300'}">${pairedCount}</span>
                <span class="text-slate-400">/</span>
                <span class="font-bold text-xl text-amber-300">${unmatchedCount}</span>
            </span>
        `;
    }

    // Add click handlers for groups
    groupsColumn.querySelectorAll('.group-item').forEach(item => {
        item.addEventListener('click', () => {
            selectedGroup = item.dataset.group;
            addDebugLog(`Selected Group ${selectedGroup} for pairing`);
            displayPairingComparison(); // Refresh to show selection
        });
    });

    // Add click handlers for matches
    unmatchedColumn.querySelectorAll('.match-item').forEach(item => {
        item.addEventListener('click', () => {
            const matchId = item.dataset.matchId;

            if (selectedGroup) {
                // Pair this match with selected group
                if (manualPairings[matchId] === selectedGroup) {
                    // Unpair if clicking on already paired group
                    delete manualPairings[matchId];
                    addDebugLog(`Unpaired match ${matchId} from Group ${selectedGroup}`);
                    showStatus(csvStatus, 'info', `Unpaired match from Group ${selectedGroup}`);
                } else {
                    manualPairings[matchId] = selectedGroup;
                    addDebugLog(`Paired match ${matchId} with Group ${selectedGroup}`);
                    showStatus(csvStatus, 'success', `✅ Paired to Group ${selectedGroup}`);
                }
                displayPairingComparison(); // Refresh to show pairing
            } else {
                showStatus(csvStatus, 'warning', '⚠️ Please select a group first (left column)');
            }
        });
    });
}

// Cancel manual pairing
cancelManualPairingsBtn.addEventListener('click', () => {
    pairingComparison.classList.add('hidden');
    manualPairings = {};
    selectedGroup = null;
    addDebugLog('Manual pairing cancelled');
});

// Save manual pairings and regenerate CSV
saveManualPairingsBtn.addEventListener('click', () => {
    addDebugLog('Applying manual pairings and regenerating...');

    // Count how many manual pairings exist
    const manualPairingCount = Object.keys(manualPairings).length;

    if (manualPairingCount === 0) {
        showStatus(csvStatus, 'warning', '⚠️ No manual pairings to apply. Click groups and matches to pair them first.');
        return;
    }

    addDebugLog(`Applying ${manualPairingCount} manual pairings`);

    // Re-run auto-pair which will now include manual pairings
    autoPairBtn.click();
});

// Parse additional CSV data
function parseAdditionalCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const matches = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        // Try both semicolon, comma, and tab delimiters
        let parts = [];
        let delimiter = ';';

        if (line.includes('\t')) {
            parts = line.split('\t');
            delimiter = 'tab';
        } else if (line.includes(';')) {
            parts = line.split(';');
            delimiter = ';';
        } else {
            parts = line.split(',');
            delimiter = ',';
        }

        // Trim all parts
        parts = parts.map(p => p.trim());

        // Detect format based on number of columns
        let parsed = null;

        // Format 1: GROUP;TEAM_A;vs;TEAM_B;ODD1;ODDX;ODD2;ODD_UNDER;ODD_OVER (9 columns)
        if (parts.length === 9 && (parts[2].toLowerCase() === 'vs' || parts[2] === 'vs')) {
            const [group, homeTeam, vs, awayTeam, odd1, oddX, odd2, oddUnder, oddOver] = parts;
            parsed = { group, homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver };
        }
        // Format 2: GROUP;TEAM_A;TEAM_B;ODD1;ODDX;ODD2;ODD_UNDER;ODD_OVER (8 columns)
        else if (parts.length === 8) {
            const [group, homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver] = parts;
            parsed = { group, homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver };
        }
        // Format 3: GROUP	TEAM_A	vs	TEAM_B	ODD1	ODDX	ODD2	ODD_UNDER	ODD_OVER (tab-separated, 9 columns)
        else if (delimiter === 'tab' && parts.length === 9) {
            const [group, homeTeam, vs, awayTeam, odd1, oddX, odd2, oddUnder, oddOver] = parts;
            parsed = { group, homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver };
        }
        // Format 4: TEAM_A;vs;TEAM_B;ODD1;ODDX;ODD2;ODD_UNDER;ODD_OVER;GROUP (9 columns, group at end)
        else if (parts.length === 9 && (parts[1].toLowerCase() === 'vs' || parts[1] === 'vs')) {
            const [homeTeam, vs, awayTeam, odd1, oddX, odd2, oddUnder, oddOver, group] = parts;
            parsed = { group, homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver };
        }
        // Format 5: TEAM_A;TEAM_B;ODD1;ODDX;ODD2;ODD_UNDER;ODD_OVER;GROUP (8 columns, group at end)
        else if (parts.length === 8 && parts[7].length === 1 && /[A-L]/i.test(parts[7])) {
            const [homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver, group] = parts;
            parsed = { group, homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver };
        }
        // Format 6: TEAM_A	TEAM_B	ODD1	ODDX	ODD2	ODD_UNDER	ODD_OVER (7 columns, no group - try to infer)
        else if (parts.length === 7) {
            const [homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver] = parts;
            // Try to infer group from existing Wikipedia groups
            const group = inferGroupFromTeams(homeTeam, awayTeam);
            if (group) {
                parsed = { group, homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver };
            } else {
                errors.push(`Line ${i + 1}: Could not infer group for ${homeTeam} vs ${awayTeam} (use format with GROUP column)`);
                continue;
            }
        }
        // Format 7: TEAM_A	vs	TEAM_B	ODD1	ODDX	ODD2	ODD_UNDER	ODD_OVER (8 columns with vs, no group)
        else if (parts.length === 8 && (parts[1].toLowerCase() === 'vs' || parts[1] === 'vs')) {
            const [homeTeam, vs, awayTeam, odd1, oddX, odd2, oddUnder, oddOver] = parts;
            const group = inferGroupFromTeams(homeTeam, awayTeam);
            if (group) {
                parsed = { group, homeTeam, awayTeam, odd1, oddX, odd2, oddUnder, oddOver };
            } else {
                errors.push(`Line ${i + 1}: Could not infer group for ${homeTeam} vs ${awayTeam} (use format with GROUP column)`);
                continue;
            }
        }
        else {
            errors.push(`Line ${i + 1}: Invalid format (got ${parts.length} columns with delimiter '${delimiter}'). Expected 7-9 columns.`);
            continue;
        }

        if (!parsed) continue;

        // Validate required fields
        if (!parsed.homeTeam || !parsed.awayTeam) {
            errors.push(`Line ${i + 1}: Missing team names`);
            continue;
        }

        if (!parsed.group) {
            errors.push(`Line ${i + 1}: Missing group assignment`);
            continue;
        }

        // Parse and validate odds
        const odds = {
            odd1: parseFloat(parsed.odd1),
            oddX: parseFloat(parsed.oddX),
            odd2: parseFloat(parsed.odd2),
            oddUnder: parseFloat(parsed.oddUnder),
            oddOver: parseFloat(parsed.oddOver)
        };

        if (Object.values(odds).some(o => isNaN(o) || o <= 1.0)) {
            errors.push(`Line ${i + 1}: Invalid odds (must be > 1.0). Got: ${parsed.odd1}, ${parsed.oddX}, ${parsed.odd2}, ${parsed.oddUnder}, ${parsed.oddOver}`);
            continue;
        }

        matches.push({
            group: parsed.group.toUpperCase(),
            homeTeam: parsed.homeTeam,
            awayTeam: parsed.awayTeam,
            ...odds
        });
    }

    return { matches, errors };
}

// Helper function to infer group from team names using Wikipedia groups
function inferGroupFromTeams(homeTeam, awayTeam) {
    if (!wikipediaGroups) return null;

    const homeNorm = homeTeam.toLowerCase().trim();
    const awayNorm = awayTeam.toLowerCase().trim();

    for (const [group, teams] of Object.entries(wikipediaGroups)) {
        const hasHome = teams.some(t => t.toLowerCase().includes(homeNorm) || homeNorm.includes(t.toLowerCase()));
        const hasAway = teams.some(t => t.toLowerCase().includes(awayNorm) || awayNorm.includes(t.toLowerCase()));

        // Both teams must be in same group
        if (hasHome && hasAway) {
            return group;
        }
    }

    return null;
}

// Merge additional CSV data button
mergeAdditionalDataBtn.addEventListener('click', () => {
    const csvText = additionalMatchDataEl.value.trim();

    if (!csvText) {
        showStatus(additionalDataStatus, 'warning', '⚠️ Please paste CSV data first');
        return;
    }

    addDebugLog('Parsing additional CSV data...');

    const { matches, errors } = parseAdditionalCSV(csvText);

    if (errors.length > 0) {
        showStatus(additionalDataStatus, 'error', `❌ ${errors.length} errors found`);
        addDebugLog(`Parsing errors: ${errors.join(', ')}`);
        alert('CSV parsing errors:\n\n' + errors.join('\n'));
        return;
    }

    if (matches.length === 0) {
        showStatus(additionalDataStatus, 'warning', '⚠️ No valid matches found in CSV');
        return;
    }

    // Check for duplicates against existing paired data
    const duplicates = [];
    for (const match of matches) {
        const isDuplicate = pairedData.some(p =>
            p.group === match.group &&
            p.homeTeam === match.homeTeam &&
            p.awayTeam === match.awayTeam
        );

        if (isDuplicate) {
            duplicates.push(`${match.group}: ${match.homeTeam} vs ${match.awayTeam}`);
        }
    }

    if (duplicates.length > 0) {
        const proceed = confirm(
            `⚠️ Found ${duplicates.length} duplicate matches that already exist in API data:\n\n` +
            duplicates.slice(0, 5).join('\n') +
            (duplicates.length > 5 ? `\n...and ${duplicates.length - 5} more` : '') +
            '\n\nDo you want to merge anyway? Duplicates will be skipped.'
        );

        if (!proceed) {
            showStatus(additionalDataStatus, 'info', 'Merge cancelled');
            return;
        }

        // Filter out duplicates
        const uniqueMatches = matches.filter(match => {
            return !pairedData.some(p =>
                p.group === match.group &&
                p.homeTeam === match.homeTeam &&
                p.awayTeam === match.awayTeam
            );
        });

        additionalMatches = uniqueMatches;
        addDebugLog(`Merged ${uniqueMatches.length} unique matches (skipped ${duplicates.length} duplicates)`);
        showStatus(additionalDataStatus, 'success', `✅ Merged ${uniqueMatches.length} matches (${duplicates.length} duplicates skipped)`);
    } else {
        additionalMatches = matches;
        addDebugLog(`Merged ${matches.length} additional matches`);
        showStatus(additionalDataStatus, 'success', `✅ Merged ${matches.length} additional matches`);
    }

    // Regenerate CSV with merged data
    generateCSV();
});

// Clear additional data button
clearAdditionalDataBtn.addEventListener('click', () => {
    additionalMatchDataEl.value = '';
    additionalMatches = [];
    showStatus(additionalDataStatus, 'info', 'Cleared additional data');
    addDebugLog('Cleared additional matches');

    // Regenerate CSV without additional data
    if (pairedData && pairedData.length > 0) {
        generateCSV();
    }
});

// Initialize
addDebugLog('Admin panel initialized');
