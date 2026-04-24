/**
 * Group Detection Module
 * Automatically detects groups from match data using graph-based BFS algorithm
 */

/**
 * Detect groups from matches using graph-based connected components algorithm
 * @param {Array} matches - Array of match objects with home_team and away_team
 * @returns {Array} Array of group objects {label, teams[]}
 */
export function detectGroupsFromMatches(matches) {
    const teamConnections = new Map();

    // Build connection graph
    for (const match of matches) {
        const home = match.home_team;
        const away = match.away_team;

        if (!teamConnections.has(home)) teamConnections.set(home, new Set());
        if (!teamConnections.has(away)) teamConnections.set(away, new Set());

        teamConnections.get(home).add(away);
        teamConnections.get(away).add(home);
    }

    // Find connected components (groups) using BFS
    const visited = new Set();
    const groupLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const groups = [];

    for (const [team, connections] of teamConnections) {
        if (visited.has(team)) continue;

        // BFS to find all connected teams (same group)
        const queue = [team];
        const currentGroup = [];
        visited.add(team);

        while (queue.length > 0) {
            const current = queue.shift();
            currentGroup.push(current);

            const connected = teamConnections.get(current) || new Set();
            for (const neighbor of connected) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }

        // Assign group label
        const groupLabel = groupLabels[groups.length] || `G${groups.length + 1}`;
        groups.push({ label: groupLabel, teams: currentGroup });
    }

    return groups;
}

/**
 * Build team-to-group mapping from groups array
 * @param {Array} groups - Array of group objects {label, teams[]}
 * @returns {Map<string, string>} Map of team name to group label
 */
export function buildTeamToGroupMap(groups) {
    const teamToGroup = new Map();

    for (const group of groups) {
        for (const team of group.teams) {
            teamToGroup.set(team, group.label);
        }
    }

    return teamToGroup;
}

/**
 * Validate group structure
 * @param {Array} groups - Array of group objects
 * @returns {Object} Validation result {valid, incompleteGroups[], warnings[]}
 */
export function validateGroups(groups) {
    const incompleteGroups = groups.filter(g => g.teams.length < 4);
    const warnings = [];

    if (incompleteGroups.length > 0 && incompleteGroups.length <= 10) {
        incompleteGroups.forEach(g => {
            warnings.push(`Group ${g.label}: ${g.teams.length} teams (${g.teams.join(', ')}) - may be incomplete`);
        });
    } else if (groups.length > 0) {
        warnings.push(`Detected ${groups.length} groups from match data`);
    }

    return {
        valid: incompleteGroups.length === 0,
        incompleteGroups,
        warnings
    };
}
