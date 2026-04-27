/**
 * Match Odds Processor Module
 * Processes raw API match data into formatted CSV lines for the simulator textarea
 */

import { extractOdds } from '../api/oddsExtractor.js';
import { normalizeTeamName } from '../api/teamNameMapping.js';
import { filterGroupStageMatches } from './matchFilter.js';
import { detectGroupsFromMatches, buildTeamToGroupMap } from './groupDetection.js';

/**
 * Process raw API match data into formatted CSV lines for the match data textarea.
 * Handles group assignment via manual mapping, official schedule, or auto-detection.
 *
 * Output format (9-column tab-separated):
 *   group \t home \t away \t 1 \t X \t 2 \t value \t under \t over
 *
 * @param {Array} matches - Raw match data from The Odds API
 * @param {Object} options - Processing options
 * @param {Object} [options.manualGroupMapping] - Manual group mapping {groupLabel: [teamNames...]}
 * @param {Object} [options.scheduleData] - Official schedule data with groups
 * @param {boolean} [options.useScheduleGroups] - Whether to prefer schedule-based groups
 * @returns {Object} { csvLines: string[], warnings: string[], stats: Object }
 */
export function processMatchOddsData(matches, options = {}) {
    const { manualGroupMapping, scheduleData, useScheduleGroups = false } = options;
    const warnings = [];
    let teamToGroup = new Map();

    // Step 1: Filter to group stage matches only
    const filteredMatches = filterGroupStageMatches(matches, { scheduleData });

    // Step 2: Determine group assignments
    if (manualGroupMapping && Object.keys(manualGroupMapping).length > 0) {
        // Use manual mapping
        for (const [group, teams] of Object.entries(manualGroupMapping)) {
            teams.forEach(team => teamToGroup.set(team, group));
        }
    } else if (useScheduleGroups && scheduleData && scheduleData.groups) {
        // Use official schedule groups
        for (const [groupLabel, groupData] of Object.entries(scheduleData.groups)) {
            const teamCodes = groupData.teams || [];
            for (const code of teamCodes) {
                const match = scheduleData.matches?.find(m =>
                    m.homeTeamId === code || m.awayTeamId === code
                );
                if (match) {
                    const teamName = match.homeTeamId === code ? match.homeTeam : match.awayTeam;
                    teamToGroup.set(normalizeTeamName(teamName), groupLabel);
                }
            }
        }
    } else {
        // Auto-detect groups via BFS
        const groups = detectGroupsFromMatches(filteredMatches);
        teamToGroup = buildTeamToGroupMap(groups);
        if (groups.length > 0) {
            warnings.push(`Auto-detected ${groups.length} groups from match connections.`);
        }
    }

    // Step 3: Process each match into a 9-column CSV line
    const csvLines = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const match of filteredMatches) {
        const home = normalizeTeamName(match.home_team);
        const away = normalizeTeamName(match.away_team);

        // Determine group
        const homeGroup = teamToGroup.get(home) || teamToGroup.get(match.home_team);
        const awayGroup = teamToGroup.get(away) || teamToGroup.get(match.away_team);
        const group = homeGroup || awayGroup || '?';

        if (homeGroup && awayGroup && homeGroup !== awayGroup) {
            warnings.push(`${home} (Group ${homeGroup}) vs ${away} (Group ${awayGroup}) - cross-group match skipped.`);
            skippedCount++;
            continue;
        }

        // Extract odds
        const odds = extractOdds(match.bookmakers, match.home_team, match.away_team);
        if (!odds) {
            warnings.push(`No odds found for ${home} vs ${away} - skipped.`);
            skippedCount++;
            continue;
        }

        // Extract total goals line value from the totals market
        const goalLine = extractGoalLine(match.bookmakers) || 2.5;

        // Format: group \t home \t away \t 1 \t X \t 2 \t value \t under \t over
        csvLines.push(`${group}\t${home}\t${away}\t${odds.home}\t${odds.draw}\t${odds.away}\t${goalLine}\t${odds.under}\t${odds.over}`);
        processedCount++;
    }

    return {
        csvLines,
        warnings,
        stats: {
            totalInput: matches.length,
            filtered: filteredMatches.length,
            processed: processedCount,
            skipped: skippedCount
        }
    };
}

/**
 * Extract the total goals line value from bookmaker data.
 * Looks for the "totals" market point value (e.g. 2.5, 2.75, 3.0).
 *
 * @param {Array} bookmakers - Bookmaker data from The Odds API
 * @returns {number|null} Goal line value or null if not found
 */
function extractGoalLine(bookmakers) {
    if (!bookmakers || bookmakers.length === 0) return null;

    // Prefer Pinnacle
    const pinnacle = bookmakers.find(b => b.key === 'pinnacle' || b.title?.toLowerCase().includes('pinnacle'));
    if (pinnacle) {
        const line = getGoalLineFromBookmaker(pinnacle);
        if (line !== null) return line;
    }

    // Fallback: first bookmaker with totals market
    for (const bm of bookmakers) {
        const line = getGoalLineFromBookmaker(bm);
        if (line !== null) return line;
    }

    return null;
}

/**
 * Get goal line from a single bookmaker's totals market
 * @param {Object} bookmaker - Bookmaker object
 * @returns {number|null} Goal line value
 */
function getGoalLineFromBookmaker(bookmaker) {
    const totalsMarket = bookmaker.markets?.find(m => m.key === 'totals');
    if (!totalsMarket || !totalsMarket.outcomes) return null;

    const overOutcome = totalsMarket.outcomes.find(o => o.name === 'Over');
    if (overOutcome && overOutcome.point != null) {
        return overOutcome.point;
    }

    const underOutcome = totalsMarket.outcomes.find(o => o.name === 'Under');
    if (underOutcome && underOutcome.point != null) {
        return underOutcome.point;
    }

    return null;
}
