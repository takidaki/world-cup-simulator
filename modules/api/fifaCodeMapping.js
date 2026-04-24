/**
 * FIFA Code Mapping Module
 * Maps 3-letter FIFA country codes to full team names
 */

// FIFA 3-letter codes to team names for World Cup 2026
// Based on official schedule structure
export const FIFA_CODE_TO_TEAM = {
    // Group A
    'mex': 'Mexico',
    'rsa': 'South Africa',
    'kor': 'South Korea',
    'cze': 'Czech Republic',

    // Group B
    'can': 'Canada',
    'bih': 'Bosnia and Herzegovina',
    'qat': 'Qatar',
    'sui': 'Switzerland',

    // Group C
    'bra': 'Brazil',
    'mar': 'Morocco',
    'sco': 'Scotland',
    'hai': 'Haiti',

    // Group D
    'usa': 'United States',
    'par': 'Paraguay',
    'aus': 'Australia',
    'tur': 'Turkey',

    // Group E
    'ger': 'Germany',
    'cuw': 'Curacao',
    'ned': 'Netherlands',
    'jpn': 'Japan',

    // Group F
    'civ': 'Ivory Coast',
    'ecu': 'Ecuador',
    'swe': 'Sweden',
    'tun': 'Tunisia',

    // Group G
    'esp': 'Spain',
    'cpv': 'Cape Verde',
    'bel': 'Belgium',
    'egy': 'Egypt',

    // Group H
    'ksa': 'Saudi Arabia',
    'uru': 'Uruguay',
    'irn': 'Iran',
    'nzl': 'New Zealand',

    // Group I
    'fra': 'France',
    'sen': 'Senegal',
    'irq': 'Iraq',
    'nor': 'Norway',

    // Group J
    'arg': 'Argentina',
    'alg': 'Algeria',
    'aut': 'Austria',
    'jor': 'Jordan',

    // Group K
    'por': 'Portugal',
    'cod': 'DR Congo',
    'eng': 'England',
    'cro': 'Croatia',

    // Group L
    'gha': 'Ghana',
    'pan': 'Panama',
    'uzb': 'Uzbekistan',
    'col': 'Colombia'
};

// Reverse mapping: team name -> FIFA code
export const TEAM_TO_FIFA_CODE = Object.fromEntries(
    Object.entries(FIFA_CODE_TO_TEAM).map(([code, name]) => [name, code])
);

/**
 * Get team name from FIFA code
 * @param {string} code - 3-letter FIFA code (e.g., 'mex')
 * @returns {string} Full team name or the code if not found
 */
export function getFIFATeamName(code) {
    if (!code) return code;
    const lowerCode = code.toLowerCase();
    return FIFA_CODE_TO_TEAM[lowerCode] || code.toUpperCase();
}

/**
 * Get FIFA code from team name
 * @param {string} teamName - Full team name
 * @returns {string|null} 3-letter FIFA code or null if not found
 */
export function getFIFACode(teamName) {
    if (!teamName) return null;

    // Try exact match first
    if (TEAM_TO_FIFA_CODE[teamName]) {
        return TEAM_TO_FIFA_CODE[teamName];
    }

    // Try case-insensitive match
    const lowerName = teamName.toLowerCase();
    for (const [name, code] of Object.entries(TEAM_TO_FIFA_CODE)) {
        if (name.toLowerCase() === lowerName) {
            return code;
        }
    }

    return null;
}
