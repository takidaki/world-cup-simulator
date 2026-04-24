/**
 * Match Filter Module
 * Filters and deduplicates match data from The Odds API
 */

import { normalizeTeamName } from '../api/teamNameMapping.js';
import { getFIFATeamName } from '../api/fifaCodeMapping.js';

/**
 * Filter matches to include only group stage games
 * Eliminates knockout/playoff matches that create false group connections
 *
 * Strategy:
 * 1. Deduplicate matches (same teams, different order)
 * 2. Use official schedule if available to validate group stage matches
 * 3. Apply heuristics if no schedule: limit to reasonable group stage window
 *
 * @param {Array} matches - Raw match data from API
 * @param {Object} options - Filter options
 * @param {Object} options.scheduleData - Official schedule with group assignments
 * @param {Date} options.groupStageEndDate - Last date of group stage (if known)
 * @returns {Array} Filtered matches for group stage only
 */
export function filterGroupStageMatches(matches, options = {}) {
    const { scheduleData = null, groupStageEndDate = null } = options;

    // Step 1: Deduplicate matches
    const deduplicatedMatches = deduplicateMatches(matches);

    // Step 2: If we have official schedule, use it to validate
    if (scheduleData && scheduleData.groups && scheduleData.matches) {
        return filterUsingOfficialSchedule(deduplicatedMatches, scheduleData);
    }

    // Step 3: Fallback - use date-based filtering
    if (groupStageEndDate) {
        return filterByDate(deduplicatedMatches, groupStageEndDate);
    }

    // Step 4: Last resort - use match count heuristics
    // World Cup 2026: 12 groups × 6 matches per group = 72 group stage matches max
    // If we have way more matches, something is wrong
    return filterByHeuristics(deduplicatedMatches);
}

/**
 * Deduplicate matches (same teams playing each other)
 * The Odds API might return both "A vs B" and "B vs A"
 * @param {Array} matches - Array of match objects
 * @returns {Array} Deduplicated matches
 */
function deduplicateMatches(matches) {
    const seen = new Set();
    const deduplicated = [];

    for (const match of matches) {
        const home = normalizeTeamName(match.home_team);
        const away = normalizeTeamName(match.away_team);

        // Create a canonical key (alphabetically sorted teams)
        const teams = [home, away].sort();
        const key = `${teams[0]}||${teams[1]}`;

        if (!seen.has(key)) {
            seen.add(key);
            // Store with normalized names
            deduplicated.push({
                ...match,
                home_team: home,
                away_team: away
            });
        }
    }

    return deduplicated;
}

/**
 * Filter matches using official schedule as ground truth
 * Only include matches where both teams are in the same group
 * @param {Array} matches - Deduplicated match array
 * @param {Object} scheduleData - Official schedule data
 * @returns {Array} Group stage matches only
 */
function filterUsingOfficialSchedule(matches, scheduleData) {
    // Build team-to-group mapping from schedule
    const teamToGroup = new Map();

    // Note: Schedule structure validated
    // - 12 groups with 4 teams each (48 teams total)
    // - 104 group stage matches in schedule

    for (const [groupLabel, groupData] of Object.entries(scheduleData.groups)) {
        const teamCodes = groupData.teams;

        for (const code of teamCodes) {
            // Convert FIFA code to team name
            const teamName = getFIFATeamName(code);
            const normalizedName = normalizeTeamName(teamName);

            // Map all variations
            teamToGroup.set(teamName, groupLabel);         // Original from FIFA mapping
            teamToGroup.set(normalizedName, groupLabel);   // Normalized version
            teamToGroup.set(code, groupLabel);             // FIFA code itself
            teamToGroup.set(code.toUpperCase(), groupLabel); // Uppercase code
        }
    }

    // Filter: only keep matches where both teams are in the same group
    const filtered = matches.filter((match) => {
        const homeNormalized = normalizeTeamName(match.home_team);
        const awayNormalized = normalizeTeamName(match.away_team);

        const homeGroup = teamToGroup.get(homeNormalized) || teamToGroup.get(match.home_team);
        const awayGroup = teamToGroup.get(awayNormalized) || teamToGroup.get(match.away_team);

        // Both teams must be in the same group for it to be a group stage match
        return homeGroup && awayGroup && homeGroup === awayGroup;
    });

    return filtered;
}

