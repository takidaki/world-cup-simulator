/**
 * Team-wise odds CSV generator for World Cup 2026
 * Generates individual CSV files for each team with their specific betting markets
 * Based on the structure of odds_Mexico.csv
 */

const fs = require('fs');
const path = require('path');

// All teams in World Cup 2026
const teams = [
    // Group A
    'Mexico', 'South Africa', 'South Korea', 'Czech Republic',
    // Group B
    'Canada', 'Bosnia & Herzegovina', 'USA', 'Paraguay',
    // Group C
    'Qatar', 'Switzerland', 'Brazil', 'Morocco',
    // Group D
    'Haiti', 'Scotland', 'Australia', 'Turkey',
    // Group E
    'Germany', 'Curacao', 'Netherlands', 'Japan',
    // Group F
    'Ivory Coast', 'Ecuador', 'Sweden', 'Tunisia',
    // Group G
    'Spain', 'Cape Verde', 'Belgium', 'Egypt',
    // Group H
    'Saudi Arabia', 'Uruguay', 'Iran', 'New Zealand',
    // Group I
    'France', 'Senegal', 'Iraq', 'Norway',
    // Group J
    'Argentina', 'Algeria', 'Austria', 'Jordan',
    // Group K
    'Portugal', 'D.R. Congo', 'England', 'Croatia',
    // Group L
    'Ghana', 'Panama', 'Uzbekistan', 'Colombia'
];

/**
 * Generates a team-specific odds CSV file
 * @param {string} teamName - Name of the team
 */
function generateTeamOddsCSV(teamName) {
    const timestamp = '1.4.2026';
    const time = '11:22';

    // CSV header
    const lines = [
        'Datum;Vreme;Sifra;Domacin;Gost;1;X;2;GR;U;O;Yes;No',
        `MATCH_NAME:World Cup 2026;;;;;;;;;;;`,
        `LEAGUE_NAME:${teamName};;;;;;;;;;;`,
        ';;;Pobednik Grupe;;;;;;;;;',
        `${timestamp};${time};;2. mesto u grupi;;;;;;;;;`,
        `${timestamp};${time};;3. mesto u grupi;;;;;;;;;`,
        `${timestamp};${time};;4. mesto u grupi;;;;;;;;;`,
        `${timestamp};${time};;prolazi grupu;;;;;;;;;`,
        `${timestamp};${time};;eliminacija u 1/16 finala;;;;;;;;;`,
        `${timestamp};${time};;eliminacija u 1/8 finala;;;;;;;;;`,
        `${timestamp};${time};;eliminacija u 1/4 finala;;;;;;;;;`,
        `${timestamp};${time};;eliminacija u 1/2 finala;;;;;;;;;`,
        `${timestamp};${time};;eliminacija u finalu;;;;;;;;;`,
        `${timestamp};${time};;dolazi do 1/16 finala;;;;;;;;;`,
        `${timestamp};${time};;dolazi do 1/8 finala;;;;;;;;;`,
        `${timestamp};${time};;dolazi do 1/4 finala;;;;;;;;;`,
        `${timestamp};${time};;dolazi do 1/2 finala;;;;;;;;;`,
        `${timestamp};${time};;dolazi do finala;;;;;;;;;`,
        `${timestamp};${time};;0 bodova u grupi;;;;;;;;;`,
        `${timestamp};${time};;1 bod u grupi;;;;;;;;;`,
        `${timestamp};${time};;2 boda u grupi;;;;;;;;;`,
        `${timestamp};${time};;3 boda u grupi;;;;;;;;;`,
        `${timestamp};${time};;4 boda u grupi;;;;;;;;;`,
        `${timestamp};${time};;5 bodova u grupi;;;;;;;;;`,
        ';;;6 bodova u grupi;;;;;;;;;',
        ';;;7 bodova u grupi;;;;;;;;;',
        ';;;9 bodova u grupi;;;;;;;;;',
        ';;;1-3 boda u grupi;;;;;;;;;',
        ';;;2-4 boda u grupi;;;;;;;;;',
        ';;;4-6 bodova u grupi;;;;;;;;;',
        ';;;7+ bodova u grupi;;;;;;;;;',
        ';;;osvojenih bodova u grupi1;;;;;5.5;;;;',
        ';;;osvojenih bodova u grupi2;;;;;4.5;;;;',
        ';;;osvojenih bodova u grupi3;;;;;3.5;;;;',
        ';;;datih golova u grupi1;;;;;5.5;;;;',
        ';;;datih golova u grupi2;;;;;4.5;;;;',
        ';;;datih golova u grupi3;;;;;3.5;;;;',
        ';;;1-2 datih golova u grupi;;;;;;;;;',
        ';;;1-3 datih golova u grupi;;;;;;;;;',
        ';;;2-4 datih golova u grupi;;;;;;;;;',
        ';;;4-6 datih golova u grupi;;;;;;;;;',
        ';;;5-7 datih golova u grupi;;;;;;;;;',
        ';;;primljenih golova u grupi1;;;;;2.5;;;;',
        ';;;primljenih golova u grupi2;;;;;3.5;;;;',
        ';;;primljenih golova u grupi3;;;;;4.5;;;;',
        ';;;Najvise datih golova na turniru;;;;;;;;;',
        ';;;Najvise primljenih golova na turniru;;;;;;;;;',
        ';;;Daje gol na svakoj utakmici u grupi;;;;;;;;;',
        ';;;broj pobeda u grupi;;;;;1.5;;;;',
        ';;;broj neresenih u grupi;;;;;0.5;;;;',
        ';;;broj datih golova na turniru;;;;;9.5;;;;',
        ''
    ];

    return lines.join('\n');
}

/**
 * Sanitizes team name for use in filename
 * @param {string} teamName - Team name
 * @returns {string} - Sanitized filename
 */
function sanitizeFileName(teamName) {
    return teamName
        .replace(/&/g, 'and')
        .replace(/\./g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Main function to generate all team CSV files
 */
function generateAllTeamCSVs() {
    const outputDir = __dirname;

    teams.forEach(team => {
        const fileName = `odds_${sanitizeFileName(team)}.csv`;
        const filePath = path.join(outputDir, fileName);
        const csvContent = generateTeamOddsCSV(team);

        fs.writeFileSync(filePath, csvContent, 'utf8');
        console.log(`✓ Generated: ${fileName}`);
    });

    console.log(`\n✓ Successfully generated ${teams.length} team odds CSV files`);
}

// Run the generator
if (require.main === module) {
    generateAllTeamCSVs();
}

module.exports = {
    generateTeamOddsCSV,
    generateAllTeamCSVs,
    teams
};
