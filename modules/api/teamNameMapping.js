/**
 * Team Name Mapping Module
 * Handles normalization of team names between different data sources
 */

// Team name mapping from API to schedule (common variations)
export const TEAM_NAME_MAPPING = {
    'USA': 'United States',
    'DR Congo': 'D.R. Congo',
    'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
    'Czech Republic': 'Czechia',
    'Ivory Coast': "Côte d'Ivoire",
};

/**
 * Normalize team name to canonical form
 * @param {string} name - Original team name
 * @returns {string} Normalized team name
 */
export function normalizeTeamName(name) {
    return TEAM_NAME_MAPPING[name] || name;
}

/**
 * Get reverse mapping (canonical -> variations)
 * @returns {Map<string, string[]>} Map of canonical names to their variations
 */
export function getReverseMapping() {
    const reverseMap = new Map();
    for (const [variation, canonical] of Object.entries(TEAM_NAME_MAPPING)) {
        if (!reverseMap.has(canonical)) {
            reverseMap.set(canonical, []);
        }
        reverseMap.get(canonical).push(variation);
    }
    return reverseMap;
}
