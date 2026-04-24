/**
 * Schedule Loader Module
 * Fetches and processes official World Cup 2026 schedule
 */

const SCHEDULE_URL = 'https://soccer2026-cdn.maria-105.workers.dev/world-cup-schedule.json';

/**
 * Fetch official 2026 World Cup schedule
 * @returns {Promise<Object|null>} Schedule data with matches and groups, or null on error
 */
export async function fetchOfficialSchedule() {
    try {
        const response = await fetch(SCHEDULE_URL);
        if (!response.ok) {
            throw new Error(`Schedule fetch failed: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch official schedule:', error);
        return null;
    }
}

/**
 * Build group mapping from schedule data
 * @param {Object} scheduleData - Official schedule data
 * @returns {Object|null} Group mapping object {groupLabel: [teamNames...]}
 */
export function buildGroupMapping(scheduleData) {
    if (!scheduleData || !scheduleData.groups) {
        return null;
    }

    const scheduleMapping = {};

    for (const [groupLabel, groupData] of Object.entries(scheduleData.groups)) {
        const teamCodes = groupData.teams; // Extract teams array from group object
        scheduleMapping[groupLabel] = teamCodes.map(code => {
            // Find team name from matches
            const match = scheduleData.matches.find(m =>
                m.homeTeamId === code || m.awayTeamId === code
            );
            return match ? (match.homeTeamId === code ? match.homeTeam : match.awayTeam) : code.toUpperCase();
        });
    }

    return scheduleMapping;
}

/**
 * Get all teams from schedule with their group assignments
 * @param {Object} scheduleData - Official schedule data
 * @returns {Map<string, string>} Map of team name to group label
 */
export function getTeamGroupMapping(scheduleData) {
    const teamToGroup = new Map();

    if (!scheduleData || !scheduleData.groups) {
        return teamToGroup;
    }

    for (const [groupLabel, groupData] of Object.entries(scheduleData.groups)) {
        const teamCodes = groupData.teams;

        for (const code of teamCodes) {
            const match = scheduleData.matches.find(m =>
                m.homeTeamId === code || m.awayTeamId === code
            );

            if (match) {
                const teamName = match.homeTeamId === code ? match.homeTeam : match.awayTeam;
                teamToGroup.set(teamName, groupLabel);
            }
        }
    }

    return teamToGroup;
}
