/**
 * Team Mapper UI Module
 * Interactive UI for assigning teams to groups
 */

const GROUP_OPTIONS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

/**
 * Generate team mapping table HTML
 * @param {Array<string>} teams - Sorted array of team names
 * @param {Object} teamToGroup - Object mapping team names to group labels
 * @returns {string} HTML string for table rows
 */
export function generateTeamMappingTable(teams, teamToGroup = {}) {
    return teams.map(team => {
        const currentGroup = teamToGroup[team] || '';
        return `
            <tr class="hover:bg-slate-50">
                <td class="px-4 py-2 font-medium text-slate-700">${team}</td>
                <td class="px-4 py-2">
                    <select class="team-group-select field-input-xs w-32" data-team="${team}">
                        <option value="">-- Select --</option>
                        ${GROUP_OPTIONS
                            .map(g => `<option value="${g}" ${currentGroup === g ? 'selected' : ''}>${g}</option>`)
                            .join('')}
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Extract teams from API match data
 * @param {Array} matchData - Array of match objects with home_team and away_team
 * @returns {Array<string>} Sorted array of unique team names
 */
export function extractTeamsFromMatches(matchData) {
    const teams = new Set();
    matchData.forEach(match => {
        teams.add(match.home_team);
        teams.add(match.away_team);
    });
    return Array.from(teams).sort();
}

/**
 * Collect team-to-group mapping from DOM select elements
 * @returns {Object} Object mapping group labels to arrays of team names
 */
export function collectTeamMappingFromDOM() {
    const selects = document.querySelectorAll('.team-group-select');
    const mapping = {};

    selects.forEach(select => {
        const team = select.dataset.team;
        const group = select.value;

        if (group) {
            if (!mapping[group]) {
                mapping[group] = [];
            }
            mapping[group].push(team);
        }
    });

    return mapping;
}

/**
 * Count unassigned teams in the current mapping
 * @returns {number} Count of teams without group assignment
 */
export function countUnassignedTeams() {
    const selects = document.querySelectorAll('.team-group-select');
    return Array.from(selects).filter(s => !s.value).length;
}

/**
 * Clear all team selections in the DOM
 */
export function clearAllTeamSelections() {
    const selects = document.querySelectorAll('.team-group-select');
    selects.forEach(select => select.value = '');
}

/**
 * Convert group mapping to CSV format
 * @param {Object} groupMapping - Object mapping group labels to team arrays
 * @returns {string} CSV formatted string
 */
export function groupMappingToCSV(groupMapping) {
    const csvLines = [];
    for (const [group, teams] of Object.entries(groupMapping)) {
        teams.forEach(team => csvLines.push(`${group},${team}`));
    }
    return csvLines.join('\n');
}

/**
 * Show/hide mapper UI elements
 * @param {HTMLElement} tableContainer - Table container element
 * @param {HTMLElement} placeholder - Placeholder element
 * @param {boolean} showTable - Whether to show table (true) or placeholder (false)
 */
export function toggleMapperDisplay(tableContainer, placeholder, showTable) {
    if (showTable) {
        tableContainer.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        tableContainer.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }
}

/**
 * Initialize team mapper event handlers
 * @param {Object} config - Configuration object with DOM elements and callbacks
 */
export function initializeTeamMapper(config) {
    const {
        // DOM elements
        loadFromScheduleBtn,
        loadFromApiBtn,
        saveBtn,
        resetBtn,
        tableBody,
        tableContainer,
        placeholder,
        statusElement,
        groupMappingTextarea,
        matchDataTextarea,

        // Callbacks and data providers
        getOfficialSchedule,
        loadOfficialSchedule,
        getApiMatchData,
        getExistingMapping,
        setManualMapping,
        processOddsData,
        getTeamGroupMapping
    } = config;

    // Load teams from official schedule
    if (loadFromScheduleBtn) {
        loadFromScheduleBtn.addEventListener('click', async () => {
            try {
                statusElement.innerHTML = '<span class="text-blue-500">Loading official schedule...</span>';

                let scheduleData = getOfficialSchedule();
                if (!scheduleData) {
                    await loadOfficialSchedule();
                    scheduleData = getOfficialSchedule();
                }

                if (!scheduleData || !scheduleData.groups) {
                    statusElement.innerHTML = '<span class="text-red-500">Failed to load official schedule.</span>';
                    return;
                }

                // Build team list from schedule with pre-assigned groups
                const teamToGroupMap = getTeamGroupMapping(scheduleData);
                const teamToGroup = Object.fromEntries(teamToGroupMap);
                const sortedTeams = Object.keys(teamToGroup).sort();

                // Generate and display table
                tableBody.innerHTML = generateTeamMappingTable(sortedTeams, teamToGroup);
                toggleMapperDisplay(tableContainer, placeholder, true);

                statusElement.innerHTML = `<span class="text-green-500 font-medium">✅ Loaded ${sortedTeams.length} teams from official 2026 WC schedule with groups pre-assigned!</span>`;
            } catch (error) {
                statusElement.innerHTML = `<span class="text-red-500">Error: ${error.message}</span>`;
                console.error('Schedule load error:', error);
            }
        });
    }

    // Load teams from fetched API data
    if (loadFromApiBtn) {
        loadFromApiBtn.addEventListener('click', () => {
            const apiData = getApiMatchData();

            if (!apiData || apiData.length === 0) {
                statusElement.innerHTML = '<span class="text-red-500">No API data found. Click "Fetch All Odds" first.</span>';
                return;
            }

            // Extract teams and get existing mapping
            const sortedTeams = extractTeamsFromMatches(apiData);
            const existingMapping = getExistingMapping() || {};

            const teamToGroup = {};
            for (const [group, teamsList] of Object.entries(existingMapping)) {
                teamsList.forEach(team => teamToGroup[team] = group);
            }

            // Generate and display table
            tableBody.innerHTML = generateTeamMappingTable(sortedTeams, teamToGroup);
            toggleMapperDisplay(tableContainer, placeholder, true);

            statusElement.innerHTML = `<span class="text-blue-500">Loaded ${sortedTeams.length} teams. Assign groups and click Save.</span>`;
        });
    }

    // Save team mapping
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const newMapping = collectTeamMappingFromDOM();
            const unassignedCount = countUnassignedTeams();

            // Update manual mapping
            setManualMapping(newMapping);

            // Update textarea
            const csvData = groupMappingToCSV(newMapping);
            if (groupMappingTextarea) {
                groupMappingTextarea.value = csvData;
                localStorage.setItem('group_mapping_data', csvData);
            }

            // Show status
            const groupCount = Object.keys(newMapping).length;
            const teamCount = Object.values(newMapping).flat().length;

            if (unassignedCount > 0) {
                statusElement.innerHTML = `<span class="text-amber-500">⚠️ ${unassignedCount} teams not assigned. Assign all teams or continue anyway.</span>`;
            } else {
                statusElement.innerHTML = `<span class="text-green-500 font-medium">✅ Saved: ${groupCount} groups, ${teamCount} teams</span>`;
            }

            // Re-process match data with new group assignments
            const apiData = getApiMatchData();
            if (apiData && matchDataTextarea) {
                const result = processOddsData(apiData);
                matchDataTextarea.value = result.csvLines.join('\n');
                statusElement.innerHTML += `<br><span class="text-blue-500">Match data updated with new group assignments.</span>`;
            }
        });
    }

    // Reset team mapping
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearAllTeamSelections();
            statusElement.innerHTML = '<span class="text-slate-500">All selections cleared.</span>';
        });
    }
}
