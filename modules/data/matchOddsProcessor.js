/**
 * Match Odds Processor Module
 * Processes match odds data from The Odds API and converts to CSV format
 */

import { extractOdds } from '../api/oddsExtractor.js';
import { detectGroupsFromMatches, buildTeamToGroupMap, validateGroups } from './groupDetection.js';
import { TEAM_NAME_MAPPING } from '../api/teamNameMapping.js';

/**
 * Process match odds data from The Odds API
 * @param {Array} matches - Array of match objects from API
 * @param {Object} options - Processing options
 * @param {Object} options.manualGroupMapping - Manual group mapping override
 * @param {Object} options.scheduleData - Official schedule data
 * @param {boolean} options.useScheduleGroups - Whether to use schedule groups
 * @returns {Object} Processing result {csvLines[], processedCount, skippedCount, warnings[]}
 */
export function processMatchOddsData(matches, options = {}) {
    const {
        manualGroupMapping = null,
        scheduleData = null,
        useScheduleGroups = false
    } = options;

    const csvLines = [];
    const warnings = [];
    let processedCount = 0;
    let skippedCount = 0;

    let teamToGroup = new Map();
    let groups = [];

    // Priority 1: Use manual mapping if available
    if (manualGroupMapping) {
        // Convert manual mapping to teamToGroup Map
        for (const [groupLabel, teamsList] of Object.entries(manualGroupMapping)) {
            groups.push({ label: groupLabel, teams: teamsList });
            for (const team of teamsList) {
                teamToGroup.set(team, groupLabel);
            }
        }
        warnings.push(`Using manual group mapping: ${groups.length} groups defined`);
    } else if (useScheduleGroups && scheduleData && scheduleData.groups) {
        // Priority 2: Use official schedule groups
        for (const [groupLabel, groupData] of Object.entries(scheduleData.groups)) {
            const teamCodes = groupData.teams; // Extract teams array from group object
            const teamNames = [];
            for (const code of teamCodes) {
                // Find team name from schedule matches
                const match = scheduleData.matches.find(m =>
                    m.homeTeamId === code || m.awayTeamId === code
                );
                if (match) {
                    const teamName = match.homeTeamId === code ? match.homeTeam : match.awayTeam;
                    teamNames.push(teamName);
                    teamToGroup.set(teamName, groupLabel);
                    // Also map normalized variations
                    for (const [variation, canonical] of Object.entries(TEAM_NAME_MAPPING)) {
                        if (canonical === teamName) {
                            teamToGroup.set(variation, groupLabel);
                        }
                    }
                }
            }
            groups.push({ label: groupLabel, teams: teamNames });
        }
        warnings.push(`Using official schedule groups: ${groups.length} groups loaded`);
    } else {
        // Priority 3: Auto-detect groups using BFS
        groups = detectGroupsFromMatches(matches);
        teamToGroup = buildTeamToGroupMap(groups);
    }

    // Process matches with detected groups
    for (const match of matches) {
        const homeTeam = match.home_team;
        const awayTeam = match.away_team;
        const group = teamToGroup.get(homeTeam);

        if (!group) {
            warnings.push(`Could not determine group for: ${homeTeam} vs ${awayTeam}`);
            skippedCount++;
            continue;
        }

        // Extract odds using Pinnacle-first strategy
        const oddsResult = extractOdds(match.bookmakers, homeTeam, awayTeam);

        if (!oddsResult) {
            warnings.push(`Incomplete odds data for: ${homeTeam} vs ${awayTeam}`);
            skippedCount++;
            continue;
        }

        // Format: GROUP, TEAM_A, vs, TEAM_B, ODD1, ODDX, ODD2, ODD_U, ODD_O
        const csvLine = `${group}, ${homeTeam}, vs, ${awayTeam}, ${oddsResult.home}, ${oddsResult.draw}, ${oddsResult.away}, ${oddsResult.under}, ${oddsResult.over}`;
        csvLines.push(csvLine);
        processedCount++;
    }

    // Add group validation warnings
    const validation = validateGroups(groups);
    warnings.push(...validation.warnings);

    return {
        csvLines,
        processedCount,
        skippedCount,
        warnings
    };
}
