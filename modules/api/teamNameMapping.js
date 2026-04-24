/**
 * Team Name Mapping Module
 * Handles normalization of team names between different data sources
 */

// Team name mapping from API to schedule (common variations)
// Maps: API name -> Canonical name (as used in official schedule)
export const TEAM_NAME_MAPPING = {
    'USA': 'United States',
    'DR Congo': 'D.R. Congo',
    'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
    'Czech Republic': 'Czechia',
    'Czechia': 'Czech Republic', // Reverse mapping too
    'Ivory Coast': "Côte d'Ivoire",
    "Cote d'Ivoire": "Côte d'Ivoire",
    'Curacao': 'Curaçao',
    'United States': 'USA', // Also handle reverse
    'D.R. Congo': 'DR Congo',
    'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
};

/**
 * Normalize team name to canonical form
 * Handles various API and schedule name variations
 * @param {string} name - Original team name
 * @returns {string} Normalized team name
 */
export function normalizeTeamName(name) {
    if (!name) return name;

    // First check direct mapping
    if (TEAM_NAME_MAPPING[name]) {
        return TEAM_NAME_MAPPING[name];
    }

    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(TEAM_NAME_MAPPING)) {
        if (key.toLowerCase() === lowerName) {
            return value;
        }
    }

    // Return original if no mapping found
    return name;
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