/**
 * Filter matches by date (group stage ends before knockout)
 * @param {Array} matches - Deduplicated match array
 * @param {Date} groupStageEndDate - End date of group stage
 * @returns {Array} Matches before the cutoff date
 */
function filterByDate(matches, groupStageEndDate) {
    return matches.filter(match => {
        if (!match.commence_time) return true; // Include if no date
        const matchDate = new Date(match.commence_time);
        return matchDate <= groupStageEndDate;
    });
}

/**
 * Filter using heuristics when no schedule is available
 * WARNING: This is less reliable than using official schedule data
 * Best practice: Always load official schedule first via "Fetch All Odds"
 *
 * @param {Array} matches - Deduplicated match array
 * @returns {Array} Filtered matches (best effort, may include some errors)
 */
function filterByHeuristics(matches) {
    // Build team statistics
    const teamMatchCount = new Map();
    const teamOpponents = new Map();

    for (const match of matches) {
        const home = match.home_team;
        const away = match.away_team;

        teamMatchCount.set(home, (teamMatchCount.get(home) || 0) + 1);
        teamMatchCount.set(away, (teamMatchCount.get(away) || 0) + 1);

        if (!teamOpponents.has(home)) teamOpponents.set(home, new Set());
        if (!teamOpponents.has(away)) teamOpponents.set(away, new Set());
        teamOpponents.get(home).add(away);
        teamOpponents.get(away).add(home);
    }

    // Strategy 1: Keep matches where BOTH teams have exactly 3 opponents (perfect groups)
    const perfectMatches = matches.filter(match => {
        const homeOpponents = teamOpponents.get(match.home_team);
        const awayOpponents = teamOpponents.get(match.away_team);
        return homeOpponents && awayOpponents &&
               homeOpponents.size === 3 && awayOpponents.size === 3;
    });

    // If we found perfect group structure, use it
    if (perfectMatches.length >= 6) { // At least one complete group
        return perfectMatches;
    }

    // Strategy 2: Keep all matches, let BFS group detection handle it
    // This is fallback when heuristics can't determine clean groups
    // The user will see warnings about group sizes and can fix manually
    return matches;
}

/**
 * Validate filtered results
 * @param {Array} filteredMatches - Filtered match array
 * @returns {Object} Validation report {valid, warnings[], stats}
 */
export function validateFilteredMatches(filteredMatches) {
    const warnings = [];
    const teams = new Set();
    const matchesPerTeam = new Map();

    for (const match of filteredMatches) {
        teams.add(match.home_team);
        teams.add(match.away_team);

        matchesPerTeam.set(match.home_team, (matchesPerTeam.get(match.home_team) || 0) + 1);
        matchesPerTeam.set(match.away_team, (matchesPerTeam.get(match.away_team) || 0) + 1);
    }

    const teamCount = teams.size;
    const expectedGroups = teamCount / 4; // Assuming 4 teams per group
    const expectedMatchesPerTeam = 3; // Each team plays 3 group matches

    // Check if team count is divisible by 4
    if (teamCount % 4 !== 0) {
        warnings.push(`⚠️ Team count (${teamCount}) not divisible by 4 - may include non-group matches`);
    }

    // Check if each team has exactly 3 matches
    for (const [team, count] of matchesPerTeam) {
        if (count !== expectedMatchesPerTeam) {
            warnings.push(`⚠️ ${team}: ${count} matches (expected ${expectedMatchesPerTeam})`);
        }
    }

    return {
        valid: warnings.length === 0,
        warnings,
        stats: {
            totalMatches: filteredMatches.length,
            uniqueTeams: teamCount,
            estimatedGroups: Math.round(expectedGroups),
            avgMatchesPerTeam: filteredMatches.length * 2 / teamCount
        }
    };
}
