import { runKnockoutStage } from './modules/knockoutStage.js';
import { initializeKnockoutStats, incrementRoundReach, recordMatchupInPath } from './modules/knockoutStats.js';
import { initializeTabSwitching } from './modules/uiTabs.js';
import { fetchOfficialSchedule, getTeamGroupMapping } from './modules/api/scheduleLoader.js';
import { processMatchOddsData } from './modules/data/matchOddsProcessor.js';
import { TEAM_NAME_MAPPING } from './modules/api/teamNameMapping.js';
import { initializeTeamMapper } from './modules/ui/teamMapper.js';
import { renderStatus as renderStatusUI, showInlineError } from './modules/ui/statusRenderer.js';
import { getOddsApiKey, setOddsApiKey, getGroupMappingData, setGroupMappingData, removeGroupMappingData } from './utils/storage.js';
import { createSection, createTeamLambdaTable, createMatchLambdaTable } from './utils/html.js';

                // --- Tab Switching Logic ---
        initializeTabSwitching();

// --- Global Variables ---
        let parsedMatches = [], parsedBracketMatches = [], teamEloRatings = {}, allTeams = new Set(), groupedMatches = {}, groupTeamNames = {}, teamMarketRatings = {}, targetOutrightProbs = {}, simulationAggStats = {}, currentNumSims = 0;
        let lockedScenarios = {}; // key: "team1||team2", value: { g1, g2 }
        let currentDCRho = 0;
        let currentLanguage = 'en';
        let manualGroupMapping = null; // Custom team-to-group mapping from admin panel
        let lastFetchedApiData = null; // Store last API response for team mapper
        let officialScheduleData = null; // Official 2026 WC schedule from JSON

        // --- Wrapper Functions for Modularized Code ---
        // These wrappers maintain compatibility with existing code while using new modules

        async function loadOfficialSchedule() {
            officialScheduleData = await fetchOfficialSchedule();
            return officialScheduleData;
        }

        function processOddsData(matches, useScheduleGroups = false) {
            return processMatchOddsData(matches, {
                manualGroupMapping,
                scheduleData: officialScheduleData,
                useScheduleGroups
            });
        }

        // --- Localization ---
        const translations = {
            en: {
                groupWinner: 'Group Winner',
                advanceFurther: 'Advance',
                place2: '2nd place in group',
                place3: '3rd place in group',
                place4: '4th place in group',
                directQual: 'Direct qualification (Top {n})',
                bestThirdQual: 'Qualify as best 3rd',
                ptsExact: '{n} points in group',
                pts1_3: '1-3 points in group',
                pts2_4: '2-4 points in group',
                pts4_6: '4-6 points in group',
                ptsOU: 'Points in group',
                anyTeam: 'Any team',
                pts9: '9 points',
                pts0: '0 points',
                firstPlaced: 'First-placed team',
                lastPlaced: 'Last-placed team',
                exactOrder12: 'Exact order 1st-2nd',
                topTwoAny: 'Top two in group',
                leagueName: 'Group {g}',
            },
            sr: {
                groupWinner: 'Pobednik grupe',
                advanceFurther: 'Prolazi dalje',
                place2: '2. mesto u grupi',
                place3: '3. mesto u grupi',
                place4: '4. mesto u grupi',
                directQual: 'Direktan prolaz (Top {n})',
                bestThirdQual: 'Prolaz kao najbolja 3.',
                ptsExact: '{n} bodova u grupi',
                pts1_3: '1-3 boda u grupi',
                pts2_4: '2-4 boda u grupi',
                pts4_6: '4-6 bodova u grupi',
                ptsOU: 'Osvojenih bodova u grupi',
                anyTeam: 'Bilo koji tim',
                pts9: '9 bodova',
                pts0: '0 bodova',
                firstPlaced: 'Prvoplasirani tim',
                lastPlaced: 'Poslednjeplasirani tim',
                exactOrder12: 'Tacan poredak 1-2',
                topTwoAny: 'Prva dva u grupi',
                leagueName: 'Grupa {g}',
            }
        };

        function t(key, vars = {}) {
            const str = (translations[currentLanguage] || translations.en)[key] || key;
            return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{${k}}`);
        }

        // --- DOM Elements ---
        const matchDataEl = document.getElementById('matchData'), numSimulationsEl = document.getElementById('numSimulations');
        const numSimulationsPresetEl = document.getElementById('numSimulationsPreset');
        const parseButtonEl = document.getElementById('parseButton'), runButtonEl = document.getElementById('runButton'), clearButtonEl = document.getElementById('clearButton');
        const statusAreaEl = document.getElementById('statusArea'), loaderEl = document.getElementById('loader'), resultsContentEl = document.getElementById('resultsContent');
        const csvFileInputEl = document.getElementById('csvFileInput'), csvFileNameEl = document.getElementById('csvFileName');
        const eloCsvFileInputEl = document.getElementById('eloCsvFileInput'), eloCsvFileNameEl = document.getElementById('eloCsvFileName');
        const eloDataEl = document.getElementById('eloData'), inputModeEl = document.getElementById('inputMode');
        const bracketCsvFileInputEl = document.getElementById('bracketCsvFileInput'), bracketCsvFileNameEl = document.getElementById('bracketCsvFileName');
        const bracketDataEl = document.getElementById('bracketData');
        const outrightsDataEl = document.getElementById('outrightsData'), oddsApiKeyEl = document.getElementById('oddsApiKey');
        const fetchAllOddsBtnEl = document.getElementById('fetchAllOddsBtn'), fetchAllOddsStatusEl = document.getElementById('fetchAllOddsStatus');
        const groupMappingDataEl = document.getElementById('groupMappingData');
        const groupMappingFileInputEl = document.getElementById('groupMappingFileInput'), groupMappingFileNameEl = document.getElementById('groupMappingFileName');
        const applyGroupMappingBtnEl = document.getElementById('applyGroupMappingBtn'), clearGroupMappingBtnEl = document.getElementById('clearGroupMappingBtn');
        const groupMappingStatusEl = document.getElementById('groupMappingStatus');
        const loadTeamsBtnEl = document.getElementById('loadTeamsBtn');
        const loadTeamsFromScheduleBtnEl = document.getElementById('loadTeamsFromScheduleBtn');
        const teamMappingTableContainerEl = document.getElementById('teamMappingTableContainer');
        const teamMappingTableBodyEl = document.getElementById('teamMappingTableBody');
        const teamMapperPlaceholderEl = document.getElementById('teamMapperPlaceholder');
        const saveTeamMappingBtnEl = document.getElementById('saveTeamMappingBtn');
        const resetTeamMappingBtnEl = document.getElementById('resetTeamMappingBtn');
        const teamMappingSaveStatusEl = document.getElementById('teamMappingSaveStatus');
        const simGroupSelectEl = document.getElementById('simGroupSelect'), simBookieMarginEl = document.getElementById('simBookieMargin');
        const showSimulatedOddsButtonEl = document.getElementById('showSimulatedOddsButton');
        const calculatedOddsResultContentEl = document.getElementById('calculatedOddsResultContent'), simulatedOddsStatusEl = document.getElementById('simulatedOddsStatus');
        const simTeamSelectEl = document.getElementById('simTeamSelect');
        const customProbInputsContainerEl = document.getElementById('customProbInputsContainer');
        const simCustomStatTypeEl = document.getElementById('simCustomStatType'), simCustomOperatorEl = document.getElementById('simCustomOperator');
        const simCustomValue1El = document.getElementById('simCustomValue1'), simCustomValue2El = document.getElementById('simCustomValue2');
        const calculateCustomProbAndOddButtonEl = document.getElementById('calculateCustomProbAndOddButton');
        const customProbAndOddResultAreaEl = document.getElementById('customProbAndOddResultArea');
        const generateTeamCsvButtonEl = document.getElementById('generateTeamCsvButton'); 
        const generateGroupCsvButtonEl = document.getElementById('generateGroupCsvButton');
        const tieBreakPresetEl = document.getElementById('tieBreakPreset');
        const tieBreakPresetHelpEl = document.getElementById('tieBreakPresetHelp');
        const advancementPresetEl = document.getElementById('advancementPreset');
        const advancementPresetHelpEl = document.getElementById('advancementPresetHelp');
        const tournamentTeamSelectEl = document.getElementById('tournamentTeamSelect');
        const tournamentBookieMarginEl = document.getElementById('tournamentBookieMargin');
        const showTournamentTeamOddsButtonEl = document.getElementById('showTournamentTeamOddsButton');
        const generateTournamentTeamCsvButtonEl = document.getElementById('generateTournamentTeamCsvButton');
        const generateTournamentTeamCsvErrorEl = document.getElementById('generateTournamentTeamCsvError');
        const tournamentTeamOddsStatusEl = document.getElementById('tournamentTeamOddsStatus');
        const tournamentTeamOddsResultContentEl = document.getElementById('tournamentTeamOddsResultContent');
        const lambdaViewContentEl = document.getElementById('lambdaViewContent');
        const scenarioLockSectionEl = document.getElementById('scenarioLockSection');
        const scenarioLockTableBodyEl = document.getElementById('scenarioLockTableBody');
        const clearLocksBtnEl = document.getElementById('clearLocksBtn');
        const exportRawDataSectionEl = document.getElementById('exportRawDataSection');
        const exportRawDataBtnEl = document.getElementById('exportRawDataBtn');
        const customOULinesEl = document.getElementById('customOULines');
        const showMultiGroupViewBtnEl = document.getElementById('showMultiGroupViewBtn');
        const multiGroupViewStatusEl = document.getElementById('multiGroupViewStatus');
        const multiGroupViewContentEl = document.getElementById('multiGroupViewContent');
        const multiGroupMarginEl = document.getElementById('multiGroupMargin');
        const langToggleBtnEl = document.getElementById('langToggleBtn');
        const matchDataSectionEl = document.getElementById('matchDataSection');
        const apiDataSectionEl = document.getElementById('apiDataSection');
        const eloSectionEl = document.getElementById('eloSection');
        const inputModeHintEl = document.getElementById('inputModeHint');
        const exportRawDataErrorEl = document.getElementById('exportRawDataError');
        const generateTeamCsvErrorEl = document.getElementById('generateTeamCsvError');
        const generateGroupCsvErrorEl = document.getElementById('generateGroupCsvError');
        const powerRatingsContentEl = document.getElementById('powerRatingsContent');

        function syncSimulationPresetFromInput() {
            const trimmedValue = numSimulationsEl.value.trim();
            if (!trimmedValue) {
                numSimulationsPresetEl.value = 'custom';
                return;
            }
            const presetOption = Array.from(numSimulationsPresetEl.options).find(option => option.value === trimmedValue);
            numSimulationsPresetEl.value = presetOption ? trimmedValue : 'custom';
        }

        numSimulationsPresetEl.addEventListener('change', () => {
            if (numSimulationsPresetEl.value !== 'custom') {
                numSimulationsEl.value = numSimulationsPresetEl.value;
            }
            numSimulationsEl.focus();
        });

        numSimulationsEl.addEventListener('input', syncSimulationPresetFromInput);
        syncSimulationPresetFromInput();

        // --- Odds API Logic ---
        if (oddsApiKeyEl) {
            oddsApiKeyEl.value = getOddsApiKey();
            oddsApiKeyEl.addEventListener('input', () => setOddsApiKey(oddsApiKeyEl.value));
        }

        // --- Group Mapping Admin Logic ---
        if (groupMappingDataEl) {
            // Load saved mapping from localStorage
            groupMappingDataEl.value = getGroupMappingData();
            groupMappingDataEl.addEventListener('input', () => {
                setGroupMappingData(groupMappingDataEl.value);
            });
        }

        if (groupMappingFileInputEl) {
            groupMappingFileInputEl.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                groupMappingFileNameEl.textContent = file.name;
                const text = await file.text();
                groupMappingDataEl.value = text;
                setGroupMappingData(text);
                groupMappingStatusEl.innerHTML = '<span class="text-green-500">File loaded. Click "Apply Mapping" to use it.</span>';
            });
        }

        if (applyGroupMappingBtnEl) {
            applyGroupMappingBtnEl.addEventListener('click', () => {
                const rawData = groupMappingDataEl.value.trim();
                if (!rawData) {
                    groupMappingStatusEl.innerHTML = '<span class="text-red-500">Please enter mapping data first.</span>';
                    return;
                }

                try {
                    // Try parsing as JSON first
                    if (rawData.startsWith('{') || rawData.startsWith('[')) {
                        manualGroupMapping = JSON.parse(rawData);
                        groupMappingStatusEl.innerHTML = '<span class="text-green-500 font-medium">✅ JSON mapping applied successfully!</span>';
                    } else {
                        // Parse as CSV: GROUP,TEAM
                        const lines = rawData.split('\n').map(l => l.trim()).filter(l => l);
                        manualGroupMapping = {};

                        for (const line of lines) {
                            const parts = line.split(',').map(p => p.trim());
                            if (parts.length < 2) continue;

                            const [group, team] = parts;
                            if (!manualGroupMapping[group]) {
                                manualGroupMapping[group] = [];
                            }
                            manualGroupMapping[group].push(team);
                        }

                        const groupCount = Object.keys(manualGroupMapping).length;
                        const teamCount = Object.values(manualGroupMapping).flat().length;
                        groupMappingStatusEl.innerHTML = `<span class="text-green-500 font-medium">✅ CSV mapping applied: ${groupCount} groups, ${teamCount} teams</span>`;
                    }

                    // Show summary
                    const summary = Object.entries(manualGroupMapping)
                        .map(([g, teams]) => `Group ${g}: ${teams.length} teams`)
                        .join(', ');
                    groupMappingStatusEl.innerHTML += `<br><span class="text-slate-600 text-xs">${summary}</span>`;

                } catch (e) {
                    groupMappingStatusEl.innerHTML = `<span class="text-red-500">Parse error: ${e.message}</span>`;
                    console.error('Group mapping parse error:', e);
                }
            });
        }

        if (clearGroupMappingBtnEl) {
            clearGroupMappingBtnEl.addEventListener('click', () => {
                manualGroupMapping = null;
                groupMappingDataEl.value = '';
                removeGroupMappingData();
                groupMappingFileNameEl.textContent = 'No file selected';
                if (groupMappingFileInputEl) groupMappingFileInputEl.value = '';
                groupMappingStatusEl.innerHTML = '<span class="text-slate-500">Manual mapping cleared. Will use auto-detection.</span>';
            });
        }

        // --- Interactive Team Mapper Logic ---
        // Initialize team mapper with modular code
        initializeTeamMapper({
            // DOM elements
            loadFromScheduleBtn: loadTeamsFromScheduleBtnEl,
            loadFromApiBtn: loadTeamsBtnEl,
            saveBtn: saveTeamMappingBtnEl,
            resetBtn: resetTeamMappingBtnEl,
            tableBody: teamMappingTableBodyEl,
            tableContainer: teamMappingTableContainerEl,
            placeholder: teamMapperPlaceholderEl,
            statusElement: teamMappingSaveStatusEl,
            groupMappingTextarea: groupMappingDataEl,
            matchDataTextarea: matchDataEl,

            // Callbacks and data providers
            getOfficialSchedule: () => officialScheduleData,
            loadOfficialSchedule: loadOfficialSchedule,
            getApiMatchData: () => lastFetchedApiData,
            getExistingMapping: () => manualGroupMapping,
            setManualMapping: (mapping) => { manualGroupMapping = mapping; },
            processOddsData: processOddsData,
            getTeamGroupMapping: getTeamGroupMapping
        });

        // --- Unified Odds Fetching Logic (Matches + Tournament) ---
        if (fetchAllOddsBtnEl) {
            fetchAllOddsBtnEl.addEventListener('click', async () => {
                const key = oddsApiKeyEl.value.trim();
                if (!key) {
                    fetchAllOddsStatusEl.innerHTML = '<span class="text-red-500">Please enter an API key first.</span>';
                    return;
                }

                fetchAllOddsBtnEl.disabled = true;
                const originalText = fetchAllOddsBtnEl.innerHTML;
                fetchAllOddsBtnEl.innerHTML = '<svg class="animate-spin inline mr-2" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/></svg>Fetching...';

                let statusParts = [];
                let totalRemaining = null;

                try {
                    // Step 0: Fetch Official Schedule (if not already loaded)
                    if (!officialScheduleData) {
                        fetchAllOddsStatusEl.innerHTML = '<span class="text-blue-500">📅 Loading official 2026 World Cup schedule...</span>';
                        await loadOfficialSchedule();
                        if (officialScheduleData) {
                            statusParts.push('<span class="text-green-500 font-medium">✅ Official schedule loaded (104 matches, 12 groups)</span>');
                        }
                    }

                    // Step 1: Fetch Match Odds
                    fetchAllOddsStatusEl.innerHTML = statusParts.join('<br>') + '<br><span class="text-blue-500">📊 Fetching match odds...</span>';

                    const matchResponse = await fetch(`https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${key}&regions=eu&markets=h2h,totals&oddsFormat=decimal`);
                    if (!matchResponse.ok) {
                        const errorText = await matchResponse.text();
                        throw new Error(`Match odds API error: ${matchResponse.status} - ${errorText}`);
                    }

                    totalRemaining = matchResponse.headers.get('x-requests-remaining');
                    const matchData = await matchResponse.json();
                    lastFetchedApiData = matchData; // Store for team mapper
                    const useSchedule = officialScheduleData !== null && !manualGroupMapping;
                    const matchResult = processOddsData(matchData, useSchedule);

                    if (matchResult.csvLines.length === 0) {
                        statusParts.push('<span class="text-amber-500">⚠️ Match odds: No matches found with complete data</span>');
                    } else {
                        matchDataEl.value = matchResult.csvLines.join('\n');
                        statusParts.push(`<span class="text-green-500 font-medium">✅ Match odds: ${matchResult.processedCount} matches fetched</span>`);
                        if (matchResult.skippedCount > 0) {
                            statusParts.push(`<span class="text-amber-500 text-xs ml-4">⚠️ Skipped ${matchResult.skippedCount} matches (incomplete data)</span>`);
                        }
                    }

                    // Step 2: Fetch Tournament Outrights
                    fetchAllOddsStatusEl.innerHTML = statusParts.join('<br>') + '<br><span class="text-blue-500">🏆 Fetching tournament outrights...</span>';

                    const outrightsResponse = await fetch(`https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds/?apiKey=${key}&regions=eu,uk&markets=outrights`);
                    if (!outrightsResponse.ok) {
                        throw new Error(`Outrights API error: ${outrightsResponse.status} ${outrightsResponse.statusText}`);
                    }

                    totalRemaining = outrightsResponse.headers.get('x-requests-remaining');
                    const outrightsData = await outrightsResponse.json();
                    outrightsDataEl.value = JSON.stringify(outrightsData, null, 2);
                    statusParts.push('<span class="text-green-500 font-medium">✅ Tournament outrights: Successfully fetched</span>');

                    // Final status
                    if (totalRemaining) {
                        statusParts.push(`<span class="text-blue-500 text-xs mt-2 inline-block">📊 API Quota: ${totalRemaining} requests remaining (used 2 requests)</span>`);
                    }
                    fetchAllOddsStatusEl.innerHTML = statusParts.join('<br>');

                } catch (e) {
                    const errorMsg = `<span class="text-red-500 font-medium">❌ Fetch failed: ${e.message}</span>`;
                    if (statusParts.length > 0) {
                        fetchAllOddsStatusEl.innerHTML = statusParts.join('<br>') + '<br>' + errorMsg;
                    } else {
                        fetchAllOddsStatusEl.innerHTML = errorMsg;
                    }
                    console.error('Odds fetch error:', e);
                } finally {
                    fetchAllOddsBtnEl.disabled = false;
                    fetchAllOddsBtnEl.innerHTML = originalText;
                }
            });
        }

        // --- Status Bar Helper ---
        // Wrapper function for modularized status renderer
        function renderStatus(type, message, options = {}) {
            renderStatusUI(statusAreaEl, type, message, options);
        }

        // --- Probability CSS Class Helper ---
        function probToClass(pctVal) {
            if (isNaN(pctVal)) return '';
            if (pctVal >= 50) return 'prob-high';
            if (pctVal >= 20) return 'prob-mid';
            return 'prob-low';
        }

        function renderLambdaView() {
            if (!lambdaViewContentEl) return;
            if (!parsedMatches.length) {
                lambdaViewContentEl.innerHTML = 'Parse data first to inspect team and match lambdas.';
                return;
            }

            // Calculate team statistics
            const teamStats = {};
            parsedMatches.forEach(match => {
                if (!teamStats[match.team1]) teamStats[match.team1] = { group: match.group, matches: 0, lambdaFor: 0, lambdaAgainst: 0, xPts: 0 };
                if (!teamStats[match.team2]) teamStats[match.team2] = { group: match.group, matches: 0, lambdaFor: 0, lambdaAgainst: 0, xPts: 0 };
                teamStats[match.team1].matches += 1;
                teamStats[match.team1].lambdaFor += match.lambda1;
                teamStats[match.team1].lambdaAgainst += match.lambda2;
                teamStats[match.team1].xPts += (3 * match.p1) + match.px;
                teamStats[match.team2].matches += 1;
                teamStats[match.team2].lambdaFor += match.lambda2;
                teamStats[match.team2].lambdaAgainst += match.lambda1;
                teamStats[match.team2].xPts += (3 * match.p2) + match.px;
            });

            // Convert to array and sort for team lambda table
            const sortedTeamStats = Object.entries(teamStats)
                .sort(([teamA, statsA], [teamB, statsB]) => statsA.group.localeCompare(statsB.group) || teamA.localeCompare(teamB))
                .map(([team, stats]) => ({ team, ...stats }));

            // Sort matches for match lambda table
            const sortedMatches = parsedMatches
                .slice()
                .sort((a, b) => a.group.localeCompare(b.group) || a.lineNum - b.lineNum);

            // Create HTML sections using utilities
            const teamSection = createSection('Team Group-Stage Lambda Sums', createTeamLambdaTable(sortedTeamStats));
            const matchSection = createSection('Match Lambdas', createMatchLambdaTable(sortedMatches));

            // Clear and append sections
            lambdaViewContentEl.innerHTML = '';
            lambdaViewContentEl.appendChild(teamSection);
            lambdaViewContentEl.appendChild(matchSection);
        }

        const tieBreakRulePresets = {
            uefa_competition: {
                label: "UEFA-style (H2H before overall GD)",
                description: "Pts → H2H Pts → H2H GD → H2H GF → GD → GF → Wins → Team name",
                criteriaAfterPoints: ['h2hPts', 'h2hGd', 'h2hGf', 'gd', 'gf', 'wins', 'name']
            },
            fifa_competition: {
                label: "FIFA World Cup (H2H then overall)",
                description: "Pts → H2H Pts → H2H GD → H2H GF → [recursive H2H] → GD → GF → Team name",
                criteriaAfterPoints: ['h2hPts', 'h2hGd', 'h2hGf', 'gd', 'gf', 'name'],
                recursiveH2H: true
            },
            domestic_standard: {
                label: "League standard (Pts/GD/GF)",
                description: "Pts → GD → GF → Wins → Team name",
                criteriaAfterPoints: ['gd', 'gf', 'wins', 'name']
            },
            head_to_head_first: {
                label: "Head-to-head first",
                description: "Pts → H2H Pts → H2H GD → H2H GF → GD → GF → Team name",
                criteriaAfterPoints: ['h2hPts', 'h2hGd', 'h2hGf', 'gd', 'gf', 'name']
            },
            goals_scored_priority: {
                label: "Goals-scored priority",
                description: "Pts → GF → GD → Wins → Team name",
                criteriaAfterPoints: ['gf', 'gd', 'wins', 'name']
            }
        };

        const advancementRulePresets = {
            top2_only: {
                label: "Top 2 only",
                description: "Top 2 teams per group qualify. No best-third ranking is used.",
                autoQualifiersPerGroup: 2,
                bestThirdSlots: 0
            },
            top2_plus_best4_thirds: {
                label: "Top 2 + best 4 third-placed",
                description: "Top 2 qualify directly, plus 4 best 3rd-placed teams across groups.",
                autoQualifiersPerGroup: 2,
                bestThirdSlots: 4
            },
            top2_plus_best8_thirds: {
                label: "Top 2 + best 8 third-placed",
                description: "Top 2 qualify directly, plus 8 best 3rd-placed teams across groups.",
                autoQualifiersPerGroup: 2,
                bestThirdSlots: 8
            }
        };

        function populateTieBreakPresets() {
            tieBreakPresetEl.innerHTML = '';
            Object.entries(tieBreakRulePresets).forEach(([key, preset]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = preset.label;
                tieBreakPresetEl.appendChild(option);
            });
            tieBreakPresetEl.value = 'uefa_competition';
            updateTieBreakPresetDescription();
        }

        function updateTieBreakPresetDescription() {
            const preset = tieBreakRulePresets[tieBreakPresetEl.value];
            tieBreakPresetHelpEl.textContent = preset ? preset.description : '';
        }
        tieBreakPresetEl.addEventListener('change', updateTieBreakPresetDescription);

        function populateAdvancementPresets() {
            advancementPresetEl.innerHTML = '';
            Object.entries(advancementRulePresets).forEach(([key, preset]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = preset.label;
                advancementPresetEl.appendChild(option);
            });
            advancementPresetEl.value = 'top2_plus_best8_thirds';
            updateAdvancementPresetDescription();
        }

        function updateAdvancementPresetDescription() {
            const preset = advancementRulePresets[advancementPresetEl.value];
            advancementPresetHelpEl.textContent = preset ? preset.description : '';
        }
        advancementPresetEl.addEventListener('change', updateAdvancementPresetDescription);

        function getSelectedAdvancementPreset() {
            return advancementRulePresets[advancementPresetEl.value] || advancementRulePresets.top2_plus_best8_thirds;
        }


        // --- CSV File Input ---
        csvFileInputEl.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                csvFileNameEl.textContent = file.name;
                const reader = new FileReader();
                reader.onload = (e) => { matchDataEl.value = e.target.result; renderStatus('info', 'CSV loaded. Click "Parse &amp; Validate Data".'); };
                reader.onerror = (e) => { renderStatus('error', `Error reading file: ${e.target.error.name}`); csvFileNameEl.textContent = "No file selected."; };
                reader.readAsText(file);
            } else { csvFileNameEl.textContent = "No file selected."; }
        });

        eloCsvFileInputEl.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                eloCsvFileNameEl.textContent = file.name;
                const reader = new FileReader();
                reader.onload = (e) => { eloDataEl.value = e.target.result; renderStatus('info', 'Elo CSV loaded. Click "Parse &amp; Validate Data".'); };
                reader.onerror = (e) => { renderStatus('error', `Error reading Elo file: ${e.target.error.name}`); eloCsvFileNameEl.textContent = "No file selected."; };
                reader.readAsText(file);
            } else { eloCsvFileNameEl.textContent = "No file selected."; }
        });

        bracketCsvFileInputEl.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                bracketCsvFileNameEl.textContent = file.name;
                const reader = new FileReader();
                reader.onload = (e) => { bracketDataEl.value = e.target.result; renderStatus('info', 'Bracket CSV loaded. Click "Parse &amp; Validate Data".'); };
                reader.onerror = (e) => { renderStatus('error', `Error reading bracket file: ${e.target.error.name}`); bracketCsvFileNameEl.textContent = "No file selected."; };
                reader.readAsText(file);
            } else { bracketCsvFileNameEl.textContent = "No file selected."; }
        });

        function updateInputModeUi() {
            const mode = inputModeEl.value;
            const isEloMode = mode === 'elo';
            const isHybridMode = mode === 'hybrid';
            const isOddsMode = mode === 'odds';
            const isApiMode = mode === 'api';

            // Show/hide sections based on mode
            if (matchDataSectionEl) matchDataSectionEl.classList.toggle('hidden', isEloMode || isApiMode);
            if (apiDataSectionEl) apiDataSectionEl.classList.toggle('hidden', !isApiMode);
            if (eloSectionEl) eloSectionEl.classList.toggle('hidden', isOddsMode || isApiMode);

            // Update hint text
            if (inputModeHintEl) {
                if (isApiMode) {
                    inputModeHintEl.textContent = 'API mode: Click "Fetch All Odds" button at the top to get live match odds automatically.';
                } else if (isEloMode) {
                    inputModeHintEl.textContent = 'Use Elo mode when you only have team ratings by group. Expected goals are generated from Elo differences.';
                } else if (isHybridMode) {
                    inputModeHintEl.textContent = 'Hybrid mode: Combine known match odds with Elo-generated fixtures for remaining rounds.';
                } else {
                    inputModeHintEl.textContent = 'Manual mode: Paste or import match odds data in CSV format.';
                }
            }

            // Keep disabled flags in sync for form submission safety
            matchDataEl.disabled = isEloMode || isApiMode;
            if (csvFileInputEl) csvFileInputEl.disabled = isEloMode || isApiMode;
            if (eloDataEl) eloDataEl.disabled = isOddsMode || isApiMode;
            if (eloCsvFileInputEl) eloCsvFileInputEl.disabled = isOddsMode || isApiMode;

            parseButtonEl.textContent = isEloMode
                ? 'Parse Elo & Build Fixtures'
                : (isHybridMode ? 'Parse Hybrid Data' : (isApiMode ? 'Parse API Data' : 'Parse & Validate Data'));
        }
        inputModeEl.addEventListener('change', updateInputModeUi);
        
        // --- xG Calculation & Helpers ---
        function poissonPMF(mu, k) {
            if (mu < 0 || k < 0 || !Number.isInteger(k)) return 0;
            if (mu === 0) return k === 0 ? 1 : 0;
            // Use log-space arithmetic to avoid factorial overflow for large k
            let logP = k * Math.log(mu) - mu;
            for (let i = 1; i <= k; i++) logP -= Math.log(i);
            return Math.exp(logP);
        }

        function poissonRandom(lambda) { 
            if (lambda <= 0) return 0;
            let L = Math.exp(-lambda);
            let k = 0;
            let p = 1;
            do {
                k++;
                p *= Math.random();
            } while (p > L);
            return k - 1;
        }
        
        function dixonColesToCorrection(i, j, lambda1, lambda2, rho) {
            if (rho === 0) return 1;
            if (i === 0 && j === 0) return 1 - lambda1 * lambda2 * rho;
            if (i === 1 && j === 0) return 1 + lambda2 * rho;
            if (i === 0 && j === 1) return 1 + lambda1 * rho;
            if (i === 1 && j === 1) return 1 - rho;
            return 1;
        }

        function buildDixonColesCDF(lambda1, lambda2, rho) {
            const MAX_G = 10;
            const n = MAX_G + 1;
            const pmf1 = new Float64Array(n);
            const pmf2 = new Float64Array(n);
            for (let k = 0; k < n; k++) {
                pmf1[k] = poissonPMF(lambda1, k);
                pmf2[k] = poissonPMF(lambda2, k);
            }
            const cdf = new Float64Array(n * n);
            let cumulative = 0;
            let idx = 0;
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    const tau = dixonColesToCorrection(i, j, lambda1, lambda2, rho);
                    cumulative += Math.max(0, pmf1[i] * pmf2[j] * tau);
                    cdf[idx++] = cumulative;
                }
            }
            return { cdf, total: cumulative, n };
        }

        function sampleDixonColes(dcCDF) {
            const { cdf, total, n } = dcCDF;
            const target = Math.random() * total;
            for (let k = 0; k < cdf.length; k++) {
                if (cdf[k] >= target) return [Math.floor(k / n), k % n];
            }
            return [n - 1, n - 1];
        }

        // --- Shin's Method for accurate vig removal (Favorite-Longshot Bias correction) ---
        function shinTrueProbs(impliedProbs) {
            // impliedProbs: array of raw implied probabilities (1/odds), summing > 1
            // Returns array of true probabilities summing to 1
            const n = impliedProbs.length;
            const totalImplied = impliedProbs.reduce((s, p) => s + p, 0);
            if (totalImplied <= 1.0001) {
                // No meaningful overround — normalise proportionally
                return impliedProbs.map(p => p / totalImplied);
            }

            // Bisect to find Shin's z parameter
            // For each outcome i: trueProb_i = (sqrt(z^2 + 4*(1-z)*imp_i^2 / totalImplied) - z) / (2*(1-z))
            // Sum of trueProbs must equal 1.
            let zLo = 0, zHi = 1;
            const maxIter = 200;
            const tol = 1e-12;
            let z = 0;

            for (let iter = 0; iter < maxIter; iter++) {
                z = (zLo + zHi) / 2;
                let sumTrue = 0;
                const oneMinusZ = 1 - z;
                if (oneMinusZ < 1e-15) { zHi = z; continue; }
                for (let i = 0; i < n; i++) {
                    const disc = z * z + 4 * oneMinusZ * (impliedProbs[i] * impliedProbs[i]) / totalImplied;
                    sumTrue += (Math.sqrt(disc) - z) / (2 * oneMinusZ);
                }
                if (Math.abs(sumTrue - 1) < tol) break;
                if (sumTrue > 1) zLo = z;
                else zHi = z;
            }

            const oneMinusZ = 1 - z;
            if (oneMinusZ < 1e-15) {
                // Degenerate: fall back to proportional
                return impliedProbs.map(p => p / totalImplied);
            }
            return impliedProbs.map(imp => {
                const disc = z * z + 4 * oneMinusZ * (imp * imp) / totalImplied;
                return (Math.sqrt(disc) - z) / (2 * oneMinusZ);
            });
        }

        // --- DC-aware model probability calculation with dynamic goal truncation ---
        function calculateModelProbsFromXG(homeXG, awayXG, goalLine = 2.5, rho = 0) {
            let probHomeWin = 0, probAwayWin = 0, probDraw = 0;
            let probUnder = 0, probOver = 0;

            // Dynamic truncation: cap at lambda + 6*sqrt(lambda), minimum 8
            const maxGoalsHome = Math.max(8, Math.ceil(homeXG + 6 * Math.sqrt(Math.max(homeXG, 0.5))));
            const maxGoalsAway = Math.max(8, Math.ceil(awayXG + 6 * Math.sqrt(Math.max(awayXG, 0.5))));

            for (let i = 0; i <= maxGoalsHome; i++) {
                const pmfI = poissonPMF(homeXG, i);
                if (pmfI < 1e-15 && i > 2) break; // early exit for negligible tail
                for (let j = 0; j <= maxGoalsAway; j++) { 
                    const pmfJ = poissonPMF(awayXG, j);
                    if (pmfJ < 1e-15 && j > 2) break;
                    const tau = dixonColesToCorrection(i, j, homeXG, awayXG, rho);
                    const probScore = Math.max(0, pmfI * pmfJ * tau);
                    if (probScore === 0) continue;

                    if (i > j) probHomeWin += probScore;
                    else if (j > i) probAwayWin += probScore;
                    else probDraw += probScore;

                    const totalMatchGoals = i + j;
                    if (totalMatchGoals < goalLine) probUnder += probScore;
                    else if (totalMatchGoals > goalLine) probOver += probScore;
                }
            }

            // Renormalise to account for DC correction shifting total mass
            const totalMass = probHomeWin + probDraw + probAwayWin;
            if (totalMass > 0 && Math.abs(totalMass - 1) > 1e-9) {
                probHomeWin /= totalMass;
                probDraw /= totalMass;
                probAwayWin /= totalMass;
                probUnder /= totalMass;
                probOver /= totalMass;
            }
            
            const modelProbHomeWinNoDraw = (probHomeWin + probAwayWin > 0) ? probHomeWin / (probHomeWin + probAwayWin) : 0.5; 
            const modelProbUnderNoExact = (probUnder + probOver > 0) ? probUnder / (probUnder + probOver) : 0.5; 
            
            return {
                modelProbHomeWinNoDraw: modelProbHomeWinNoDraw,
                modelProbUnderNoExact: modelProbUnderNoExact,
                probHomeWinFull: probHomeWin, probDrawFull: probDraw, probAwayWinFull: probAwayWin,
                probUnderFull: probUnder, probOverFull: probOver
            };
        }

        // --- Coordinate Descent solver: fits (totalGoals, supremacy, rho) simultaneously ---
        function calculateExpectedGoalsFromOdds(overPrice, underPrice, homePrice, drawPrice, awayPrice) {
            // --- Step 1: Shin's method for accurate true-probability extraction ---
            const impliedOU = [1 / overPrice, 1 / underPrice];
            const shinOU = shinTrueProbs(impliedOU);
            const targetUnder = shinOU[1]; // P(under 2.5)

            const implied1X2 = [1 / homePrice, 1 / drawPrice, 1 / awayPrice];
            const shin1X2 = shinTrueProbs(implied1X2);
            const targetP1 = shin1X2[0]; // P(home win)
            const targetPX = shin1X2[1]; // P(draw)
            const targetP2 = shin1X2[2]; // P(away win)
            const targetHomeNoDraw = (targetP1 + targetP2 > 0) ? targetP1 / (targetP1 + targetP2) : 0.5;

            const tol = 1e-7;
            const maxBisect = 80;
            const coordDescentPasses = 8; // number of alternating passes

            let totalGoals = 2.5;
            let supremacy = 0;
            let rho = 0;

            // --- Step 2: Coordinate Descent over (totalGoals, supremacy, rho) ---
            for (let pass = 0; pass < coordDescentPasses; pass++) {
                // --- Pass A: Bisect totalGoals to match P(under 2.5) ---
                let lo1 = 0.05, hi1 = 22.0;
                for (let iter = 0; iter < maxBisect; iter++) {
                    totalGoals = (lo1 + hi1) / 2;
                    const hXG = Math.max(0.01, totalGoals / 2 + supremacy / 2);
                    const aXG = Math.max(0.01, totalGoals / 2 - supremacy / 2);
                    const p = calculateModelProbsFromXG(hXG, aXG, 2.5, rho);
                    if (Math.abs(p.modelProbUnderNoExact - targetUnder) < tol) break;
                    if (p.modelProbUnderNoExact > targetUnder) lo1 = totalGoals;
                    else hi1 = totalGoals;
                }

                // --- Pass B: Bisect supremacy to match P(home wins | no draw) ---
                const maxSup = Math.max(totalGoals - 0.02, 0.1);
                let lo2 = -maxSup, hi2 = maxSup;
                for (let iter = 0; iter < maxBisect; iter++) {
                    supremacy = (lo2 + hi2) / 2;
                    const hXG = Math.max(0.01, totalGoals / 2 + supremacy / 2);
                    const aXG = Math.max(0.01, totalGoals / 2 - supremacy / 2);
                    const p = calculateModelProbsFromXG(hXG, aXG, 2.5, rho);
                    const err = p.modelProbHomeWinNoDraw - targetHomeNoDraw;
                    if (Math.abs(err) < tol) break;
                    if (err > 0) hi2 = supremacy;
                    else lo2 = supremacy;
                }

                // --- Pass C: Bisect rho to match P(draw) ---
                let loR = -0.45, hiR = 0.15;
                for (let iter = 0; iter < maxBisect; iter++) {
                    rho = (loR + hiR) / 2;
                    const hXG = Math.max(0.01, totalGoals / 2 + supremacy / 2);
                    const aXG = Math.max(0.01, totalGoals / 2 - supremacy / 2);
                    const p = calculateModelProbsFromXG(hXG, aXG, 2.5, rho);
                    const err = p.probDrawFull - targetPX;
                    if (Math.abs(err) < tol) break;
                    // Negative rho increases draw probability (boosts 0-0 and 1-1)
                    if (err < 0) hiR = rho; // model draw too low → need more negative rho
                    else loR = rho;          // model draw too high → need less negative rho
                }
            }

            const homeExpectedGoals = Math.max(0.01, totalGoals / 2 + supremacy / 2);
            const awayExpectedGoals = Math.max(0.01, totalGoals / 2 - supremacy / 2);

            // Clamp rho to safe DC bounds (tau must stay > 0 for all score cells)
            const maxSafeRho = 1 / (homeExpectedGoals * awayExpectedGoals + 1e-9);
            rho = Math.max(-0.4, Math.min(rho, maxSafeRho - 0.01));

            // Validate convergence
            const finalP = calculateModelProbsFromXG(homeExpectedGoals, awayExpectedGoals, 2.5, rho);
            const errUnder = Math.abs(finalP.modelProbUnderNoExact - targetUnder);
            const errHome = Math.abs(finalP.modelProbHomeWinNoDraw - targetHomeNoDraw);
            const errDraw = Math.abs(finalP.probDrawFull - targetPX);
            // Relax draw tolerance for extreme mismatches where draw probability is inherently low
            const drawTol = targetPX < 0.15 ? 0.025 : 0.012;
            const converged = errUnder < 0.002 && errHome < 0.002 && errDraw < drawTol;

            return {
                homeXG: homeExpectedGoals,
                awayXG: awayExpectedGoals,
                matchRho: rho,
                converged,
                shinProbs: { p1: targetP1, px: targetPX, p2: targetP2 }
            };
        }

        function parseDelimitedLine(line, delimiter) {
            const fields = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delimiter && !inQuotes) {
                    fields.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }

            fields.push(current.trim());
            return fields;
        }

        function getDelimitedParts(line) {
            if (line.includes('\t')) return parseDelimitedLine(line, '\t');
            if (line.includes(';')) return parseDelimitedLine(line, ';');
            if (line.includes(',')) return parseDelimitedLine(line, ',');
            return null;
        }

        function normalizePastedLineBreaks(raw) {
            return raw.replace(/\\r\\n|\\n|\\r/g, '\n');
        }

        function normalizeEscapedNewlines(raw) {
            return String(raw || '')
                .replace(/\\r\\n/g, '\n')
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\n');
        }

        function normalizeAliasKey(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\./g, '')
                .replace(/&/g, ' and ')
                .replace(/[^a-zA-Z0-9]+/g, ' ')
                .trim()
                .toLowerCase();
        }

        const TEAM_NAME_ALIASES = {
            'bosnia and herzegovina': 'Bosnia & Herzegovina',
            'curacao': 'Curaçao',
            'dr congo': 'DR Congo',
            'd r congo': 'DR Congo',
            'democratic republic congo': 'DR Congo'
        };

        function canonicalizeTeamName(teamName) {
            const cleaned = String(teamName || '').trim();
            return TEAM_NAME_ALIASES[normalizeAliasKey(cleaned)] || cleaned;
        }

        function isLikelyOddsHeader(parts) {
            const normalized = parts.map(p => String(p).trim().toUpperCase());
            return normalized.length >= 8
                && normalized[0] === 'GROUP'
                && normalized.includes('TEAM_A')
                && normalized.includes('TEAM_B')
                && normalized.includes('ODD1')
                && normalized.includes('ODDX')
                && normalized.includes('ODD2');
        }

        function getCsvExportDateTime() {
            const now = new Date();
            const date = `${now.getUTCDate()}.${now.getUTCMonth() + 1}.${now.getUTCFullYear()}`;
            const time = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
            return { date, time };
        }

        function csvEscape(value) {
            const stringValue = value === undefined || value === null ? '' : String(value);
            return `"${stringValue.replace(/"/g, '""')}"`;
        }

        function buildCsvRow(cells) {
            return cells.map(csvEscape).join(';') + '\n';
        }

        function average(values) {
            return values && values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
        }

        function getLineProbabilities(values, line) {
            if (!values || !values.length || currentNumSims === 0) {
                return { overProb: 0, underProb: 0 };
            }
            const overProb = values.filter(value => value > line).length / currentNumSims;
            const underProb = values.filter(value => value < line).length / currentNumSims;
            return { overProb, underProb };
        }

        function findBalancedHalfPointLine(values, fallbackMean = 0) {
            if (!values || !values.length) {
                return Math.max(0.5, Math.floor(fallbackMean) + 0.5);
            }
            const maxValue = Math.max(...values);
            const meanValue = average(values);
            let bestLine = 0.5;
            let bestGap = Number.POSITIVE_INFINITY;
            let bestMeanDistance = Number.POSITIVE_INFINITY;
            for (let base = 0; base <= Math.max(maxValue + 1, Math.ceil(meanValue) + 1); base++) {
                const line = base + 0.5;
                const { overProb, underProb } = getLineProbabilities(values, line);
                const gap = Math.abs(overProb - underProb);
                const meanDistance = Math.abs(line - fallbackMean);
                if (gap < bestGap - 1e-9 || (Math.abs(gap - bestGap) < 1e-9 && meanDistance < bestMeanDistance)) {
                    bestGap = gap;
                    bestMeanDistance = meanDistance;
                    bestLine = line;
                }
            }
            return bestLine;
        }

        function buildDynamicHalfPointLines(values, fallbackMean = 0) {
            const balanced = findBalancedHalfPointLine(values, fallbackMean);
            return [balanced, balanced + 1, Math.max(0.5, balanced - 1)];
        }

        // --- Scenario Locking ---
        function buildScenarioLockUI() {
            if (!parsedMatches || parsedMatches.length === 0) {
                scenarioLockSectionEl.classList.add('hidden');
                return;
            }
            scenarioLockSectionEl.classList.remove('hidden');
            scenarioLockTableBodyEl.innerHTML = '';
            parsedMatches.forEach((m, idx) => {
                const key = buildMatchPairKey(m.team1, m.team2);
                const currentLock = lockedScenarios[key] || null;
                const tr = document.createElement('tr');
                tr.className = idx % 2 === 0 ? 'bg-white' : 'bg-amber-50';
                tr.innerHTML = `
                    <td class="px-3 py-1.5 text-gray-600">Gr. ${m.group}</td>
                    <td class="px-3 py-1.5 font-medium">${m.team1} vs ${m.team2}</td>
                    <td class="px-3 py-1.5">
                        <div class="scenario-lock-score-row">
                            <input type="number" min="0" step="1" inputmode="numeric" data-match-key="${key}" data-team-side="team1" value="${currentLock ? currentLock.g1 : ''}" class="scenario-lock-score-input border border-amber-300 rounded px-2 py-1 text-xs bg-white" placeholder="${m.team1}">
                            <span class="text-amber-700 font-medium">:</span>
                            <input type="number" min="0" step="1" inputmode="numeric" data-match-key="${key}" data-team-side="team2" value="${currentLock ? currentLock.g2 : ''}" class="scenario-lock-score-input border border-amber-300 rounded px-2 py-1 text-xs bg-white" placeholder="${m.team2}">
                            <button type="button" data-match-key="${key}" class="scenario-lock-clear border border-amber-300 rounded px-2 py-1 text-xs bg-white text-amber-800">Simulate</button>
                        </div>
                    </td>`;
                scenarioLockTableBodyEl.appendChild(tr);
            });

            function syncLockedScore(key) {
                const inputs = scenarioLockTableBodyEl.querySelectorAll(`.scenario-lock-score-input[data-match-key="${key}"]`);
                const team1Input = Array.from(inputs).find(input => input.dataset.teamSide === 'team1');
                const team2Input = Array.from(inputs).find(input => input.dataset.teamSide === 'team2');
                if (!team1Input || !team2Input) return;

                const raw1 = team1Input.value.trim();
                const raw2 = team2Input.value.trim();

                if (raw1 === '' && raw2 === '') {
                    delete lockedScenarios[key];
                    return;
                }

                const g1 = Number(raw1);
                const g2 = Number(raw2);
                if (Number.isInteger(g1) && g1 >= 0 && Number.isInteger(g2) && g2 >= 0) {
                    lockedScenarios[key] = { g1, g2 };
                } else {
                    delete lockedScenarios[key];
                }
            }

            scenarioLockTableBodyEl.querySelectorAll('.scenario-lock-score-input').forEach(input => {
                input.addEventListener('input', () => {
                    const key = input.dataset.matchKey;
                    syncLockedScore(key);
                });
            });

            scenarioLockTableBodyEl.querySelectorAll('.scenario-lock-clear').forEach(button => {
                button.addEventListener('click', () => {
                    const key = button.dataset.matchKey;
                    const inputs = scenarioLockTableBodyEl.querySelectorAll(`.scenario-lock-score-input[data-match-key="${key}"]`);
                    inputs.forEach(input => { input.value = ''; });
                    delete lockedScenarios[key];
                });
            });
        }

        function simulateLockedMatch(m, lockedScore) {
            return {
                g1: lockedScore?.g1 ?? 0,
                g2: lockedScore?.g2 ?? 0
            };
        }

        function clearOverUnderDisplay() {
            document.getElementById('ouTotalGroupGoalsResult').innerHTML = '';
            document.getElementById('expectedTotalGroupGoals').textContent = '';
            document.getElementById('ouFirstPlacePtsResult').innerHTML = '';
            document.getElementById('expectedFirstPlacePts').textContent = '';
            document.getElementById('ouFourthPlacePtsResult').innerHTML = '';
            document.getElementById('expectedFourthPlacePts').textContent = '';
            document.getElementById('ouFirstPlaceGFResult').innerHTML = '';
            document.getElementById('expectedFirstPlaceGF').textContent = '';
            document.getElementById('ouFourthPlaceGFResult').innerHTML = '';
            document.getElementById('expectedFourthPlaceGF').textContent = '';
        }

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function eloProbNoDraw(eloA, eloB) {
            const diff = eloA - eloB;
            return 1 / (1 + Math.pow(10, -diff / 400));
        }

        function deriveMatchFromElo(group, team1Name, team2Name, elo1, elo2, lineNum) {
            const diffAbs = Math.abs(elo1 - elo2);
            const p1NoDraw = eloProbNoDraw(elo1, elo2);
            const pDraw = clamp(0.20 + 0.11 * Math.exp(-diffAbs / 250), 0.18, 0.31);
            const p1 = (1 - pDraw) * p1NoDraw;
            const p2 = (1 - pDraw) * (1 - p1NoDraw);

            const totalGoals = 2.35 + Math.min(0.45, diffAbs / 900);
            const strength1 = p1 + 0.5 * pDraw;
            const strength2 = p2 + 0.5 * pDraw;
            const lambda1 = Math.max(0.05, totalGoals * (strength1 / (strength1 + strength2)));
            const lambda2 = Math.max(0.05, totalGoals * (strength2 / (strength1 + strength2)));

            return { lineNum, group, team1: team1Name, team2: team2Name, p1, px: pDraw, p2, lambda1, lambda2, matchRho: 0 };
        }

        function buildMatchPairKey(team1, team2) {
            return [canonicalizeTeamName(team1), canonicalizeTeamName(team2)]
                .sort((a, b) => a.localeCompare(b))
                .join('||');
        }

        function captureCurrentParsedState() {
            return {
                parsedMatches: parsedMatches.map(m => ({ ...m })),
                groupedMatches: Object.fromEntries(Object.entries(groupedMatches).map(([group, matches]) => [group, matches.map(m => ({ ...m }))])),
                groupTeamNames: Object.fromEntries(Object.entries(groupTeamNames).map(([group, teams]) => [group, [...teams]])),
                allTeams: new Set([...allTeams])
            };
        }

        function parseOddsInputData() {
            const data = normalizePastedLineBreaks(matchDataEl.value.trim());
            if (!data) return { errors: ['Error: Match data empty.'] };
            const lines = data.split(/\r?\n/);
            parsedMatches = [];
            allTeams.clear();
            groupedMatches = {};
            groupTeamNames = {};
            let errors = [], warnings = [];

            lines.forEach((line, index) => {
                line = line.trim(); if (!line || line.startsWith('#')) return;
                const delimitedParts = getDelimitedParts(line);
                const isCsvLike = Array.isArray(delimitedParts);
                let parts = isCsvLike ? delimitedParts : line.split(/\s+/).map(p => p.trim());
                parts = parts.filter(p => p.length > 0);
                if (index === 0 && isCsvLike && isLikelyOddsHeader(parts)) return;
                let group, team1Name, team2Name, oddsStrings;
                if (isCsvLike) {
                    const vsIdx = parts.indexOf('vs');
                    if (vsIdx !== -1) {
                        if (vsIdx > 0 && vsIdx < parts.length - 5) { group = parts[0]; team1Name = parts.slice(1, vsIdx).join(" "); team2Name = parts.slice(vsIdx + 1, parts.length - 5).join(" "); oddsStrings = parts.slice(parts.length - 5); if (!team1Name || !team2Name) { errors.push(`L${index+1}(CSV 'vs'): Empty T names. L:"${line}"`); return; }}
                        else { errors.push(`L${index+1}(CSV 'vs'): 'vs' wrong pos/few odds. L:"${line}"`); return; }
                    } else {
                        if (parts.length >= 8) { group = parts[0]; team1Name = parts[1]; team2Name = parts[2]; oddsStrings = parts.slice(3, 8); if (!team1Name || !team2Name) { errors.push(`L${index+1}(CSV no 'vs'): Empty T names. L:"${line}"`); return; }}
                        else { errors.push(`L${index+1}(CSV no 'vs'): <8 cols. Exp G,T1,T2,O1,OX,O2,OU_U,OU_O. Got ${parts.length}. L:"${line}"`); return; }
                    }
                } else {
                    const vsIdx = parts.indexOf('vs');
                    if (vsIdx > 0 && vsIdx < parts.length - 5) { group = parts[0]; team1Name = parts.slice(1, vsIdx).join(" "); team2Name = parts.slice(vsIdx + 1, parts.length - 5).join(" "); oddsStrings = parts.slice(parts.length - 5); if (!team1Name || !team2Name) { errors.push(`L${index+1}(Space): Empty T names. L:"${line}"`); return; }}
                    else { errors.push(`L${index+1}(Space): 'vs' issue/few odds. Exp G T1 vs T2 O1 OX O2 OU_U OU_O. L:"${line}"`); return; }
                }
                if (!oddsStrings || oddsStrings.length !== 5) { errors.push(`L${index+1}: Odds extract fail. Odds:${oddsStrings}. L:"${line}"`); return; }
                const odds = oddsStrings.map(parseFloat);
                if (odds.some(isNaN)) { errors.push(`L${index+1}: Invalid odds. Odds:"${oddsStrings.join(', ')}". L:"${line}"`); return; }
                if (odds.some(o => o <= 1)) { errors.push(`L${index+1}: Odds must be >1.0. Odds:"${oddsStrings.join(', ')}". L:"${line}"`); return; }

                const [o1, ox, o2, oUnder25, oOver25] = odds;

                const xGResult = calculateExpectedGoalsFromOdds(oOver25, oUnder25, o1, ox, o2);
                let lambda1 = xGResult.homeXG;
                let lambda2 = xGResult.awayXG;
                let matchRho = xGResult.matchRho || 0;
                // Use Shin-corrected true probabilities instead of naive proportional normalization
                let p1_market = xGResult.shinProbs ? xGResult.shinProbs.p1 : 0;
                let px_market = xGResult.shinProbs ? xGResult.shinProbs.px : 0;
                let p2_market = xGResult.shinProbs ? xGResult.shinProbs.p2 : 0;

                if (!xGResult.converged) {
                   warnings.push(`L${index+1}: xG solver did not converge for ${team1Name} v ${team2Name} (residual error too large). Results may be less accurate.`);
                }
                if (isNaN(lambda1) || isNaN(lambda2) || lambda1 <=0 || lambda2 <=0) {
                   warnings.push(`L${index+1}: xG calc produced invalid values for ${team1Name} v ${team2Name}. Using fallback. H=${lambda1?.toFixed(2)},A=${lambda2?.toFixed(2)}`);
                   // Fallback using Shin probabilities
                   const lt_fb_simple_approx = 2.5;
                   const s1_fb = p1_market + 0.5 * px_market;
                   const s2_fb = p2_market + 0.5 * px_market;
                   if(s1_fb + s2_fb > 0){
                       lambda1 = lt_fb_simple_approx * s1_fb / (s1_fb + s2_fb);
                       lambda2 = lt_fb_simple_approx * s2_fb / (s1_fb + s2_fb);
                   } else {
                       lambda1 = lt_fb_simple_approx / 2; lambda2 = lt_fb_simple_approx / 2;
                   }
                   lambda1 = Math.max(0.05, lambda1); lambda2 = Math.max(0.05, lambda2);
                   matchRho = 0; // reset rho on fallback
                }

                team1Name = canonicalizeTeamName(team1Name);
                team2Name = canonicalizeTeamName(team2Name);

                const match = { lineNum:index+1, group, team1:team1Name, team2:team2Name, p1: p1_market, px: px_market, p2: p2_market, lambda1, lambda2, matchRho };
                parsedMatches.push(match); allTeams.add(team1Name); allTeams.add(team2Name);
                if (!groupedMatches[group]) { groupedMatches[group]=[]; groupTeamNames[group]=new Set(); }
                groupedMatches[group].push(match); groupTeamNames[group].add(team1Name); groupTeamNames[group].add(team2Name);
            });

            for (const group in groupTeamNames) {
                if (groupTeamNames[group].size !== 4) warnings.push(`Gr ${group}: ${groupTeamNames[group].size} teams (exp 4).`);
                if (groupedMatches[group] && groupedMatches[group].length !== 6 && groupTeamNames[group].size === 4) warnings.push(`Gr ${group}: ${groupedMatches[group].length} matches (exp 6).`);
                groupTeamNames[group] = Array.from(groupTeamNames[group]);
            }

            return { errors, warnings };
        }

        function parseEloInputData() {
            const data = normalizeEscapedNewlines(eloDataEl.value).trim();
            if (!data) return { errors: ['Error: Elo data empty.'] };
            const lines = data.split('\n');
            parsedMatches = [];
            allTeams.clear();
            groupedMatches = {};
            groupTeamNames = {};
            const teamRatingsByGroup = {};
            let errors = [], warnings = [];

            lines.forEach((rawLine, index) => {
                const line = rawLine.trim();
                if (!line || line.startsWith('#')) return;
                const parts = getDelimitedParts(line) || line.split(/\s+/).map(p => p.trim());
                if (parts.length < 3) {
                    errors.push(`L${index+1}: Expected GROUP,TEAM,ELO. Got "${rawLine}"`);
                    return;
                }
                const group = (parts[0] || '').trim();
                const team = canonicalizeTeamName((parts[1] || '').trim());
                const elo = parseFloat(parts[2]);

                const maybeHeader = group.toLowerCase() === 'group' && team.toLowerCase() === 'team' && Number.isNaN(elo);
                if (maybeHeader) return;

                if (!group || !team || Number.isNaN(elo)) {
                    errors.push(`L${index+1}: Invalid GROUP/TEAM/ELO. Got "${rawLine}"`);
                    return;
                }
                if (!teamRatingsByGroup[group]) teamRatingsByGroup[group] = {};
                if (teamRatingsByGroup[group][team] !== undefined) {
                    warnings.push(`L${index+1}: Duplicate team ${team} in group ${group}. Last Elo value used.`);
                }
                teamRatingsByGroup[group][team] = elo;
            });

            Object.entries(teamRatingsByGroup).forEach(([group, teamMap]) => {
                const teams = Object.keys(teamMap);
                if (teams.length !== 4) warnings.push(`Gr ${group}: ${teams.length} teams (exp 4).`);
                groupTeamNames[group] = [...teams];
                groupedMatches[group] = [];
                teams.forEach(t => allTeams.add(t));

                for (let i = 0; i < teams.length; i++) {
                    for (let j = i + 1; j < teams.length; j++) {
                        const team1 = teams[i];
                        const team2 = teams[j];
                        const match = deriveMatchFromElo(group, team1, team2, teamMap[team1], teamMap[team2], parsedMatches.length + 1);
                        parsedMatches.push(match);
                        groupedMatches[group].push(match);
                    }
                }
                if (teams.length === 4 && groupedMatches[group].length !== 6) warnings.push(`Gr ${group}: ${groupedMatches[group].length} generated matches (exp 6).`);
            });

            return { errors, warnings };
        }

        function parseTeamEloRatingsData() {
            const data = normalizeEscapedNewlines(eloDataEl.value).trim();
            const errors = [];
            const warnings = [];
            const eloMap = {};
            if (!data) return { errors: ['Error: Elo data empty.'], warnings, eloMap };

            const lines = data.split('\n');
            lines.forEach((rawLine, index) => {
                const line = rawLine.trim();
                if (!line || line.startsWith('#')) return;
                const parts = getDelimitedParts(line) || line.split(/\s+/).map(p => p.trim());
                if (parts.length < 3) {
                    errors.push(`L${index+1}: Expected GROUP,TEAM,ELO. Got "${rawLine}"`);
                    return;
                }
                const group = (parts[0] || '').trim();
                const team = canonicalizeTeamName((parts[1] || '').trim());
                const elo = parseFloat(parts[2]);
                const maybeHeader = group.toLowerCase() === 'group' && team.toLowerCase() === 'team' && Number.isNaN(elo);
                if (maybeHeader) return;
                if (!team || Number.isNaN(elo)) {
                    errors.push(`L${index+1}: Invalid TEAM/ELO. Got "${rawLine}"`);
                    return;
                }
                if (eloMap[team] !== undefined) warnings.push(`L${index+1}: Duplicate Elo for ${team}. Last value used.`);
                eloMap[team] = elo;
            });

            return { errors, warnings, eloMap };
        }

        function deriveTeamRatingsFromLambdas() {
            teamMarketRatings = {};
            if (parsedMatches.length === 0) return;

            let totalGoals = 0;
            let totalMatches = 0;
            parsedMatches.forEach(m => {
                totalGoals += m.lambda1 + m.lambda2;
                totalMatches++;
            });
            const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches) / 2 : 1.3;

            allTeams.forEach(team => {
                teamMarketRatings[team] = { attack: 1.0, defense: 1.0, games: 0, sumGF: 0, sumGA: 0, opponents: [] };
            });

            parsedMatches.forEach(m => {
                teamMarketRatings[m.team1].games++;
                teamMarketRatings[m.team1].sumGF += m.lambda1;
                teamMarketRatings[m.team1].sumGA += m.lambda2;
                teamMarketRatings[m.team1].opponents.push(m.team2);

                teamMarketRatings[m.team2].games++;
                teamMarketRatings[m.team2].sumGF += m.lambda2;
                teamMarketRatings[m.team2].sumGA += m.lambda1;
                teamMarketRatings[m.team2].opponents.push(m.team1);
            });

            for (let iter = 0; iter < 15; iter++) {
                let nextRatings = JSON.parse(JSON.stringify(teamMarketRatings));
                
                allTeams.forEach(team => {
                    const data = teamMarketRatings[team];
                    if (data.games === 0) return;
                    
                    let expGF_denom = 0, expGA_denom = 0;
                    data.opponents.forEach(opp => {
                        expGF_denom += avgGoals * teamMarketRatings[opp].defense;
                        expGA_denom += avgGoals * teamMarketRatings[opp].attack;
                    });

                    nextRatings[team].attack = expGF_denom > 0 ? (data.sumGF / expGF_denom) : 1.0;
                    nextRatings[team].defense = expGA_denom > 0 ? (data.sumGA / expGA_denom) : 1.0;
                });

                let sumAtt = 0, sumDef = 0;
                allTeams.forEach(team => { sumAtt += nextRatings[team].attack; sumDef += nextRatings[team].defense; });
                const n = allTeams.size || 1;
                
                allTeams.forEach(team => {
                    nextRatings[team].attack /= (sumAtt / n);
                    nextRatings[team].defense /= (sumDef / n);
                });
                teamMarketRatings = nextRatings;
            }
            teamMarketRatings._avgGoals = avgGoals;
        }

        function parseOutrightsData() {
            targetOutrightProbs = {};
            const raw = outrightsDataEl?.value?.trim();
            if (!raw) return { errors: [], warnings: [] };

            let errors = [];
            let warnings = [];

            try {
                // Try JSON parsing first (Odds API format)
                if (raw.startsWith('[') || raw.startsWith('{')) {
                    const data = JSON.parse(raw);
                    const events = Array.isArray(data) ? data : [data];
                    
                    events.forEach(event => {
                        event.bookmakers?.forEach(bookie => {
                            bookie.markets?.forEach(market => {
                                if (market.key === 'outrights') {
                                    market.outcomes.forEach(outcome => {
                                        const team = canonicalizeTeamName(outcome.name);
                                        if (!targetOutrightProbs[team]) targetOutrightProbs[team] = [];
                                        targetOutrightProbs[team].push(1 / outcome.price);
                                    });
                                }
                            });
                        });
                    });

                    // Average and normalize probabilities
                    let sumProb = 0;
                    Object.keys(targetOutrightProbs).forEach(team => {
                        const probs = targetOutrightProbs[team];
                        const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length;
                        targetOutrightProbs[team] = avgProb;
                        sumProb += avgProb;
                    });
                    
                    if (sumProb > 0) {
                        Object.keys(targetOutrightProbs).forEach(team => {
                            targetOutrightProbs[team] /= sumProb;
                        });
                    }
                } else {
                    // CSV format: Team, Odds
                    const lines = raw.split(/\r?\n/);
                    let sumProb = 0;
                    lines.forEach((line, index) => {
                        const parts = line.split(',').map(p => p.trim());
                        if (parts.length >= 2) {
                            const team = canonicalizeTeamName(parts[0]);
                            const odds = parseFloat(parts[1]);
                            if (!isNaN(odds) && odds > 1) {
                                targetOutrightProbs[team] = 1 / odds;
                                sumProb += 1 / odds;
                            }
                        }
                    });
                    if (sumProb > 0) {
                        Object.keys(targetOutrightProbs).forEach(team => {
                            targetOutrightProbs[team] /= sumProb;
                        });
                    }
                }
            } catch (e) {
                errors.push(`Error parsing outrights: ${e.message}`);
            }

            return { errors, warnings };
        }

        function calibrateRatingsToOutrights() {
            if (Object.keys(targetOutrightProbs).length === 0) return;
            
            // P(win) is roughly proportional to Strength^k. For a 32-team tournament, k ~ 4.
            const k = 4.0; 
            
            let currentImpliedProbs = {};
            let sumCurrentProbs = 0;
            
            allTeams.forEach(team => {
                if (teamMarketRatings[team]) {
                    const str = teamMarketRatings[team].attack / teamMarketRatings[team].defense;
                    const p = Math.pow(str, k);
                    currentImpliedProbs[team] = p;
                    sumCurrentProbs += p;
                }
            });
            
            if (sumCurrentProbs > 0) {
                allTeams.forEach(team => {
                    currentImpliedProbs[team] /= sumCurrentProbs;
                    
                    const targetP = targetOutrightProbs[team] || 0.001;
                    const currentP = currentImpliedProbs[team] || 0.001;
                    
                    // adjust strength so that newP ≈ targetP.
                    const adjustmentRatio = Math.pow(targetP / currentP, 1/k);
                    
                    // Dampen the adjustment to not entirely override group stage calibration
                    const dampen = 0.8;
                    const finalMultiplier = 1.0 + (adjustmentRatio - 1.0) * dampen;
                    const safeMultiplier = Math.max(0.6, Math.min(1.6, finalMultiplier));
                    
                    if (teamMarketRatings[team]) {
                        teamMarketRatings[team].attack *= Math.sqrt(safeMultiplier);
                        teamMarketRatings[team].defense /= Math.sqrt(safeMultiplier);
                    }
                });
            }
        }

        function displayPowerRatingsInNewTab() {
            if (!teamMarketRatings || Object.keys(teamMarketRatings).length === 0) return;

            const ratings = [];
            allTeams.forEach(team => {
                if (teamMarketRatings[team] && teamMarketRatings[team].games > 0) {
                    const attack = teamMarketRatings[team].attack;
                    const defense = teamMarketRatings[team].defense;
                    const power = attack / defense;
                    ratings.push({ team, attack, defense, power });
                }
            });

            if (ratings.length === 0) return;

            ratings.sort((a, b) => b.power - a.power);

            const tableHtml = `
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; background: white;">
                        <thead>
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #1e293b;">Rank</th>
                                <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #1e293b;">Team</th>
                                <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #1e293b;">Power Rating</th>
                                <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #1e293b;">Attack Rating</th>
                                <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #1e293b;">Defense Rating</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ratings.map((r, i) => `
                            <tr style="border-bottom: 1px solid #e2e8f0; ${i % 2 === 0 ? 'background: #f8fafc;' : ''}">
                                <td style="padding: 12px 15px; color: #334155;">${i + 1}</td>
                                <td style="padding: 12px 15px; color: #334155; font-weight: 500;">${r.team}</td>
                                <td style="padding: 12px 15px; color: #334155;">${r.power.toFixed(4)}</td>
                                <td style="padding: 12px 15px; color: #334155;">${r.attack.toFixed(4)}</td>
                                <td style="padding: 12px 15px; color: #334155;">${r.defense.toFixed(4)}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            if (powerRatingsContentEl) {
                powerRatingsContentEl.innerHTML = tableHtml;
            }
        }

        function getKnockoutLambdas(teamA, teamB) {
            let lambdaA = 1.3;
            let lambdaB = 1.3;
            let eloA = teamEloRatings[teamA] ?? 1500;
            let eloB = teamEloRatings[teamB] ?? 1500;

            if (teamMarketRatings[teamA]?.games > 0 && teamMarketRatings[teamB]?.games > 0) {
                const avgG = teamMarketRatings._avgGoals;
                // Neutral venue calculation using Poisson model:
                lambdaA = Math.max(0.05, avgG * teamMarketRatings[teamA].attack * teamMarketRatings[teamB].defense);
                lambdaB = Math.max(0.05, avgG * teamMarketRatings[teamB].attack * teamMarketRatings[teamA].defense);
            } else {
                // Fallback to Elo logic exactly as before
                const eloDiff = eloA - eloB;
                const diffAbs = Math.abs(eloA - eloB);
                const pANoDraw = eloProbNoDraw(eloA, eloB);
                const pDraw = clamp(0.22 + 0.10 * Math.exp(-diffAbs / 260), 0.18, 0.33);
                const expectedStrengthA = pANoDraw + 0.5 * pDraw;

                const priorTotalGoals = 2.35;
                const priorShareA = 0.5;
                const priorWeight = 8;
                const evidenceTotalGoals = 2.20 + Math.min(0.45, diffAbs / 700);
                const shareTilt = (expectedStrengthA - 0.5) * 1.15;
                const evidenceShareA = clamp(0.5 + shareTilt, 0.20, 0.80);
                const evidenceWeight = 2 + Math.min(6, diffAbs / 60);

                const posteriorTotalGoals = ((priorTotalGoals * priorWeight) + (evidenceTotalGoals * evidenceWeight)) / (priorWeight + evidenceWeight);
                const posteriorShareA = ((priorShareA * priorWeight) + (evidenceShareA * evidenceWeight)) / (priorWeight + evidenceWeight);
                const deltaAdjustment = clamp(eloDiff / 1200, -0.22, 0.22);
                
                lambdaA = Math.max(0.05, (posteriorTotalGoals * posteriorShareA) + deltaAdjustment);
                lambdaB = Math.max(0.05, posteriorTotalGoals - lambdaA);
            }

            return { lambdaA, lambdaB, eloA, eloB };
        }

        function simulateKnockoutMatch(teamA, teamB) {
            const { lambdaA, lambdaB, eloA, eloB } = getKnockoutLambdas(teamA, teamB);
            
            // Dynamic knockout rho: tighter matches (low lambda difference) get more negative rho
            const supremacy = Math.abs(lambdaA - lambdaB);
            let matchRho = Math.max(-0.25, Math.min(0, -0.15 + (supremacy * 0.08)));
            const effectiveRho = Math.max(-0.4, Math.min(matchRho + currentDCRho, 0.15));

            let gA90, gB90;
            [gA90, gB90] = sampleDixonColes(buildDixonColesCDF(lambdaA, lambdaB, effectiveRho));
            
            if (gA90 !== gB90) {
                return { winner: gA90 > gB90 ? teamA : teamB, loser: gA90 > gB90 ? teamB : teamA, goalsA: gA90, goalsB: gB90 };
            }

            // Fatigue-Adjusted Extra Time Model (~30 mins, but scaled down 20% due to fatigue/caution)
            const etFatigueFactor = 0.8;
            const etLambdaA = (lambdaA / 3) * etFatigueFactor;
            const etLambdaB = (lambdaB / 3) * etFatigueFactor;
            
            // Dynamic Extra Time rho (more caution -> even more negative rho)
            const etRho = Math.max(-0.3, effectiveRho - 0.05);
            let gAET, gBET;
            [gAET, gBET] = sampleDixonColes(buildDixonColesCDF(etLambdaA, etLambdaB, etRho));

            const finalGoalsA = gA90 + gAET;
            const finalGoalsB = gB90 + gBET;
            if (gAET !== gBET) {
                return { winner: gAET > gBET ? teamA : teamB, loser: gAET > gBET ? teamB : teamA, goalsA: finalGoalsA, goalsB: finalGoalsB };
            }

            // Penalty Shootout based on team strengths
            // Calculate win probability from market rating or Elo
            let pAWinsPens = 0.5;
            if (teamMarketRatings[teamA]?.games > 0 && teamMarketRatings[teamB]?.games > 0) {
                // Use overall rating (attack/defense) difference. Small edge for better team.
                const ratingA = teamMarketRatings[teamA].attack / teamMarketRatings[teamA].defense;
                const ratingB = teamMarketRatings[teamB].attack / teamMarketRatings[teamB].defense;
                const diff = (ratingA - ratingB); // Usually between -1.5 and 1.5
                pAWinsPens = Math.max(0.35, Math.min(0.65, 0.5 + (diff * 0.05)));
            } else {
                pAWinsPens = Math.max(0.35, Math.min(0.65, 0.5 + ((eloA - eloB) / 2000)));
            }
            
            const aWinsPens = Math.random() < pAWinsPens;
            return { winner: aWinsPens ? teamA : teamB, loser: aWinsPens ? teamB : teamA, goalsA: finalGoalsA, goalsB: finalGoalsB };
        }

        function parseHybridInputData() {
            const oddsResult = parseOddsInputData();
            const oddsState = captureCurrentParsedState();
            const eloResult = parseEloInputData();
            const eloState = captureCurrentParsedState();

            const errors = [
                ...oddsResult.errors.map(e => `[Odds] ${e}`),
                ...eloResult.errors.map(e => `[Elo] ${e}`)
            ];
            const warnings = [
                ...oddsResult.warnings.map(w => `[Odds] ${w}`),
                ...eloResult.warnings.map(w => `[Elo] ${w}`)
            ];

            if (errors.length > 0) {
                parsedMatches = [];
                allTeams = new Set();
                groupedMatches = {};
                groupTeamNames = {};
                return { errors, warnings };
            }

            parsedMatches = [];
            allTeams = new Set();
            groupedMatches = {};
            groupTeamNames = {};

            const groupKeys = new Set([...Object.keys(oddsState.groupedMatches), ...Object.keys(eloState.groupedMatches)]);
            [...groupKeys].forEach(group => {
                const oddsMatches = oddsState.groupedMatches[group] || [];
                const eloMatches = eloState.groupedMatches[group] || [];
                const teams = eloState.groupTeamNames[group] || oddsState.groupTeamNames[group] || [];
                const matchByPair = {};
                groupedMatches[group] = [];
                groupTeamNames[group] = [...teams];
                teams.forEach(t => allTeams.add(t));

                oddsMatches.forEach(m => {
                    const key = buildMatchPairKey(m.team1, m.team2);
                    if (matchByPair[key]) {
                        warnings.push(`[Hybrid] Duplicate odds pair in group ${group}: ${m.team1} vs ${m.team2}. Keeping first.`);
                        return;
                    }
                    matchByPair[key] = true;
                    groupedMatches[group].push({ ...m, lineNum: parsedMatches.length + 1 });
                    parsedMatches.push(groupedMatches[group][groupedMatches[group].length - 1]);
                    allTeams.add(m.team1); allTeams.add(m.team2);
                });

                eloMatches.forEach(m => {
                    const key = buildMatchPairKey(m.team1, m.team2);
                    if (matchByPair[key]) return;
                    matchByPair[key] = true;
                    groupedMatches[group].push({ ...m, lineNum: parsedMatches.length + 1 });
                    parsedMatches.push(groupedMatches[group][groupedMatches[group].length - 1]);
                    allTeams.add(m.team1); allTeams.add(m.team2);
                });

                if ((groupTeamNames[group] || []).length === 4 && groupedMatches[group].length !== 6) {
                    warnings.push(`[Hybrid] Gr ${group}: ${groupedMatches[group].length} matches after fill (exp 6).`);
                }
            });

            return { errors, warnings };
        }

        function isLikelyBracketHeader(parts) {
            const normalized = parts.map(p => String(p).trim().toUpperCase());
            return normalized.length >= 4
                && normalized[0] === 'ROUND'
                && (normalized[1] === 'MATCH' || normalized[1] === 'MATCH_ID' || normalized[1] === 'MATCHID');
        }

        function parseBracketInputData() {
            const data = normalizePastedLineBreaks(bracketDataEl.value.trim());
            parsedBracketMatches = [];
            if (!data) return { errors: [], warnings: [] };

            const lines = data.split(/\r?\n/);
            const errors = [];
            const warnings = [];
            const allowedRounds = new Set(['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL']);
            const seenMatchIds = new Set();

            lines.forEach((rawLine, index) => {
                const line = rawLine.trim();
                if (!line || line.startsWith('#')) return;

                const parts = (getDelimitedParts(line) || line.split(/\s+/).map(p => p.trim())).filter(Boolean);
                if (index === 0 && isLikelyBracketHeader(parts)) return;

                let round, matchIdRaw, sideA, sideB;
                const vsIdx = parts.indexOf('vs');
                if (vsIdx !== -1) {
                    if (parts.length < 5 || vsIdx < 2 || vsIdx >= parts.length - 1) {
                        errors.push(`Bracket L${index + 1}: Invalid 'vs' placement. Got "${rawLine}"`);
                        return;
                    }
                    round = parts[0];
                    matchIdRaw = parts[1];
                    sideA = parts.slice(2, vsIdx).join(' ');
                    sideB = parts.slice(vsIdx + 1).join(' ');
                } else {
                    if (parts.length < 4) {
                        errors.push(`Bracket L${index + 1}: Expected ROUND,MATCH,SIDE_A,SIDE_B (or with 'vs').`);
                        return;
                    }
                    round = parts[0];
                    matchIdRaw = parts[1];
                    sideA = parts[2];
                    sideB = parts.slice(3).join(' ');
                }

                if (!allowedRounds.has(String(round).toUpperCase())) warnings.push(`Bracket L${index + 1}: Unknown round "${round}".`);
                if (!sideA || !sideB) {
                    errors.push(`Bracket L${index + 1}: Empty side reference.`);
                    return;
                }

                const matchNum = parseInt(String(matchIdRaw).replace(/[^\d]/g, ''), 10);
                if (Number.isNaN(matchNum)) {
                    errors.push(`Bracket L${index + 1}: Could not parse match number from "${matchIdRaw}".`);
                    return;
                }
                if (seenMatchIds.has(matchNum)) {
                    warnings.push(`Bracket L${index + 1}: Duplicate match number ${matchNum}; skipping this entry.`);
                    return;
                }
                seenMatchIds.add(matchNum);

                parsedBracketMatches.push({
                    lineNum: index + 1,
                    round: String(round).toUpperCase(),
                    matchNum,
                    sideARef: sideA,
                    sideBRef: sideB
                });
            });

            return { errors, warnings };
        }


        // --- Parsing Logic (Simulator) ---
        parseButtonEl.addEventListener('click', () => {
            const mode = inputModeEl.value;
            const coreParsed = mode === 'elo'
                ? parseEloInputData()
                : (mode === 'hybrid' ? parseHybridInputData() : parseOddsInputData());
            // Note: 'api' mode uses the same parseOddsInputData() since data is already in matchData textarea
            const bracketParsed = parseBracketInputData();
            const shouldParseEloForKnockout = parsedBracketMatches.length > 0 || mode === 'elo' || mode === 'hybrid';
            const eloParsed = shouldParseEloForKnockout ? parseTeamEloRatingsData() : { errors: [], warnings: [], eloMap: {} };
            teamEloRatings = shouldParseEloForKnockout && eloParsed.errors.length === 0 ? eloParsed.eloMap : {};
            const errors = [...coreParsed.errors, ...bracketParsed.errors, ...eloParsed.errors.map(e => `[Elo] ${e}`)];
            const warnings = [...coreParsed.warnings, ...bracketParsed.warnings, ...eloParsed.warnings.map(w => `[Elo] ${w}`)];
            if (errors.length > 0) {
                renderStatus('error', `Parse failed (${errors.length} error${errors.length > 1 ? 's' : ''})`, { items: errors, warnings });
                runButtonEl.disabled = true;
                renderLambdaView();
            } else {
                const outrightsParsed = parseOutrightsData();
                if (outrightsParsed.errors.length > 0) {
                    renderStatus('error', `Parse failed with outrights errors`, { items: outrightsParsed.errors, warnings });
                    runButtonEl.disabled = true;
                    return;
                }
                if (outrightsParsed.warnings.length > 0) {
                    warnings.push(...outrightsParsed.warnings);
                }

                deriveTeamRatingsFromLambdas(); // Process the group odds to get team attack/defense ratings
                calibrateRatingsToOutrights(); // Tweak ratings if outrights exist
                displayPowerRatingsInNewTab(); // Display calculated power ratings in a new tab

                const modeLabel = mode === 'elo' ? 'Elo-generated fixtures' : (mode === 'hybrid' ? 'hybrid (odds + Elo fill)' : 'odds input');
                renderStatus('success', `Parsed ${parsedMatches.length} matches, ${Object.keys(groupedMatches).length} groups, ${allTeams.size} teams (${modeLabel}).`, {
                    detail: `Bracket rows: ${parsedBracketMatches.length}. Elo ratings: ${Object.keys(teamEloRatings).length} teams.`,
                    warnings
                });
                runButtonEl.disabled = false;
                resultsContentEl.innerHTML = "Parsed. Ready for sim.";
                buildScenarioLockUI();
                renderLambdaView();
            }
        });


        // --- Simulation Logic ---
        runButtonEl.addEventListener('click', () => {
            if (parsedMatches.length === 0) { renderStatus('error', 'No parsed data. Click "Parse &amp; Validate Data" first.'); return; }
            currentNumSims = parseInt(numSimulationsEl.value); if (isNaN(currentNumSims) || currentNumSims <= 0) { renderStatus('error', 'Number of simulations must be greater than 0.'); return; }
            loaderEl.classList.remove('hidden'); renderStatus('info', `Running ${currentNumSims.toLocaleString()} simulations...`);
            resultsContentEl.innerHTML = ""; runButtonEl.disabled = true; parseButtonEl.disabled = true;
            
            setTimeout(() => {
                try {
                    simulationAggStats = runSimulation(currentNumSims);
                    try {
                        displayResults(simulationAggStats, currentNumSims);
                    } catch (displayError) {
                        console.error("DisplayResults Error:", displayError);
                        statusAreaEl.innerHTML += `<div class="status-bar status-error" style="margin-top:0.375rem"><span class="status-icon">${_STATUS_ICONS.error}</span><div class="status-body"><p>Error displaying results: ${displayError.message}</p></div></div>`;
                    }
                    populateSimGroupSelect();
                    populateTournamentTeamSelect();
                    exportRawDataSectionEl.classList.remove('hidden');
                    multiGroupViewContentEl.innerHTML = 'Run simulation first, then click "Show Multi-Group Overview".';
                    renderStatus('success', `Simulation complete! (${currentNumSims.toLocaleString()} runs)`);
                } catch (simError) {
                    console.error("Sim Error:", simError);
                    renderStatus('error', `Error during simulation: ${simError.message}`);
                    simulationAggStats = {}; 
                    populateSimGroupSelect(); 
                    populateTournamentTeamSelect();
                } finally {
                    loaderEl.classList.add('hidden');
                    runButtonEl.disabled = false;
                    parseButtonEl.disabled = false;
                }
            }, 50);
        });

        function runSimulation(numSims) {
            const aggStats={};

            // Dixon-Coles correction setup
            // The global checkbox adds an ADDITIONAL rho on top of per-match rho from the solver.
            const dcEnabledEl = document.getElementById('dixonColesEnabled');
            const dcRhoEl = document.getElementById('dixonColesRho');
            const globalDCRhoOverride = (dcEnabledEl && dcEnabledEl.checked) ? (parseFloat(dcRhoEl.value) || 0) : 0;
            currentDCRho = globalDCRhoOverride; // keep for knockout matches

            // Precompute CDF table per unique (lambda1, lambda2, effectiveRho) triplet
            const dcCDFCache = new Map();
            for (const gK in groupedMatches) {
                for (const m of groupedMatches[gK]) {
                    // Per-match rho from solver + any global override
                    const effectiveRho = Math.max(-0.4, Math.min((m.matchRho || 0) + globalDCRhoOverride, 0.15));
                    const key = `${m.lambda1}:${m.lambda2}:${effectiveRho}`;
                    if (!dcCDFCache.has(key)) {
                        dcCDFCache.set(key, buildDixonColesCDF(m.lambda1, m.lambda2, effectiveRho));
                    }
                    // Store effective rho on match for quick lookup during simulation
                    m._effectiveRho = effectiveRho;
                    m._dcCacheKey = key;
                }
            }

            const advancementPreset = getSelectedAdvancementPreset();
            const autoQualifiersPerGroup = Math.max(0, advancementPreset.autoQualifiersPerGroup || 0);
            const bestThirdSlots = Math.max(0, advancementPreset.bestThirdSlots || 0);
            for(const gr in groupedMatches){ 
                aggStats[gr]={
                    groupTotalGoalsSims:[], straightForecasts:{}, advancingDoubles:{}, 
                    groupTotalDrawsSims: [],
                    anyTeam9PtsCount:0, anyTeam0PtsCount:0, 
                    thirdPlaceAdvancesCount: 0,
                    firstPlacePtsSims:[], firstPlaceGFSims:[], 
                    fourthPlacePtsSims:[], fourthPlaceGFSims:[]
                }; 
                (groupTeamNames[gr]||[]).forEach(tN=>{
                    aggStats[gr][tN]={
                        posCounts:[0,0,0,0], ptsSims:[], gfSims:[], gaSims:[], winsSims: [],
                        drawsSims: [],
                        positionSims: [],
                        mostGFCount:0, mostGACount:0,
                        autoQualifyCount: 0, bestThirdQualifyCount: 0, advanceToKnockoutCount: 0,
                        scoreEveryGroupGameCount: 0,
                        noLossGroupCount: 0,
                        concedeEveryGroupGameCount: 0
                    };
                });
            }
            initializeKnockoutStats(aggStats, groupTeamNames);
            for(let i=0; i<numSims; i++){ 
                const simTournamentTotals = {};
                Object.keys(aggStats._knockout.teamProgress).forEach(team => {
                    simTournamentTotals[team] = { gf: 0, ga: 0, games: 0 };
                });
                const thirdPlacedTeams = [];
                const groupStandings = {};
                for(const gK in groupedMatches){ 
                    const cGMs=groupedMatches[gK];
                    const tIG=[...(groupTeamNames[gK]||[])]; 
                    if(tIG.length===0) continue; 
                    
                    const sTS={}; 
                    tIG.forEach(t=>sTS[t]={name:t,pts:0,gf:0,ga:0,gd:0, wins: 0, draws: 0, scoredEveryGame: true, concededEveryGame: true, noLoss: true, groupGames: 0}); 
                    let cGTG=0, cGDraws=0;
                    const simulatedGroupMatches = [];
            
                    cGMs.forEach(m=>{
                        const lockKey = buildMatchPairKey(m.team1, m.team2);
                        const lockOutcome = lockedScenarios[lockKey];
                        let g1, g2;
                        if (lockOutcome) {
                            const locked = simulateLockedMatch(m, lockOutcome);
                            g1 = locked.g1; g2 = locked.g2;
                        } else {
                            // Always use DC CDF sampling (per-match rho baked in during precomputation)
                            [g1, g2] = sampleDixonColes(dcCDFCache.get(m._dcCacheKey));
                        }
                        simulatedGroupMatches.push({ team1: m.team1, team2: m.team2, g1, g2 });
                        if(sTS[m.team1]){sTS[m.team1].gf+=g1;sTS[m.team1].ga+=g2;sTS[m.team1].groupGames+=1;if(g1===0)sTS[m.team1].scoredEveryGame=false;if(g2===0)sTS[m.team1].concededEveryGame=false;} 
                        if(sTS[m.team2]){sTS[m.team2].gf+=g2;sTS[m.team2].ga+=g1;sTS[m.team2].groupGames+=1;if(g2===0)sTS[m.team2].scoredEveryGame=false;if(g1===0)sTS[m.team2].concededEveryGame=false;} 
                        cGTG+=(g1+g2); 
                        if(g1>g2){if(sTS[m.team1]){sTS[m.team1].pts+=3; sTS[m.team1].wins+=1;} if(sTS[m.team2]) sTS[m.team2].noLoss=false;}
                        else if(g2>g1){if(sTS[m.team2]){sTS[m.team2].pts+=3; sTS[m.team2].wins+=1;} if(sTS[m.team1]) sTS[m.team1].noLoss=false;}
                        else{
                            cGDraws+=1;
                            if(sTS[m.team1]){sTS[m.team1].pts+=1; sTS[m.team1].draws+=1;}
                            if(sTS[m.team2]){sTS[m.team2].pts+=1; sTS[m.team2].draws+=1;}
                        }
                        if (simTournamentTotals[m.team1]) {
                            simTournamentTotals[m.team1].gf += g1;
                            simTournamentTotals[m.team1].ga += g2;
                            simTournamentTotals[m.team1].games += 1;
                        }
                        if (simTournamentTotals[m.team2]) {
                            simTournamentTotals[m.team2].gf += g2;
                            simTournamentTotals[m.team2].ga += g1;
                            simTournamentTotals[m.team2].games += 1;
                        }
                    });
            
                    if(aggStats[gK]) {
                        aggStats[gK].groupTotalGoalsSims.push(cGTG);
                        aggStats[gK].groupTotalDrawsSims.push(cGDraws);
                    }
                    const rTs = sortStandingsWithTieBreakers(
                        tIG.map(tN=>{const s=sTS[tN]||{name:tN,pts:0,gf:0,ga:0,gd:0, wins:0};s.gd=s.gf-s.ga;return s;}),
                        simulatedGroupMatches,
                        tieBreakRulePresets[tieBreakPresetEl.value] || tieBreakRulePresets.uefa_competition
                    );
                    groupStandings[gK] = rTs;
            
                    let mGF=-1,mGA=-1; 
                    let groupHad9Pts=false, groupHad0Pts=false; 
                    rTs.forEach(t=>{
                        mGF=Math.max(mGF,t.gf);
                        mGA=Math.max(mGA,t.ga); 
                        if(t.pts===9)groupHad9Pts=true; 
                        if(t.pts===0)groupHad0Pts=true;
                    }); 
                    if(groupHad9Pts&&aggStats[gK])aggStats[gK].anyTeam9PtsCount++; 
                    if(groupHad0Pts&&aggStats[gK])aggStats[gK].anyTeam0PtsCount++;
            
                    if(rTs.length>0&&aggStats[gK]){
                        aggStats[gK].firstPlacePtsSims.push(rTs[0].pts); 
                        aggStats[gK].firstPlaceGFSims.push(rTs[0].gf);
                    } 
                    if(rTs.length>=4&&aggStats[gK]){ 
                        aggStats[gK].fourthPlacePtsSims.push(rTs[3].pts); 
                        aggStats[gK].fourthPlaceGFSims.push(rTs[3].gf);
                    }
            
                    rTs.forEach((t,rI)=>{
                        const tA=aggStats[gK]?.[t.name];
                        if(tA){
                            if(rI<4)tA.posCounts[rI]++;
                            tA.ptsSims.push(t.pts);
                            tA.winsSims.push(t.wins || 0);
                            tA.drawsSims.push(t.draws || 0);
                            tA.gfSims.push(t.gf);
                            tA.gaSims.push(t.ga);
                            tA.positionSims.push(rI + 1);
                            if(t.gf===mGF&&mGF>0)tA.mostGFCount++;
                            if(t.ga===mGA&&mGA>0)tA.mostGACount++;
                            if (rI < autoQualifiersPerGroup) tA.autoQualifyCount++;
                            if (rI < autoQualifiersPerGroup) tA.advanceToKnockoutCount++;
                            if (t.scoredEveryGame && t.groupGames > 0) tA.scoreEveryGroupGameCount++;
                            if (t.noLoss && t.groupGames > 0) tA.noLossGroupCount++;
                            if (t.concededEveryGame && t.groupGames > 0) tA.concedeEveryGroupGameCount++;
                        }
                    });

                    if (rTs.length >= 3) {
                        thirdPlacedTeams.push({ group: gK, ...rTs[2] });
                    }
            
                    if(rTs.length>=2&&aggStats[gK]){
                        const sFK=`${rTs[0].name}(1st)-${rTs[1].name}(2nd)`;
                        aggStats[gK].straightForecasts[sFK]=(aggStats[gK].straightForecasts[sFK]||0)+1; 
                        const aDP=[rTs[0].name,rTs[1].name].sort();
                        const aDK=`${aDP[0]}&${aDP[1]}`;
                        aggStats[gK].advancingDoubles[aDK]=(aggStats[gK].advancingDoubles[aDK]||0)+1;
                    }
                }

                if (thirdPlacedTeams.length > 0) {
                    const sortedThirds = thirdPlacedTeams
                        .sort((a, b) => {
                            if (a.pts !== b.pts) return b.pts - a.pts;
                            if (a.gd !== b.gd) return b.gd - a.gd;
                            if (a.gf !== b.gf) return b.gf - a.gf;
                            if ((a.wins || 0) !== (b.wins || 0)) return (b.wins || 0) - (a.wins || 0);
                            if (a.group !== b.group) return a.group.localeCompare(b.group);
                            return a.name.localeCompare(b.name);
                        })
                    sortedThirds.slice(0, bestThirdSlots).forEach(team => {
                        const tA = aggStats[team.group]?.[team.name];
                        if (!tA) return;
                        tA.bestThirdQualifyCount++;
                        tA.advanceToKnockoutCount++;
                        if (aggStats[team.group]) aggStats[team.group].thirdPlaceAdvancesCount++;
                    });
                    if (parsedBracketMatches.length > 0) {
                        runKnockoutStage({
                            parsedBracketMatches,
                            aggStats,
                            groupStandings,
                            thirdRankedList: sortedThirds.slice(0, bestThirdSlots),
                            simTournamentTotals,
                            simulateKnockoutMatch,
                            incrementRoundReach,
                            recordMatchupInPath
                        });
                    }
                }
                Object.entries(aggStats._knockout.teamProgress).forEach(([team, stats]) => {
                    const simTotals = simTournamentTotals[team] || { gf: 0, ga: 0, games: 0 };
                    stats.tournamentGfSims.push(simTotals.gf);
                    stats.tournamentGaSims.push(simTotals.ga);
                    stats.tournamentGamesSims.push(simTotals.games);
                });
                const tournamentTeams = Object.entries(simTournamentTotals);
                const maxTournamentGF = tournamentTeams.reduce((max, [, totals]) => Math.max(max, totals.gf), 0);
                const maxTournamentGA = tournamentTeams.reduce((max, [, totals]) => Math.max(max, totals.ga), 0);
                tournamentTeams.forEach(([team, totals]) => {
                    const kpStats = aggStats._knockout?.teamProgress?.[team];
                    if (!kpStats) return;
                    if (totals.gf === maxTournamentGF && maxTournamentGF > 0) kpStats.mostTournamentGFCount++;
                    if (totals.ga === maxTournamentGA && maxTournamentGA > 0) kpStats.mostTournamentGACount++;
                });
            }
            return aggStats;
        }

        function computeHeadToHeadStatsForTeams(teamNames, simulatedMatches) {
            const teamSet = new Set(teamNames);
            const h2hStats = {};
            teamNames.forEach(name => {
                h2hStats[name] = { h2hPts: 0, h2hGf: 0, h2hGa: 0, h2hGd: 0, h2hWins: 0 };
            });

            simulatedMatches.forEach(({ team1, team2, g1, g2 }) => {
                if (!teamSet.has(team1) || !teamSet.has(team2)) return;

                h2hStats[team1].h2hGf += g1;
                h2hStats[team1].h2hGa += g2;
                h2hStats[team2].h2hGf += g2;
                h2hStats[team2].h2hGa += g1;

                if (g1 > g2) {
                    h2hStats[team1].h2hPts += 3;
                    h2hStats[team1].h2hWins += 1;
                } else if (g2 > g1) {
                    h2hStats[team2].h2hPts += 3;
                    h2hStats[team2].h2hWins += 1;
                } else {
                    h2hStats[team1].h2hPts += 1;
                    h2hStats[team2].h2hPts += 1;
                }
            });

            teamNames.forEach(name => {
                h2hStats[name].h2hGd = h2hStats[name].h2hGf - h2hStats[name].h2hGa;
            });
            return h2hStats;
        }

        function compareTeamsByCriteria(teamA, teamB, criteria, h2hStats) {
            for (const criterion of criteria) {
                if (criterion === 'name') {
                    const byName = teamA.name.localeCompare(teamB.name);
                    if (byName !== 0) return byName;
                    continue;
                }

                const sourceA = criterion.startsWith('h2h') ? (h2hStats?.[teamA.name] || {}) : teamA;
                const sourceB = criterion.startsWith('h2h') ? (h2hStats?.[teamB.name] || {}) : teamB;
                const aVal = sourceA[criterion] || 0;
                const bVal = sourceB[criterion] || 0;
                if (aVal !== bVal) return bVal - aVal;
            }
            return teamA.name.localeCompare(teamB.name);
        }

        function teamsEqualOnCriteria(teamA, teamB, criteria, h2hStats) {
            for (const criterion of criteria) {
                if (criterion === 'name') continue;
                const sourceA = criterion.startsWith('h2h') ? (h2hStats?.[teamA.name] || {}) : teamA;
                const sourceB = criterion.startsWith('h2h') ? (h2hStats?.[teamB.name] || {}) : teamB;
                if ((sourceA[criterion] || 0) !== (sourceB[criterion] || 0)) return false;
            }
            return true;
        }

        function groupIntoBuckets(sortedTeams, criteria, h2hStats) {
            const buckets = [];
            let i = 0;
            while (i < sortedTeams.length) {
                const bucket = [sortedTeams[i]];
                let j = i + 1;
                while (j < sortedTeams.length && teamsEqualOnCriteria(sortedTeams[i], sortedTeams[j], criteria, h2hStats)) {
                    bucket.push(sortedTeams[j]);
                    j++;
                }
                buckets.push(bucket);
                i = j;
            }
            return buckets;
        }

        function sortStandingsWithTieBreakers(teams, simulatedMatches, selectedPreset) {
            const preset = selectedPreset || tieBreakRulePresets.uefa_competition;
            const criteriaAfterPoints = preset.criteriaAfterPoints || ['gd', 'gf', 'wins', 'name'];
            const sortedByPoints = [...teams].sort((a, b) => {
                if (a.pts !== b.pts) return b.pts - a.pts;
                return a.name.localeCompare(b.name);
            });

            const ranked = [];
            let idx = 0;
            while (idx < sortedByPoints.length) {
                const tiedSegment = [sortedByPoints[idx]];
                let nextIdx = idx + 1;
                while (nextIdx < sortedByPoints.length && sortedByPoints[nextIdx].pts === sortedByPoints[idx].pts) {
                    tiedSegment.push(sortedByPoints[nextIdx]);
                    nextIdx++;
                }

                if (tiedSegment.length > 1) {
                    const teamNames = tiedSegment.map(t => t.name);

                    if (preset.recursiveH2H) {
                        const h2hCriteria = criteriaAfterPoints.filter(c => c.startsWith('h2h'));
                        const overallCriteria = criteriaAfterPoints.filter(c => !c.startsWith('h2h'));
                        const h2hStats = computeHeadToHeadStatsForTeams(teamNames, simulatedMatches);

                        tiedSegment.sort((a, b) => compareTeamsByCriteria(a, b, [...h2hCriteria, 'name'], h2hStats));
                        const phase1Buckets = groupIntoBuckets(tiedSegment, h2hCriteria, h2hStats);

                        for (const bucket of phase1Buckets) {
                            if (bucket.length === 1) {
                                ranked.push(bucket[0]);
                            } else if (bucket.length < tiedSegment.length) {
                                // Recursive: re-apply H2H among just this still-tied sub-group
                                const subH2hStats = computeHeadToHeadStatsForTeams(bucket.map(t => t.name), simulatedMatches);
                                bucket.sort((a, b) => compareTeamsByCriteria(a, b, [...h2hCriteria, 'name'], subH2hStats));
                                const phase2Buckets = groupIntoBuckets(bucket, h2hCriteria, subH2hStats);
                                for (const subBucket of phase2Buckets) {
                                    if (subBucket.length === 1) {
                                        ranked.push(subBucket[0]);
                                    } else {
                                        ranked.push(...[...subBucket].sort((a, b) => compareTeamsByCriteria(a, b, overallCriteria, {})));
                                    }
                                }
                            } else {
                                // All tied teams equal on H2H — skip recursive step, use overall criteria
                                ranked.push(...[...bucket].sort((a, b) => compareTeamsByCriteria(a, b, overallCriteria, {})));
                            }
                        }
                    } else {
                        const h2hStats = computeHeadToHeadStatsForTeams(teamNames, simulatedMatches);
                        tiedSegment.sort((a, b) => compareTeamsByCriteria(a, b, criteriaAfterPoints, h2hStats));
                        ranked.push(...tiedSegment);
                    }
                } else {
                    ranked.push(...tiedSegment);
                }
                idx = nextIdx;
            }
            return ranked;
        }

        // --- Display Logic (Simulator) ---
        function displayResults(aggStats, numSims) {
            let html = ''; const sortedGroupKeys = Object.keys(aggStats).sort();
            for (const groupKey of sortedGroupKeys) {
                if (groupKey === '_knockout') continue;
                const groupData = aggStats[groupKey]; if (!groupData) continue;
                html += `<div class="mb-8 p-4 bg-white border border-gray-200 rounded-lg shadow"><h3 class="text-lg font-semibold text-indigo-600 mb-3">Group ${groupKey}</h3>`;
                html += `<h4 class="font-medium text-gray-700 mt-4 mb-1">Expected Team Stats:</h4><table class="min-w-full divide-y divide-gray-200 mb-3 text-xs sm:text-sm"><thead class="bg-gray-50"><tr>${['Team','E(Pts)','E(Wins)','E(GF)','E(GA)','P(Most GF)','P(Most GA)'].map(h=>`<th class="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">${h}</th>`).join('')}</tr></thead><tbody class="bg-white divide-y divide-gray-200">`;
                (groupTeamNames[groupKey]||[]).forEach(teamName=>{const ts=groupData[teamName];if(!ts||!ts.ptsSims)return; const avgPts=(ts.ptsSims.length>0&&numSims>0)?ts.ptsSims.reduce((a,b)=>a+b,0)/numSims:0; const avgWins=(ts.winsSims&&ts.winsSims.length>0&&numSims>0)?ts.winsSims.reduce((a,b)=>a+b,0)/numSims:0; const avgGF=(ts.gfSims.length>0&&numSims>0)?ts.gfSims.reduce((a,b)=>a+b,0)/numSims:0; const avgGA=(ts.gaSims.length>0&&numSims>0)?ts.gaSims.reduce((a,b)=>a+b,0)/numSims:0; const pMostGF=numSims>0?ts.mostGFCount/numSims*100:0; const pMostGA=numSims>0?ts.mostGACount/numSims*100:0; html+=`<tr><td class="px-2 py-2 whitespace-nowrap font-medium">${teamName}</td><td class="px-2 py-2">${avgPts.toFixed(2)}</td><td class="px-2 py-2">${avgWins.toFixed(2)}</td><td class="px-2 py-2">${avgGF.toFixed(2)}</td><td class="px-2 py-2">${avgGA.toFixed(2)}</td><td class="px-2 py-2 ${probToClass(pMostGF)}">${pMostGF.toFixed(1)}%</td><td class="px-2 py-2 ${probToClass(pMostGA)}">${pMostGA.toFixed(1)}%</td></tr>`;});
                html += `</tbody></table>`;
                const avgGroupGoals = (groupData.groupTotalGoalsSims&&groupData.groupTotalGoalsSims.length>0&&numSims>0)?groupData.groupTotalGoalsSims.reduce((a,b)=>a+b,0)/numSims:0;
                html += `<p class="mt-2 text-sm"><strong>Expected Total Goals in Group ${groupKey}:</strong> ${avgGroupGoals.toFixed(2)}</p>`;

                // Chart canvas for points distribution
                html += `<h4 class="font-medium text-gray-700 mt-4 mb-1">Points Distribution (all simulations):</h4>`;
                html += `<div class="chart-container mb-4" style="position:relative;height:180px;"><canvas id="chartPts_${groupKey}"></canvas></div>`;

                const allSF=Object.entries(groupData.straightForecasts||{}).sort(([,a],[,b])=>b-a); html+=`<h4 class="font-medium text-gray-700 mt-4 mb-1">All Straight Forecasts (1st-2nd):</h4><ul class="list-disc list-inside text-sm max-h-40 overflow-y-auto">${allSF.map(([k,c])=>`<li>${k}: ${(numSims>0?c/numSims*100:0).toFixed(1)}%</li>`).join('')||'N/A'}</ul>`;
                const topAD=Object.entries(groupData.advancingDoubles||{}).sort(([,a],[,b])=>b-a).slice(0,10); html+=`<h4 class="font-medium text-gray-700 mt-4 mb-1">Top Advancing Doubles (Top 2 Any Order):</h4><ul class="list-disc list-inside text-sm">${topAD.map(([k,c])=>`<li>${k}: ${(numSims>0?c/numSims*100:0).toFixed(1)}%</li>`).join('')||'N/A'}</ul>`;
                html += `</div>`;
            }
            const knockoutTeams = Object.entries(aggStats?._knockout?.teamProgress || {});
            if (knockoutTeams.length > 0 && parsedBracketMatches.length > 0) {
                html += `<div class="mb-8 p-4 bg-white border border-gray-200 rounded-lg shadow"><h3 class="text-lg font-semibold text-rose-600 mb-3">Knockout Progression (Elo-driven)</h3>`;
                html += `<table class="min-w-full divide-y divide-gray-200 mb-3 text-xs sm:text-sm"><thead class="bg-gray-50"><tr><th class="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">Team</th><th class="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">R16</th><th class="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">QF</th><th class="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">SF</th><th class="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">Final</th><th class="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">Champion</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">`;
                knockoutTeams
                    .sort(([a], [b]) => a.localeCompare(b))
                    .forEach(([team, stats]) => {
                        const pR16=(stats.reachR16/numSims*100),pQF=(stats.reachQF/numSims*100),pSF=(stats.reachSF/numSims*100),pFin=(stats.reachFINAL/numSims*100),pChamp=(stats.winFINAL/numSims*100);
                        html += `<tr><td class="px-2 py-2 whitespace-nowrap font-medium">${team}</td><td class="px-2 py-2 ${probToClass(pR16)}">${pR16.toFixed(1)}%</td><td class="px-2 py-2 ${probToClass(pQF)}">${pQF.toFixed(1)}%</td><td class="px-2 py-2 ${probToClass(pSF)}">${pSF.toFixed(1)}%</td><td class="px-2 py-2 ${probToClass(pFin)}">${pFin.toFixed(1)}%</td><td class="px-2 py-2 font-semibold ${probToClass(pChamp)}">${pChamp.toFixed(1)}%</td></tr>`;
                    });
                html += `</tbody></table></div>`;
            }
            resultsContentEl.innerHTML = html || "<p>No results. Parse & run sim.</p>";
            // Render charts after DOM is set
            renderGroupCharts(aggStats, numSims);
        }

        // --- Probability Distribution Charts ---
        const _chartInstances = {};

        function renderGroupCharts(aggStats, numSims) {
            if (typeof Chart === 'undefined') return;
            const POINT_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 9];
            const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316'];

            const sortedGroupKeys = Object.keys(aggStats).filter(k => k !== '_knockout').sort();
            sortedGroupKeys.forEach(groupKey => {
                const groupData = aggStats[groupKey];
                const teams = groupTeamNames[groupKey] || [];
                const canvasId = `chartPts_${groupKey}`;
                const canvas = document.getElementById(canvasId);
                if (!canvas) return;

                // Destroy prior chart instance if any
                if (_chartInstances[canvasId]) { _chartInstances[canvasId].destroy(); }

                const datasets = teams.map((teamName, idx) => {
                    const ptsSims = groupData[teamName]?.ptsSims || [];
                    const data = POINT_VALUES.map(pts =>
                        numSims > 0 ? (ptsSims.filter(p => p === pts).length / numSims * 100) : 0
                    );
                    return {
                        label: teamName,
                        data,
                        backgroundColor: COLORS[idx % COLORS.length] + 'cc',
                        borderColor: COLORS[idx % COLORS.length],
                        borderWidth: 1,
                    };
                });

                _chartInstances[canvasId] = new Chart(canvas, {
                    type: 'bar',
                    data: { labels: POINT_VALUES.map(String), datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` } },
                            title: { display: false }
                        },
                        scales: {
                            x: { title: { display: true, text: 'Points', font: { size: 11 } } },
                            y: { title: { display: true, text: '%', font: { size: 11 } }, beginAtZero: true }
                        }
                    }
                });
            });
        }
        
        // --- Multi-Group Tournament View ---
        function displayMultiGroupView() {
            const marginPercent = parseFloat(multiGroupMarginEl.value);
            multiGroupViewStatusEl.textContent = '';

            if (isNaN(marginPercent) || marginPercent < 0 || marginPercent > 100) {
                multiGroupViewStatusEl.textContent = 'Please enter a valid margin (0–100).';
                return;
            }
            if (currentNumSims === 0 || Object.keys(simulationAggStats).length === 0) {
                multiGroupViewStatusEl.textContent = 'Run simulation first.';
                return;
            }

            const marginDec = marginPercent / 100;
            const advPreset = getSelectedAdvancementPreset();
            const groupKeys = Object.keys(simulationAggStats).filter(k => k !== '_knockout').sort();
            const hasKnockout = Object.keys(simulationAggStats._knockout?.teamProgress || {}).length > 0 && parsedBracketMatches.length > 0;

            let html = `<h3 class="text-lg font-semibold text-indigo-600 mb-3">All Groups — Advancement Probabilities (Margin: ${marginPercent}%)</h3>`;

            // Build combined table header
            let headerCols = '<th class="px-2 py-2 text-left">Group</th><th class="px-2 py-2 text-left">Team</th><th class="px-2 py-2">P(1st)</th><th class="px-2 py-2">P(2nd)</th><th class="px-2 py-2">P(3rd)</th><th class="px-2 py-2">P(4th)</th><th class="px-2 py-2">P(Qualify)</th><th class="px-2 py-2">E(Pts)</th>';
            if (hasKnockout) headerCols += '<th class="px-2 py-2">P(Champion)</th>';

            html += `<table class="min-w-full divide-y divide-gray-200 mb-6 text-xs sm:text-sm"><thead class="bg-gray-50"><tr>${headerCols}</tr></thead><tbody class="bg-white divide-y divide-gray-200">`;

            groupKeys.forEach(gK => {
                const groupData = simulationAggStats[gK];
                const teams = groupTeamNames[gK] || [];
                // Sort teams by P(qualify) descending
                const sortedTeams = [...teams].sort((a, b) => {
                    const qa = (groupData[a]?.advanceToKnockoutCount || 0);
                    const qb = (groupData[b]?.advanceToKnockoutCount || 0);
                    return qb - qa;
                });
                sortedTeams.forEach((teamName, idx) => {
                    const ts = groupData[teamName];
                    if (!ts) return;
                    const pPos = i => currentNumSims > 0 ? (ts.posCounts[i] || 0) / currentNumSims : 0;
                    const pQual = currentNumSims > 0 ? (ts.advanceToKnockoutCount || 0) / currentNumSims : 0;
                    const avgPts = ts.ptsSims.length > 0 ? ts.ptsSims.reduce((a, b) => a + b, 0) / currentNumSims : 0;
                    const bgClass = idx % 2 === 0 ? '' : 'bg-gray-50';

                    let row = `<tr class="${bgClass}">`;
                    if (idx === 0) row = `<tr class="${bgClass} border-t-2 border-indigo-200">`;
                    row += `<td class="px-2 py-1.5 font-semibold text-indigo-600">${idx === 0 ? `Gr. ${gK}` : ''}</td>`;
                    row += `<td class="px-2 py-1.5 font-medium">${teamName}</td>`;
                    for (let i = 0; i < 4; i++) {
                        const pPct = pPos(i) * 100;
                        row += `<td class="px-2 py-1.5 text-center ${probToClass(pPct)}">${pPct.toFixed(1)}%</td>`;
                    }
                    const pQualPct = pQual * 100;
                    row += `<td class="px-2 py-1.5 text-center font-semibold ${probToClass(pQualPct)}">${pQualPct.toFixed(1)}%</td>`;
                    row += `<td class="px-2 py-1.5 text-center">${avgPts.toFixed(2)}</td>`;
                    if (hasKnockout) {
                        const kpStats = simulationAggStats._knockout?.teamProgress?.[teamName];
                        const pChamp = kpStats ? (kpStats.winFINAL || 0) / currentNumSims : 0;
                        row += `<td class="px-2 py-1.5 text-center font-semibold">${calculateOddWithMargin(pChamp, marginDec)}</td>`;
                    }
                    row += '</tr>';
                    html += row;
                });
            });

            html += '</tbody></table>';

            // Group-level summary
            html += `<h3 class="text-lg font-semibold text-indigo-600 mb-2 mt-2">Per-Group Summary</h3>`;
            html += `<table class="min-w-full divide-y divide-gray-200 text-xs sm:text-sm"><thead class="bg-gray-50"><tr><th class="px-2 py-2 text-left">Group</th><th class="px-2 py-2">Avg Goals</th><th class="px-2 py-2">P(Any 9 Pts)</th><th class="px-2 py-2">P(Any 0 Pts)</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">`;
            groupKeys.forEach(gK => {
                const gd = simulationAggStats[gK];
                const avgGoals = gd.groupTotalGoalsSims && gd.groupTotalGoalsSims.length > 0 ? gd.groupTotalGoalsSims.reduce((a, b) => a + b, 0) / currentNumSims : 0;
                const p9 = currentNumSims > 0 ? (gd.anyTeam9PtsCount || 0) / currentNumSims : 0;
                const p0 = currentNumSims > 0 ? (gd.anyTeam0PtsCount || 0) / currentNumSims : 0;
                html += `<tr><td class="px-2 py-1.5 font-semibold">Gr. ${gK}</td><td class="px-2 py-1.5 text-center">${avgGoals.toFixed(2)}</td><td class="px-2 py-1.5 text-center">${(p9*100).toFixed(1)}%</td><td class="px-2 py-1.5 text-center">${(p0*100).toFixed(1)}%</td></tr>`;
            });
            html += '</tbody></table>';

            multiGroupViewContentEl.innerHTML = html;
        }

        // --- Raw Simulation Data Export ---
        function exportRawSimData() {
            if (currentNumSims === 0 || Object.keys(simulationAggStats).length === 0) {
                showInlineError(exportRawDataErrorEl, 'Run simulation first.');
                return;
            }

            const groupKeys = Object.keys(simulationAggStats).filter(k => k !== '_knockout').sort();
            const header = 'sim,group,team,pts,gf,ga,wins,position\n';
            const rows = [];

            for (let simIdx = 0; simIdx < currentNumSims; simIdx++) {
                groupKeys.forEach(gK => {
                    const teams = groupTeamNames[gK] || [];
                    teams.forEach(teamName => {
                        const ts = simulationAggStats[gK]?.[teamName];
                        if (!ts) return;
                        const pts = ts.ptsSims[simIdx] ?? '';
                        const gf = ts.gfSims[simIdx] ?? '';
                        const ga = ts.gaSims[simIdx] ?? '';
                        const wins = ts.winsSims[simIdx] ?? '';
                        const pos = ts.positionSims[simIdx] ?? '';
                        rows.push(`${simIdx + 1},${gK},"${teamName}",${pts},${gf},${ga},${wins},${pos}`);
                    });
                });
            }

            const csvContent = header + rows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `raw_sim_data_${currentNumSims}sims.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // --- Simulated Group Odds Tab Logic ---
        function calculateOddWithMargin(trueProb, marginDec) { if (trueProb <= 0) return "N/A"; const factor = 1 + marginDec; return (1 / (trueProb * factor)).toFixed(2); }
        
        function populateSimGroupSelect() {
            simGroupSelectEl.innerHTML = '<option value="">-- Select Group --</option>'; 
            simTeamSelectEl.innerHTML = '<option value="">-- Select Group First --</option>'; 
            simTeamSelectEl.disabled = true; 
            customProbInputsContainerEl.classList.add('hidden');
            if (Object.keys(simulationAggStats).length > 0) { 
                Object.keys(simulationAggStats).filter(groupKey => groupKey !== '_knockout').sort().forEach(groupKey => { 
                    const option = document.createElement('option'); 
                    option.value = groupKey; 
                    option.textContent = `Group ${groupKey}`; 
                    simGroupSelectEl.appendChild(option); 
                });
            } else { 
                 simGroupSelectEl.innerHTML = '<option value="">-- Run Sim First --</option>';
            }
        }

        function populateTournamentTeamSelect() {
            tournamentTeamSelectEl.innerHTML = '<option value="">-- Select Team --</option>';
            const knockoutTeams = Object.keys(simulationAggStats?._knockout?.teamProgress || {});
            const groupedTeams = Object.values(groupTeamNames || {}).flat();
            const teams = [...new Set([...knockoutTeams, ...groupedTeams])].sort((a, b) => a.localeCompare(b));
            if (!teams.length) {
                tournamentTeamSelectEl.innerHTML = '<option value="">-- Run Sim First --</option>';
                return;
            }
            teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team;
                option.textContent = team;
                tournamentTeamSelectEl.appendChild(option);
            });
        }

        function getGroupKeyForTeam(teamName) {
            return Object.entries(groupTeamNames || {}).find(([, teams]) => teams.includes(teamName))?.[0] || '';
        }

        function exportTeamCsv(groupKey, teamName, marginPercent, errorEl) {
            const marginDecimal = marginPercent / 100;

            if (!groupKey || !teamName) {
                showInlineError(errorEl, 'Please select a group and a team first.');
                return;
            }
            if (isNaN(marginPercent) || marginPercent < 0 || marginPercent > 100) {
                showInlineError(errorEl, 'Please enter a valid margin between 0 and 100.');
                return;
            }

            const teamData = simulationAggStats[groupKey]?.[teamName];
            if (!teamData) {
                showInlineError(errorEl, 'No simulation data found for the selected team.');
                return;
            }
            const knockoutData = simulationAggStats?._knockout?.teamProgress?.[teamName] || {};
            const teamParsedMatches = parsedMatches.filter(match => match.group === groupKey && (match.team1 === teamName || match.team2 === teamName));
            const xPtsReference = teamParsedMatches.reduce((sum, match) => {
                if (match.team1 === teamName) return sum + (3 * match.p1) + match.px;
                return sum + (3 * match.p2) + match.px;
            }, 0);
            const xGFReference = teamParsedMatches.reduce((sum, match) => sum + (match.team1 === teamName ? match.lambda1 : match.lambda2), 0);
            const xGAReference = teamParsedMatches.reduce((sum, match) => sum + (match.team1 === teamName ? match.lambda2 : match.lambda1), 0);

            const { date, time } = getCsvExportDateTime();

            const emptyRow = () => ['', '', '', '', '', '', '', '', '', '', '', '', ''];
            const rows = [];
            const addYesNoRow = (market, probability) => {
                const row = [date, time, '', market, '', calculateOddWithMargin(probability, marginDecimal), '', '', '', '', '', '', ''];
                rows.push(buildCsvRow(row));
            };
            const addLineRow = (market, line, values) => {
                const { overProb, underProb } = getLineProbabilities(values, line);
                const row = [date, time, '', market, '', '', '', '', line.toFixed(1), calculateOddWithMargin(underProb, marginDecimal), calculateOddWithMargin(overProb, marginDecimal), '', ''];
                rows.push(buildCsvRow(row));
            };
            const addRangeYesNoRow = (market, values, predicate) => {
                const probability = values.filter(predicate).length / currentNumSims;
                addYesNoRow(market, probability);
            };

            let csvContent = buildCsvRow(['Datum', 'Vreme', 'Sifra', 'Domacin', 'Gost', '1', 'X', '2', 'GR', 'U', 'O', 'Yes', 'No']);
            const matchNameRow = emptyRow();
            matchNameRow[0] = 'MATCH_NAME:World Cup 2026';
            csvContent += buildCsvRow(matchNameRow);
            const leagueRow = emptyRow();
            leagueRow[0] = `LEAGUE_NAME:${teamName}`;
            csvContent += buildCsvRow(leagueRow);
            csvContent += buildCsvRow(emptyRow());

            addYesNoRow('Pobednik Grupe', (teamData.posCounts[0] || 0) / currentNumSims);
            addYesNoRow('2. mesto u grupi', (teamData.posCounts[1] || 0) / currentNumSims);
            addYesNoRow('3. mesto u grupi', (teamData.posCounts[2] || 0) / currentNumSims);
            addYesNoRow('4. mesto u grupi', (teamData.posCounts[3] || 0) / currentNumSims);
            addYesNoRow('prolazi grupu', (teamData.advanceToKnockoutCount || 0) / currentNumSims);
            addYesNoRow('eliminacija u 1/16 finala', (knockoutData.eliminateR32 || 0) / currentNumSims);
            addYesNoRow('eliminacija u 1/8 finala', (knockoutData.eliminateR16 || 0) / currentNumSims);
            addYesNoRow('eliminacija u 1/4 finala', (knockoutData.eliminateQF || 0) / currentNumSims);
            addYesNoRow('eliminacija u 1/2 finala', (knockoutData.eliminateSF || 0) / currentNumSims);
            addYesNoRow('eliminacija u finalu', (knockoutData.runnerUpCount || 0) / currentNumSims);
            addYesNoRow('dolazi do 1/16 finala', (knockoutData.reachR32 || 0) / currentNumSims);
            addYesNoRow('dolazi do 1/8 finala', (knockoutData.reachR16 || 0) / currentNumSims);
            addYesNoRow('dolazi do 1/4 finala', (knockoutData.reachQF || 0) / currentNumSims);
            addYesNoRow('dolazi do 1/2 finala', (knockoutData.reachSF || 0) / currentNumSims);
            addYesNoRow('dolazi do finala', (knockoutData.reachFINAL || 0) / currentNumSims);

            [0, 1, 2, 3, 4, 5, 6, 7, 9].forEach(points => {
                addRangeYesNoRow(`${points} bodova u grupi`, teamData.ptsSims, value => value === points);
            });
            addRangeYesNoRow('1-3 boda u grupi', teamData.ptsSims, value => value >= 1 && value <= 3);
            addRangeYesNoRow('2-4 boda u grupi', teamData.ptsSims, value => value >= 2 && value <= 4);
            addRangeYesNoRow('4-6 bodova u grupi', teamData.ptsSims, value => value >= 4 && value <= 6);
            addRangeYesNoRow('7+ bodova u grupi', teamData.ptsSims, value => value >= 7);

            buildDynamicHalfPointLines(teamData.ptsSims, xPtsReference).forEach((line, idx) => {
                addLineRow(`osvojenih bodova u grupi${idx + 1}`, line, teamData.ptsSims);
            });
            buildDynamicHalfPointLines(teamData.gfSims, xGFReference).forEach((line, idx) => {
                addLineRow(`datih golova u grupi${idx + 1}`, line, teamData.gfSims);
            });

            addRangeYesNoRow('1-2 datih golova u grupi', teamData.gfSims, value => value >= 1 && value <= 2);
            addRangeYesNoRow('1-3 datih golova u grupi', teamData.gfSims, value => value >= 1 && value <= 3);
            addRangeYesNoRow('2-4 datih golova u grupi', teamData.gfSims, value => value >= 2 && value <= 4);
            addRangeYesNoRow('4-6 datih golova u grupi', teamData.gfSims, value => value >= 4 && value <= 6);
            addRangeYesNoRow('5-7 datih golova u grupi', teamData.gfSims, value => value >= 5 && value <= 7);

            buildDynamicHalfPointLines(teamData.gaSims, xGAReference).forEach((line, idx) => {
                addLineRow(`primljenih golova u grupi${idx + 1}`, line, teamData.gaSims);
            });

            addYesNoRow('Najvise datih golova na turniru', (knockoutData.mostTournamentGFCount || 0) / currentNumSims);
            addYesNoRow('Najvise primljenih golova na turniru', (knockoutData.mostTournamentGACount || 0) / currentNumSims);
            addYesNoRow('Daje gol na svakoj utakmici u grupi', (teamData.scoreEveryGroupGameCount || 0) / currentNumSims);
            addYesNoRow('Bez poraza u grupi', (teamData.noLossGroupCount || 0) / currentNumSims);
            addYesNoRow('Prima gol u svakoj utakmici u grupi', (teamData.concedeEveryGroupGameCount || 0) / currentNumSims);

            const winLine = findBalancedHalfPointLine(teamData.winsSims, average(teamData.winsSims));
            addLineRow('broj pobeda u grupi', winLine, teamData.winsSims);
            const drawLine = findBalancedHalfPointLine(teamData.drawsSims, average(teamData.drawsSims));
            addLineRow('broj neresenih u grupi', drawLine, teamData.drawsSims);
            const tournamentGoalsLine = findBalancedHalfPointLine(knockoutData.tournamentGfSims || [], average(knockoutData.tournamentGfSims || []));
            addLineRow('broj datih golova na turniru', tournamentGoalsLine, knockoutData.tournamentGfSims || []);

            csvContent += rows.join('');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `team_markets_${teamName.replace(/\s+/g, '_')}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }

        function renderOverUnderRows(values, lines, marginDecimal) {
            if (!values || values.length === 0 || currentNumSims === 0) return '<p class="text-xs text-gray-500">No data.</p>';
            let html = `<table class="odds-table text-xs sm:text-sm"><thead><tr><th>Line</th><th>Over</th><th>Under</th><th>Over %</th><th>Under %</th></tr></thead><tbody>`;
            lines.forEach(line => {
                const overProb = values.filter(v => v > line).length / currentNumSims;
                const underProb = values.filter(v => v < line).length / currentNumSims;
                html += `<tr><td>${line.toFixed(1)}</td><td>${calculateOddWithMargin(overProb, marginDecimal)}</td><td>${calculateOddWithMargin(underProb, marginDecimal)}</td><td class="text-gray-400">${(overProb*100).toFixed(1)}%</td><td class="text-gray-400">${(underProb*100).toFixed(1)}%</td></tr>`;
            });
            html += '</tbody></table>';
            return html;
        }

        function getCustomOULines() {
            const raw = customOULinesEl ? customOULinesEl.value.trim() : '';
            if (!raw) return null;
            const parsed = raw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
            return parsed.length > 0 ? parsed : null;
        }

        simGroupSelectEl.addEventListener('change', () => {
            const selectedGroupKey = simGroupSelectEl.value;
            simTeamSelectEl.innerHTML = '<option value="">-- Select Team --</option>';
            customProbInputsContainerEl.classList.add('hidden'); 
            customProbAndOddResultAreaEl.innerHTML = "Custom prop odds will appear here...";

            if (selectedGroupKey && groupTeamNames[selectedGroupKey]) {
                generateGroupCsvButtonEl.disabled = false;
                groupTeamNames[selectedGroupKey].forEach(teamName => { 
                    const option = document.createElement('option'); 
                    option.value = teamName; 
                    option.textContent = teamName; 
                    simTeamSelectEl.appendChild(option); 
                });
                simTeamSelectEl.disabled = false;
            } else { 
                simTeamSelectEl.disabled = true;
                generateGroupCsvButtonEl.disabled = true;
            }
            clearOverUnderDisplay();
        });

        simTeamSelectEl.addEventListener('change', () => {
            if (simTeamSelectEl.value) {
                customProbInputsContainerEl.classList.remove('hidden');
                generateTeamCsvButtonEl.disabled = false;
                customProbAndOddResultAreaEl.innerHTML = "Define prop and click 'Calc Prop Odd'.";
            } else {
                customProbInputsContainerEl.classList.add('hidden');
                generateTeamCsvButtonEl.disabled = true;
            }
        });

        tournamentTeamSelectEl.addEventListener('change', () => {
            generateTournamentTeamCsvButtonEl.disabled = !tournamentTeamSelectEl.value;
        });
        
        showSimulatedOddsButtonEl.addEventListener('click', () => { 
            const selectedGroupKey = simGroupSelectEl.value;
            const mainMarginPercent = parseFloat(simBookieMarginEl.value);
            const advancementPreset = getSelectedAdvancementPreset();
            
            simulatedOddsStatusEl.textContent = ""; 
            calculatedOddsResultContentEl.innerHTML = "";

            if (!selectedGroupKey) { simulatedOddsStatusEl.textContent = "Select group."; return; }
            if (isNaN(mainMarginPercent) || mainMarginPercent < 0 || mainMarginPercent > 100) {
                simulatedOddsStatusEl.textContent = "Please enter a valid margin between 0 and 100.";
                return;
            }
            if (Object.keys(simulationAggStats).length === 0 || !simulationAggStats[selectedGroupKey] || currentNumSims === 0) { simulatedOddsStatusEl.textContent = "No sim data. Run sim."; return; }
            
            const groupData = simulationAggStats[selectedGroupKey], teams = groupTeamNames[selectedGroupKey] || [];
            if (!groupData || teams.length === 0) { simulatedOddsStatusEl.textContent = "Group data incomplete."; return; }
            
            const mainMarginDecimal = mainMarginPercent / 100;
            let html = `<h3 class="text-lg font-semibold text-purple-600 mb-2">Market Odds for Group ${selectedGroupKey} (Margin: ${mainMarginPercent}%)</h3>`;
            
            html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">Team Standings Odds (1st/2nd/3rd/4th):</h4><table class="odds-table text-xs sm:text-sm"><thead><tr><th>Team</th><th>1st Place</th><th>2nd Place</th><th>3rd Place</th><th>4th Place</th></tr></thead><tbody>`;
            teams.forEach(tN=>{
                html += `<tr><td class="font-medium">${tN}</td>`;
                for(let i = 0; i < 4; i++) {
                    const tS=groupData[tN],tP=(tS&&tS.posCounts&&currentNumSims>0)?(tS.posCounts[i]||0)/currentNumSims:0,o=calculateOddWithMargin(tP,mainMarginDecimal);
                    html += `<td>${o} <span class="text-gray-400">(${(tP*100).toFixed(1)}%)</span></td>`;
                }
                html += `</tr>`;
            });
            html+=`</tbody></table>`;

            const winnerSelections = teams.map(teamName => {
                const teamStats = groupData[teamName];
                const winnerProbability = (teamStats && teamStats.posCounts && currentNumSims > 0)
                    ? (teamStats.posCounts[0] || 0) / currentNumSims
                    : 0;
                const winnerOdd = calculateOddWithMargin(winnerProbability, mainMarginDecimal);
                const impliedProbability = winnerOdd === "N/A" ? 0 : 1 / Number(winnerOdd);
                return { teamName, winnerProbability, winnerOdd, impliedProbability };
            });
            const totalWinnerImpliedProbability = winnerSelections.reduce((sum, selection) => sum + selection.impliedProbability, 0);
            const totalWinnerMarginPercent = (totalWinnerImpliedProbability - 1) * 100;

            html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">Group Winner Odds (All Selections):</h4>`;
            html += `<table class="odds-table text-xs sm:text-sm"><thead><tr><th>Selection</th><th>Prob</th><th>Odd</th></tr></thead><tbody>`;
            winnerSelections.forEach(({ teamName, winnerProbability, winnerOdd }) => {
                html += `<tr><td>${teamName}</td><td>${(winnerProbability * 100).toFixed(1)}%</td><td>${winnerOdd}</td></tr>`;
            });
            html += `</tbody></table>`;
            html += `<p class="text-xs text-gray-600 -mt-2 mb-2"><strong>Total winner market margin:</strong> ${totalWinnerMarginPercent.toFixed(2)}% (sum implied probability: ${(totalWinnerImpliedProbability * 100).toFixed(2)}%).</p>`;
            
            html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">To Qualify (${advancementPreset.label}):</h4><table class="odds-table text-xs sm:text-sm"><thead><tr><th>Team</th><th>P(Qualify)</th><th>Odd</th></tr></thead><tbody>`;
            teams.forEach(tN=>{const tS=groupData[tN],tP=(tS&&currentNumSims>0)?(tS.advanceToKnockoutCount||0)/currentNumSims:0,o=calculateOddWithMargin(tP,mainMarginDecimal);html+=`<tr><td>${tN}</td><td>${(tP*100).toFixed(1)}%</td><td>${o}</td></tr>`;});html+=`</tbody></table>`;

            html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">Team to Score Most Goals:</h4><table class="odds-table text-xs sm:text-sm"><thead><tr><th>Team</th><th>P(Most GF)</th><th>Odd</th></tr></thead><tbody>`;
            teams.forEach(tN=>{const tS=groupData[tN],tP=(tS&&currentNumSims>0)?(tS.mostGFCount||0)/currentNumSims:0,o=calculateOddWithMargin(tP,mainMarginDecimal);html+=`<tr><td>${tN}</td><td>${(tP*100).toFixed(1)}%</td><td>${o}</td></tr>`;});html+=`</tbody></table>`;
            
            html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">Team to Concede Most Goals:</h4><table class="odds-table text-xs sm:text-sm"><thead><tr><th>Team</th><th>P(Most GA)</th><th>Odd</th></tr></thead><tbody>`;
            teams.forEach(tN=>{const tS=groupData[tN],tP=(tS&&currentNumSims>0)?(tS.mostGACount||0)/currentNumSims:0,o=calculateOddWithMargin(tP,mainMarginDecimal);html+=`<tr><td>${tN}</td><td>${(tP*100).toFixed(1)}%</td><td>${o}</td></tr>`;});html+=`</tbody></table>`;

            const allSF = Object.entries(groupData.straightForecasts || {}).sort(([, a], [, b]) => b - a);
            html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">All Straight Forecasts (1st-2nd):</h4>`;
            if (allSF.length > 0) {
                html += `<table class="odds-table text-xs sm:text-sm max-h-60 overflow-y-auto block"><thead><tr><th>Forecast</th><th>Prob</th><th>Odd</th></tr></thead><tbody>`;
                allSF.forEach(([k, c]) => { const tP = currentNumSims > 0 ? c / currentNumSims : 0, o = calculateOddWithMargin(tP, mainMarginDecimal); html += `<tr><td>${k}</td><td>${(tP * 100).toFixed(1)}%</td><td>${o}</td></tr>`; });
                html += `</tbody></table>`;
            } else { html += `<p class="text-xs text-gray-500">No SF data.</p>`; }

            const topAD=Object.entries(groupData.advancingDoubles||{}).sort(([,a],[,b])=>b-a).slice(0,10); html+=`<h4 class="font-medium text-gray-700 mt-3 mb-1">Top Advancing Doubles (Top 2 Any Order):</h4>`; if(topAD.length>0){html+=`<table class="odds-table text-xs sm:text-sm"><thead><tr><th>Pair</th><th>Prob</th><th>Odd</th></tr></thead><tbody>`;topAD.forEach(([k,c])=>{const tP=currentNumSims>0?c/currentNumSims:0,o=calculateOddWithMargin(tP,mainMarginDecimal);html+=`<tr><td>${k}</td><td>${(tP*100).toFixed(1)}%</td><td>${o}</td></tr>`;});html+=`</tbody></table>`;}else{html+=`<p class="text-xs text-gray-500">No AD data.</p>`;}
            
            const probAny9Pts = currentNumSims > 0 ? (groupData.anyTeam9PtsCount || 0) / currentNumSims : 0; const oddAny9Pts = calculateOddWithMargin(probAny9Pts, mainMarginDecimal);
            html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">Group Specials:</h4><table class="odds-table text-xs sm:text-sm"><thead><tr><th>Event</th><th>Prob</th><th>Odd</th></tr></thead><tbody>`;
            html += `<tr><td>Any Team scores 9 Pts</td><td>${(probAny9Pts * 100).toFixed(1)}%</td><td>${oddAny9Pts}</td></tr>`;
            const probAny0Pts = currentNumSims > 0 ? (groupData.anyTeam0PtsCount || 0) / currentNumSims : 0; const oddAny0Pts = calculateOddWithMargin(probAny0Pts, mainMarginDecimal);
            html += `<tr><td>Any Team scores 0 Pts</td><td>${(probAny0Pts * 100).toFixed(1)}%</td><td>${oddAny0Pts}</td></tr></tbody></table>`;

            calculatedOddsResultContentEl.innerHTML = html;

            const displayAvgAndOU = (dataKey, expectedElId, resultElId) => {
                const resultElement = document.getElementById(resultElId);
                const expectedElement = document.getElementById(expectedElId);
                const ouMarginDecimal = parseFloat(document.getElementById('ouBookieMargin').value) / 100;

                if (groupData[dataKey] && groupData[dataKey].length > 0 && currentNumSims > 0) {
                    const avg = groupData[dataKey].reduce((a, b) => a + b, 0) / currentNumSims;
                    expectedElement.textContent = `(Avg: ${avg.toFixed(2)})`;

                    // Use custom lines if specified, otherwise auto-compute
                    const customLines = getCustomOULines();
                    let lines;
                    if (customLines) {
                        lines = customLines;
                    } else {
                        const centerLine = Math.round(avg) + 0.5;
                        lines = [centerLine - 1, centerLine, centerLine + 1].filter(l => l > 0);
                    }

                    let ouHtml = `<table class="w-full text-center"><thead><tr class="text-gray-500"><th>Line</th><th>Over</th><th>Under</th><th class="text-gray-400 text-xs">Over%</th><th class="text-gray-400 text-xs">Under%</th></tr></thead><tbody>`;

                    lines.forEach(line => {
                         const overCount = groupData[dataKey].filter(val => val > line).length;
                         const underCount = groupData[dataKey].filter(val => val < line).length;
                         const probOver = overCount / currentNumSims;
                         const probUnder = underCount / currentNumSims;
                         const oddOver = calculateOddWithMargin(probOver, ouMarginDecimal);
                         const oddUnder = calculateOddWithMargin(probUnder, ouMarginDecimal);
                         ouHtml += `<tr><td>${line.toFixed(1)}</td><td>${oddOver}</td><td>${oddUnder}</td><td class="text-gray-400 text-xs">${(probOver*100).toFixed(1)}%</td><td class="text-gray-400 text-xs">${(probUnder*100).toFixed(1)}%</td></tr>`;
                    });
                     ouHtml += `</tbody></table>`;
                     resultElement.innerHTML = ouHtml;

                } else {
                     expectedElement.textContent = '';
                     resultElement.innerHTML = '';
                }
            };

            displayAvgAndOU('groupTotalGoalsSims', 'expectedTotalGroupGoals', 'ouTotalGroupGoalsResult');
            displayAvgAndOU('firstPlacePtsSims', 'expectedFirstPlacePts', 'ouFirstPlacePtsResult');
            displayAvgAndOU('fourthPlacePtsSims', 'expectedFourthPlacePts', 'ouFourthPlacePtsResult');
            displayAvgAndOU('firstPlaceGFSims', 'expectedFirstPlaceGF', 'ouFirstPlaceGFResult');
            displayAvgAndOU('fourthPlaceGFSims', 'expectedFourthPlaceGF', 'ouFourthPlaceGFResult');
        });

        showTournamentTeamOddsButtonEl.addEventListener('click', () => {
            const selectedTeam = tournamentTeamSelectEl.value;
            const marginPercent = parseFloat(tournamentBookieMarginEl.value);
            tournamentTeamOddsStatusEl.textContent = '';
            tournamentTeamOddsResultContentEl.innerHTML = '';

            if (isNaN(marginPercent) || marginPercent < 0 || marginPercent > 100) { tournamentTeamOddsStatusEl.textContent = 'Enter a valid margin between 0 and 100.'; return; }
            if (currentNumSims === 0) { tournamentTeamOddsStatusEl.textContent = 'Run simulation first.'; return; }

            const marginDecimal = marginPercent / 100;
            const teamProgress = simulationAggStats?._knockout?.teamProgress || {};
            const allTeamsWithKnockoutData = Object.keys(teamProgress).sort((a, b) => a.localeCompare(b));
            if (allTeamsWithKnockoutData.length === 0) {
                tournamentTeamOddsStatusEl.textContent = 'No knockout/tournament stats available. Make sure bracket data is provided.';
                return;
            }

            const winnerSelections = allTeamsWithKnockoutData.map(teamName => {
                const teamStats = teamProgress[teamName];
                const winProbability = (teamStats?.winFINAL || 0) / currentNumSims;
                const winnerOdd = calculateOddWithMargin(winProbability, marginDecimal);
                const impliedProbability = winnerOdd === "N/A" ? 0 : 1 / Number(winnerOdd);
                return { teamName, winProbability, winnerOdd, impliedProbability };
            }).sort((a, b) => b.winProbability - a.winProbability);

            const totalWinnerImpliedProbability = winnerSelections.reduce((sum, s) => sum + s.impliedProbability, 0);
            const totalWinnerMarginPercent = (totalWinnerImpliedProbability - 1) * 100;

            let winnerSortCol = 'winProbability';
            let winnerSortDir = -1;

            const renderWinnerOddsTable = () => {
                const sorted = [...winnerSelections].sort((a, b) => {
                    if (winnerSortCol === 'teamName') return winnerSortDir * a.teamName.localeCompare(b.teamName);
                    const aVal = winnerSortCol === 'winnerOdd' ? (a.winnerOdd === 'N/A' ? Infinity : Number(a.winnerOdd)) : a[winnerSortCol];
                    const bVal = winnerSortCol === 'winnerOdd' ? (b.winnerOdd === 'N/A' ? Infinity : Number(b.winnerOdd)) : b[winnerSortCol];
                    return winnerSortDir * (aVal - bVal);
                });
                const tbody = document.getElementById('winner-odds-tbody');
                if (!tbody) return;
                tbody.innerHTML = sorted.map(({ teamName, winProbability, winnerOdd }) => {
                    const highlight = teamName === selectedTeam ? ' style="background:#f0fdf4;font-weight:600"' : '';
                    return `<tr${highlight}><td>${teamName}</td><td>${(winProbability * 100).toFixed(1)}%</td><td>${winnerOdd}</td></tr>`;
                }).join('');
                document.querySelectorAll('#winner-odds-table th[data-col]').forEach(th => {
                    const ind = th.querySelector('.sort-ind');
                    if (ind) ind.textContent = th.dataset.col === winnerSortCol ? (winnerSortDir === 1 ? ' ↑' : ' ↓') : '';
                });
            };

            const attachWinnerTableSort = () => {
                document.querySelectorAll('#winner-odds-table th[data-col]').forEach(th => {
                    th.addEventListener('click', () => {
                        const col = th.dataset.col;
                        if (winnerSortCol === col) { winnerSortDir *= -1; }
                        else { winnerSortCol = col; winnerSortDir = col === 'teamName' ? 1 : -1; }
                        renderWinnerOddsTable();
                    });
                });
            };

            let html = '';

            // ===== SECTION 1: TEAM-SPECIFIC DEEP DIVE =====
            if (selectedTeam && teamProgress[selectedTeam]) {
                const stats = teamProgress[selectedTeam];

                const rounds = [
                    { label: 'Round of 32', short: 'R32', key: 'reachR32', color: '#6366f1' },
                    { label: 'Round of 16', short: 'R16', key: 'reachR16', color: '#8b5cf6' },
                    { label: 'Quarter-Final', short: 'QF', key: 'reachQF', color: '#ec4899' },
                    { label: 'Semi-Final', short: 'SF', key: 'reachSF', color: '#f59e0b' },
                    { label: 'Final', short: 'FINAL', key: 'reachFINAL', color: '#10b981' },
                    { label: 'Tournament Win', short: 'WIN', key: 'winFINAL', color: '#f59e0b' },
                ];

                const maxReach = (stats.reachR32 || stats.reachR16 || 1);
                const firstRoundCount = rounds.find(r => stats[r.key] > 0);
                const baseCount = firstRoundCount ? (stats[firstRoundCount.key] || 1) : currentNumSims;

                html += `<div style="margin-bottom:24px; padding:16px; background:linear-gradient(135deg,#1e1b4b,#312e81); border-radius:12px; color:white">`;
                html += `<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:4px">${selectedTeam} — Tournament Path Probabilities</h3>`;
                html += `<p style="font-size:0.75rem;opacity:0.7;margin-bottom:16px">Based on ${currentNumSims.toLocaleString()} simulations</p>`;

                // Round cards
                html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:20px">`;
                rounds.forEach(({ label, key, color }) => {
                    const count = stats[key] || 0;
                    const prob = count / currentNumSims;
                    const odd = calculateOddWithMargin(prob, marginDecimal);
                    html += `<div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:12px;border-left:3px solid ${color}">`;
                    html += `<div style="font-size:0.65rem;opacity:0.7;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">${label}</div>`;
                    html += `<div style="font-size:1.4rem;font-weight:800;line-height:1">${(prob * 100).toFixed(1)}%</div>`;
                    html += `<div style="font-size:0.75rem;opacity:0.6;margin-top:2px">Odd: ${odd}</div>`;
                    html += `</div>`;
                });
                html += `</div>`;

                // Probability funnel bars
                html += `<div style="margin-bottom:8px">`;
                html += `<p style="font-size:0.7rem;opacity:0.6;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Probability Funnel</p>`;
                rounds.forEach(({ label, key, color }) => {
                    const count = stats[key] || 0;
                    const prob = count / currentNumSims;
                    const barWidth = (prob * 100).toFixed(1);
                    html += `<div style="margin-bottom:8px">`;
                    html += `<div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:3px;opacity:0.85"><span>${label}</span><span>${barWidth}%</span></div>`;
                    html += `<div style="background:rgba(255,255,255,0.1);border-radius:999px;height:6px;overflow:hidden">`;
                    html += `<div style="height:100%;border-radius:999px;background:${color};width:${barWidth}%;transition:width 0.3s"></div>`;
                    html += `</div></div>`;
                });
                html += `</div>`;

                html += `</div>`;

                // Probable Knockout Path (most common opponents at each stage)
                if (simulationAggStats._knockout?._pathData) {
                    const pathData = simulationAggStats._knockout._pathData[selectedTeam];
                    if (pathData && Object.keys(pathData).length > 0) {
                        html += `<div style="margin-bottom:24px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px">`;
                        html += `<h4 style="font-size:0.95rem;font-weight:700;color:#166534;margin-bottom:4px">Most Probable Knockout Path</h4>`;
                        html += `<p style="font-size:0.75rem;color:#15803d;margin-bottom:14px">Most frequent opponent at each stage across all simulations.</p>`;
                        html += `<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">`;

                        const roundLabels = { R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', FINAL: 'Final' };
                        let first = true;
                        Object.entries(roundLabels).forEach(([round, label]) => {
                            const opponents = pathData[round];
                            if (!opponents) return;
                            const topOpp = Object.entries(opponents).sort((a,b) => b[1]-a[1])[0];
                            if (!topOpp) return;
                            const freq = (topOpp[1] / (stats[round === 'R32' ? 'reachR32' : round === 'R16' ? 'reachR16' : round === 'QF' ? 'reachQF' : round === 'SF' ? 'reachSF' : 'reachFINAL'] || 1) * 100).toFixed(0);
                            if (!first) html += `<div style="color:#4ade80;font-size:1.1rem">→</div>`;
                            first = false;
                            html += `<div style="background:white;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;text-align:center">`;
                            html += `<div style="font-size:0.6rem;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em">${label}</div>`;
                            html += `<div style="font-size:0.85rem;font-weight:700;color:#111827">${topOpp[0]}</div>`;
                            html += `<div style="font-size:0.65rem;color:#6b7280">${freq}% of runs</div>`;
                            html += `</div>`;
                        });
                        html += `</div></div>`;
                    }
                }

                // Team Goals markets
                const goalsForAvg = (stats.tournamentGfSims || []).reduce((a, b) => a + b, 0) / currentNumSims;
                const goalsAgainstAvg = (stats.tournamentGaSims || []).reduce((a, b) => a + b, 0) / currentNumSims;
                const gamesAvg = (stats.tournamentGamesSims || []).reduce((a, b) => a + b, 0) / currentNumSims;

                html += `<details open style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:600;font-size:0.9rem;color:#374151;padding:8px 0">Tournament Goals O/U Markets</summary>`;
                html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">Goals Scored O/U <span class="expected-value-info">(Avg: ${goalsForAvg.toFixed(2)})</span></h4>`;
                html += renderOverUnderRows(stats.tournamentGfSims, [Math.max(0.5, Math.floor(goalsForAvg) - 0.5), Math.floor(goalsForAvg) + 0.5, Math.floor(goalsForAvg) + 1.5], marginDecimal);
                html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">Goals Conceded O/U <span class="expected-value-info">(Avg: ${goalsAgainstAvg.toFixed(2)})</span></h4>`;
                html += renderOverUnderRows(stats.tournamentGaSims, [Math.max(0.5, Math.floor(goalsAgainstAvg) - 0.5), Math.floor(goalsAgainstAvg) + 0.5, Math.floor(goalsAgainstAvg) + 1.5], marginDecimal);
                html += `<h4 class="font-medium text-gray-700 mt-3 mb-1">Total Games O/U <span class="expected-value-info">(Avg: ${gamesAvg.toFixed(2)})</span></h4>`;
                html += renderOverUnderRows(stats.tournamentGamesSims, [2.5, 3.5, 4.5, 5.5, 6.5], marginDecimal);
                html += `</details>`;

                html += `<hr style="margin:24px 0;border-color:#e5e7eb">`;
            }

            // ===== SECTION 2: ALL-TEAMS WINNER MARKET =====
            html += `<h3 class="text-lg font-semibold text-purple-600 mb-2">Tournament Winner Odds (Margin: ${marginPercent}%)</h3>`;
            html += `<table id="winner-odds-table" class="odds-table text-xs sm:text-sm"><thead><tr>`;
            html += `<th data-col="teamName" class="cursor-pointer select-none">Team<span class="sort-ind"></span></th>`;
            html += `<th data-col="winProbability" class="cursor-pointer select-none">Win %<span class="sort-ind"> ↓</span></th>`;
            html += `<th data-col="winnerOdd" class="cursor-pointer select-none">Odd<span class="sort-ind"></span></th>`;
            html += `</tr></thead><tbody id="winner-odds-tbody"></tbody></table>`;
            html += `<p class="text-xs text-gray-600 mt-1 mb-4"><strong>Total market margin:</strong> ${totalWinnerMarginPercent.toFixed(2)}% (sum implied: ${(totalWinnerImpliedProbability * 100).toFixed(2)}%).</p>`;

            if (!selectedTeam) {
                html += `<p class="text-xs text-gray-500">💡 Select a team above to view their detailed round-by-round breakdown and most probable knockout path.</p>`;
            }

            tournamentTeamOddsResultContentEl.innerHTML = html;
            renderWinnerOddsTable();
            attachWinnerTableSort();
        });


        calculateCustomProbAndOddButtonEl.addEventListener('click', () => {
            const groupKey = simGroupSelectEl.value;
            const teamName = simTeamSelectEl.value;
            const marginPercent = parseFloat(simBookieMarginEl.value);
            const statType = simCustomStatTypeEl.value;
            const operator = simCustomOperatorEl.value;
            const value1 = parseFloat(simCustomValue1El.value);
            let value2 = null;
            if (operator === 'between') value2 = parseFloat(simCustomValue2El.value);

            customProbAndOddResultAreaEl.innerHTML = ""; 

            if (!groupKey || !teamName) { customProbAndOddResultAreaEl.innerHTML = '<p class="text-red-500">Select group and team.</p>'; return; }
            if (isNaN(marginPercent) || marginPercent < 0 || marginPercent > 100) { customProbAndOddResultAreaEl.innerHTML = '<p class="text-red-500">Valid margin (0–100) needed.</p>'; return; }
            if (isNaN(value1) || (operator === 'between' && isNaN(value2))) { customProbAndOddResultAreaEl.innerHTML = '<p class="text-red-500">Invalid Value(s) for prop.</p>'; return; }
            if (operator === 'between' && value1 >= value2) { customProbAndOddResultAreaEl.innerHTML = '<p class="text-red-500">For "Between", Value 1 must be < Value 2.</p>'; return; }
            
            const teamData = simulationAggStats[groupKey]?.[teamName];
            if (!teamData || !teamData[statType] || !teamData[statType].length || currentNumSims === 0) { customProbAndOddResultAreaEl.innerHTML = '<p class="text-gray-500">No simulation data for this specific prop.</p>'; return; }

            const simValues = teamData[statType];
            let metConditionCount = 0;
            simValues.forEach(simVal => {
                let conditionMet = false;
                switch (operator) {
                    case '>': conditionMet = simVal > value1; break;
                    case '>=': conditionMet = simVal >= value1; break;
                    case '<': conditionMet = simVal < value1; break;
                    case '<=': conditionMet = simVal <= value1; break;
                    case '==': conditionMet = Math.abs(simVal - value1) < 0.001; break;
                    case 'between': conditionMet = simVal >= value1 && simVal <= value2; break;
                }
                if (conditionMet) metConditionCount++;
            });
            
            const trueProbability = metConditionCount / currentNumSims;
            const marginDecimal = marginPercent / 100;
            const odd = calculateOddWithMargin(trueProbability, marginDecimal);

            let propDescription = `${teamName} ${statType.replace('Sims','')} ${operator} ${value1}`;
            if (operator === 'between') propDescription += ` and ${value2}`;

            customProbAndOddResultAreaEl.innerHTML = `
                <p><strong>Prop:</strong> ${propDescription}</p>
                <p><strong>Simulated Probability:</strong> ${(trueProbability * 100).toFixed(1)}%</p>
                <p><strong>Calculated Odd (with ${marginPercent}% margin):</strong> ${odd}</p>`;
        });

        // --- Clear Button ---
        clearButtonEl.addEventListener('click', () => {
            matchDataEl.value = ""; numSimulationsEl.value = "10000"; numSimulationsPresetEl.value = "10000"; statusAreaEl.innerHTML = ""; resultsContentEl.innerHTML = '<span class="text-gray-400">Results will appear here...</span>';
            eloDataEl.value = "";
            bracketDataEl.value = "";
            parsedMatches=[]; parsedBracketMatches=[]; teamEloRatings={}; allTeams.clear(); groupedMatches={}; groupTeamNames={}; simulationAggStats={}; currentNumSims=0;
            lockedScenarios = {};
            runButtonEl.disabled=true; loaderEl.classList.add('hidden'); parseButtonEl.disabled=false;
            csvFileInputEl.value=null; csvFileNameEl.textContent="No file selected.";
            eloCsvFileInputEl.value=null; eloCsvFileNameEl.textContent="No file selected.";
            bracketCsvFileInputEl.value=null; bracketCsvFileNameEl.textContent="No file selected.";
            populateSimGroupSelect();
            populateTournamentTeamSelect();
            calculatedOddsResultContentEl.innerHTML = 'Select a group and click "Show/Refresh Market Odds" to see results.';
            simulatedOddsStatusEl.textContent = "";
            customProbInputsContainerEl.classList.add('hidden');
            customProbAndOddResultAreaEl.innerHTML = "Custom prop odds will appear here...";
            generateTeamCsvButtonEl.disabled = true;
            generateTournamentTeamCsvButtonEl.disabled = true;
            // Clear O/U sections
            document.getElementById('ouTotalGroupGoalsResult').innerHTML = '';
            document.getElementById('expectedTotalGroupGoals').textContent = '';
            document.getElementById('ouFirstPlacePtsResult').innerHTML = '';
            document.getElementById('expectedFirstPlacePts').textContent = '';
            document.getElementById('ouFourthPlacePtsResult').innerHTML = '';
            document.getElementById('expectedFourthPlacePts').textContent = '';
            document.getElementById('ouFirstPlaceGFResult').innerHTML = '';
            document.getElementById('expectedFirstPlaceGF').textContent = '';
            document.getElementById('ouFourthPlaceGFResult').innerHTML = '';
            document.getElementById('expectedFourthPlaceGF').textContent = '';
            tournamentTeamOddsStatusEl.textContent = '';
            tournamentTeamOddsResultContentEl.innerHTML = 'Click "Show Tournament Odds" to view winner market odds and margin.';
            scenarioLockSectionEl.classList.add('hidden');
            exportRawDataSectionEl.classList.add('hidden');
            multiGroupViewContentEl.innerHTML = 'Run simulation first, then click "Show Multi-Group Overview".';
            multiGroupViewStatusEl.textContent = '';
            syncSimulationPresetFromInput();
            renderLambdaView();
        });

        // --- Initial Sample Data (72 matches from match_odds_all_72.csv) ---
        inputModeEl.value = 'odds';
        matchDataEl.value = `A	Mexico	vs	South Africa	1.56	4.33	6.4	1.91	1.91
A	South Korea	vs	Czech Republic	2.6	3.11	2.61	1.62	2.18
B	Canada	vs	Bosnia & Herzegovina	1.86	3.55	3.72	1.65	2.13
B	USA	vs	Paraguay	1.96	3.84	3.86	1.84	1.99
C	Qatar	vs	Switzerland	12.0	5.8	1.3	2.25	1.66
C	Brazil	vs	Morocco	1.65	3.92	6.0	1.89	1.93
D	Haiti	vs	Scotland	7.1	5.05	1.45	2.02	1.81
D	Australia	vs	Turkey	3.84	3.4	1.87	1.71	2.04
E	Germany	vs	Curacao	1.03	20.0	85.0	1.83	2.0
E	Netherlands	vs	Japan	1.97	3.75	3.94	1.92	1.9
F	Ivory Coast	vs	Ecuador	3.52	2.9	2.5	1.51	2.6
F	Sweden	vs	Tunisia	1.9	3.37	3.74	1.63	2.16
G	Spain	vs	Cape Verde	1.1	10.5	35.0	1.94	1.88
G	Belgium	vs	Egypt	1.69	4.2	5.05	2.03	1.8
H	Saudi Arabia	vs	Uruguay	5.95	4.05	1.63	1.86	1.96
H	Iran	vs	New Zealand	1.77	3.78	5.0	1.77	2.07
I	France	vs	Senegal	1.47	4.6	7.6	1.97	1.85
I	Iraq	vs	Norway	7.93	5.6	1.3	2.26	1.61
J	Argentina	vs	Algeria	1.44	4.45	9.2	1.91	1.91
J	Austria	vs	Jordan	1.36	5.4	9.2	2.29	1.64
K	Portugal	vs	D.R. Congo	1.3	4.8	8.7	2.28	1.57
K	England	vs	Croatia	1.69	4.1	5.2	1.87	1.95
L	Ghana	vs	Panama	2.01	3.84	3.7	1.81	2.02
L	Uzbekistan	vs	Colombia	8.4	4.65	1.44	1.97	1.85
A	Czech Republic	vs	South Africa	1.92	3.48	3.65	1.75	2.05
C	Switzerland	vs	Bosnia & Herzegovina	2.05	3.6	3.35	1.98	1.84
B	Canada	vs	Qatar	1.45	4.4	8.0	1.72	2.1
A	Mexico	vs	South Korea	1.97	3.65	3.75	1.85	1.95
B	USA	vs	Australia	2.7	3.35	2.7	1.82	2.0
D	Scotland	vs	Morocco	3.05	3.25	2.45	1.78	2.02
C	Brazil	vs	Haiti	1.12	9.5	25.0	2.2	1.65
D	Turkey	vs	Paraguay	2.05	3.5	3.45	1.83	1.98
F	Netherlands	vs	Sweden	1.7	4.0	4.8	2.15	1.7
E	Germany	vs	Ivory Coast	1.5	4.5	7.0	1.95	1.85
E	Ecuador	vs	Curacao	1.32	5.1	11.0	2.05	1.75
F	Tunisia	vs	Japan	3.35	3.3	2.25	1.72	2.12
G	Spain	vs	Saudi Arabia	1.25	6.0	14.0	2.15	1.7
H	Belgium	vs	Iran	1.45	4.5	7.8	1.98	1.82
G	Uruguay	vs	Cape Verde	1.48	4.6	7.2	2.2	1.68
H	New Zealand	vs	Egypt	3.75	3.35	2.05	1.64	2.25
J	Argentina	vs	Austria	1.47	4.7	7.4	2.22	1.66
I	France	vs	Iraq	1.15	8.5	19.0	2.35	1.58
I	Norway	vs	Senegal	2.05	3.5	3.45	1.83	1.98
J	Jordan	vs	Algeria	6.5	4.6	1.5	1.9	1.9
K	Portugal	vs	Uzbekistan	1.2	7.5	16.0	2.3	1.62
L	England	vs	Ghana	1.34	5.2	10.0	2.08	1.76
L	Panama	vs	Croatia	7.5	4.9	1.42	2.0	1.8
K	Colombia	vs	D.R. Congo	1.65	4.0	5.5	1.95	1.85
B	Bosnia & Herzegovina	vs	Qatar	1.48	4.2	8.2	1.58	2.4
C	Switzerland	vs	Canada	2.08	3.45	3.5	1.78	2.05
C	Morocco	vs	Haiti	1.25	6.1	15.0	2.12	1.72
D	Scotland	vs	Brazil	10.0	5.5	1.33	2.25	1.65
A	Czech Republic	vs	Mexico	2.95	3.25	2.5	1.74	2.08
A	South Africa	vs	South Korea	3.45	3.25	2.25	1.68	2.18
E	Curacao	vs	Ivory Coast	8.0	4.8	1.43	1.88	1.92
E	Ecuador	vs	Germany	5.2	4.1	1.68	1.92	1.9
F	Japan	vs	Sweden	2.45	3.4	2.85	1.89	1.92
F	Tunisia	vs	Netherlands	6.5	4.4	1.52	2.2	1.68
D	Paraguay	vs	Australia	2.1	3.4	3.6	1.79	2.03
B	Turkey	vs	USA	2.75	3.3	2.65	1.78	2.05
I	Norway	vs	France	4.6	3.95	1.75	2.05	1.78
I	Senegal	vs	Iraq	1.75	3.85	4.8	1.98	1.84
G	Cape Verde	vs	Saudi Arabia	3.05	3.15	2.55	1.62	2.3
G	Uruguay	vs	Spain	5.8	4.3	1.6	1.93	1.88
H	Egypt	vs	Iran	2.35	3.2	3.25	1.65	2.25
H	New Zealand	vs	Belgium	8.5	5.0	1.38	2.15	1.7
L	Croatia	vs	Ghana	1.95	3.4	4.1	1.68	2.2
L	Panama	vs	England	22.0	9.0	1.15	2.2	1.67
K	Colombia	vs	Portugal	4.1	3.8	1.85	2.0	1.82
K	D.R. Congo	vs	Uzbekistan	2.15	3.25	3.7	1.63	2.3
J	Algeria	vs	Austria	2.75	3.35	2.65	1.83	1.98
J	Jordan	vs	Argentina	16.0	7.0	1.2	2.05	1.78`;
        eloDataEl.value = `GROUP,TEAM,ELO_RATING
A,South Korea,1844
A,Czech Republic,1731
A,Mexico,1715
A,South Africa,1602
B,Switzerland,1897
B,Canada,1744
B,Bosnia and Herzegovina,1572
B,Qatar,1540
C,Brazil,1970
C,Morocco,1785
C,Scotland,1790
C,Haiti,1420
D,USA,1812
D,Turkey,1880
D,Australia,1733
D,Paraguay,1722
E,Germany,1910
E,Ecuador,1933
E,Ivory Coast,1720
E,Curaçao,1355
F,Netherlands,1959
F,Sweden,1660
F,Japan,1825
F,Tunisia,1615
G,Belgium,1850
G,Iran,1810
G,Egypt,1748
G,New Zealand,1555
H,Spain,2172
H,Uruguay,1895
H,Saudi Arabia,1588
H,Cape Verde,1530
I,France,2062
I,Norway,1922
I,Senegal,1792
I,Iraq,1560
J,Argentina,2113
J,Austria,1818
J,Algeria,1735
J,Jordan,1525
K,Portugal,1976
K,Colombia,1975
K,DR Congo,1515
K,Uzbekistan,1645
L,England,2042
L,Croatia,1932
L,Ghana,1610
L,Panama,1655`;
        bracketDataEl.value = `ROUND,MATCH_ID,TEAM_A,vs,TEAM_B
R32,Match 74,Winner Group E,vs,3rd Group A/B/C/D/F
R32,Match 77,Winner Group I,vs,3rd Group C/D/F/G/H
R32,Match 73,Runner-up Group A,vs,Runner-up Group B
R32,Match 75,Winner Group F,vs,Runner-up Group C
R32,Match 83,Runner-up Group K,vs,Runner-up Group L
R32,Match 84,Winner Group H,vs,Runner-up Group J
R32,Match 81,Winner Group D,vs,3rd Group B/E/F/I/J
R32,Match 82,Winner Group G,vs,3rd Group A/E/H/I/J
R32,Match 76,Winner Group C,vs,Runner-up Group F
R32,Match 78,Runner-up Group E,vs,Runner-up Group I
R32,Match 79,Winner Group A,vs,3rd Group C/E/F/H/I
R32,Match 80,Winner Group L,vs,3rd Group E/H/I/J/K
R32,Match 86,Winner Group J,vs,Runner-up Group H
R32,Match 88,Runner-up Group D,vs,Runner-up Group G
R32,Match 85,Winner Group B,vs,3rd Group E/F/G/I/J
R32,Match 87,Winner Group K,vs,3rd Group D/E/I/J/L
R16,Match 89,Winner Match 74,vs,Winner Match 77
R16,Match 90,Winner Match 73,vs,Winner Match 75
R16,Match 93,Winner Match 83,vs,Winner Match 84
R16,Match 94,Winner Match 81,vs,Winner Match 82
R16,Match 91,Winner Match 76,vs,Winner Match 78
R16,Match 92,Winner Match 79,vs,Winner Match 80
R16,Match 95,Winner Match 86,vs,Winner Match 88
R16,Match 96,Winner Match 85,vs,Winner Match 87
QF,Match 97,Winner Match 89,vs,Winner Match 90
QF,Match 98,Winner Match 93,vs,Winner Match 94
QF,Match 99,Winner Match 91,vs,Winner Match 92
QF,Match 100,Winner Match 95,vs,Winner Match 96
SF,Match 101,Winner Match 97,vs,Winner Match 98
SF,Match 102,Winner Match 99,vs,Winner Match 100
3RD,Match 103,Loser Match 101,vs,Loser Match 102
FINAL,Match 104,Winner Match 101,vs,Winner Match 102`;

        populateTieBreakPresets();
        populateAdvancementPresets();
        updateInputModeUi();
        populateTournamentTeamSelect();
        simCustomOperatorEl.addEventListener('change', () => { 
            if (simCustomOperatorEl.value === 'between') simCustomValue2El.classList.remove('hidden');
            else simCustomValue2El.classList.add('hidden');
        });

        generateTeamCsvButtonEl.addEventListener('click', () => {
            exportTeamCsv(simGroupSelectEl.value, simTeamSelectEl.value, parseFloat(simBookieMarginEl.value), generateTeamCsvErrorEl);
        });

        generateTournamentTeamCsvButtonEl.addEventListener('click', () => {
            const teamName = tournamentTeamSelectEl.value;
            exportTeamCsv(getGroupKeyForTeam(teamName), teamName, parseFloat(tournamentBookieMarginEl.value), generateTournamentTeamCsvErrorEl);
        });

        generateGroupCsvButtonEl.addEventListener('click', () => {
            const groupKey = simGroupSelectEl.value;
            const marginPercent = parseFloat(simBookieMarginEl.value);
            const marginDecimal = marginPercent / 100;

            if (!groupKey) {
                showInlineError(generateGroupCsvErrorEl, 'Please select a group first.');
                return;
            }
            if (isNaN(marginPercent) || marginPercent < 0 || marginPercent > 100) {
                showInlineError(generateGroupCsvErrorEl, 'Please enter a valid margin between 0 and 100.');
                return;
            }
            const groupData = simulationAggStats[groupKey];
            const teams = groupTeamNames[groupKey] || [];
            if (!groupData || teams.length === 0) {
                showInlineError(generateGroupCsvErrorEl, 'No simulation data found for the selected group.');
                return;
            }
            const { date, time } = getCsvExportDateTime();

            const emptyRow = () => ['', '', '', '', '', '', '', '', '', '', '', '', ''];
            const rows = [];
            const addYesNoRow = (market, probability) => {
                const row = [date, time, '', market, '', calculateOddWithMargin(probability, marginDecimal), '', '', '', '', '', '', ''];
                rows.push(buildCsvRow(row));
            };
            const addLineRow = (market, line, values) => {
                const { overProb, underProb } = getLineProbabilities(values, line);
                const row = [date, time, '', market, '', '', '', '', line.toFixed(1), calculateOddWithMargin(underProb, marginDecimal), calculateOddWithMargin(overProb, marginDecimal), '', ''];
                rows.push(buildCsvRow(row));
            };

            let csvContent = buildCsvRow(['Datum', 'Vreme', 'Sifra', 'Domacin', 'Gost', '1', 'X', '2', 'GR', 'U', 'O', 'Yes', 'No']);
            const matchNameRow = emptyRow();
            matchNameRow[0] = 'MATCH_NAME:World Cup 2026';
            csvContent += buildCsvRow(matchNameRow);
            const leagueRow = emptyRow();
            leagueRow[0] = `LEAGUE_NAME:Grupa ${groupKey}`;
            csvContent += buildCsvRow(leagueRow);
            csvContent += buildCsvRow(emptyRow());

            teams.forEach(team => {
                const prob = (groupData[team]?.posCounts?.[0] || 0) / currentNumSims;
                addYesNoRow(`${team} - pobednik grupe`, prob);
            });

            const allSF = Object.entries(groupData.straightForecasts || {}).sort(([, a], [, b]) => b - a);
            allSF.forEach(([key, count]) => {
                const marketName = key.replace('(1st)-', '/').replace('(2nd)', '');
                addYesNoRow(`Tacan redosled 1-2: ${marketName}`, count / currentNumSims);
            });

            const allAD = Object.entries(groupData.advancingDoubles || {}).sort(([, a], [, b]) => b - a);
            allAD.forEach(([key, count]) => {
                addYesNoRow(`Prva dva bilo kojim redom: ${key.replace('&', ' / ')}`, count / currentNumSims);
            });

            addYesNoRow('Bilo koji tim osvaja 9 bodova', (groupData.anyTeam9PtsCount || 0) / currentNumSims);
            addYesNoRow('Bilo koji tim osvaja 0 bodova', (groupData.anyTeam0PtsCount || 0) / currentNumSims);
            addYesNoRow('Treceplasirani tim ide dalje', (groupData.thirdPlaceAdvancesCount || 0) / currentNumSims);

            const totalGoalsLines = buildDynamicHalfPointLines(groupData.groupTotalGoalsSims || [], average(groupData.groupTotalGoalsSims || []));
            ['ukupno golova u grupi (balans)', 'ukupno golova u grupi (+1)', 'ukupno golova u grupi (-1)'].forEach((label, idx) => {
                const line = totalGoalsLines[idx];
                addLineRow(label, line, groupData.groupTotalGoalsSims || []);
            });

            const totalDrawsLine = findBalancedHalfPointLine(groupData.groupTotalDrawsSims || [], average(groupData.groupTotalDrawsSims || []));
            addLineRow('ukupno neresenih meceva u grupi', totalDrawsLine, groupData.groupTotalDrawsSims || []);

            const firstPtsSims = groupData.firstPlacePtsSims || [];
            if (firstPtsSims.length > 0) {
                [4.5, 6.5, 7.5].forEach(line => addLineRow(`broj bodova prvoplasiranog tima${line === 4.5 ? '1' : line === 6.5 ? '2' : '3'}`, line, firstPtsSims));
            }

            const fourthPtsSims = groupData.fourthPlacePtsSims || [];
            if (fourthPtsSims.length > 0) {
                [0.5, 1.5, 2.5].forEach(line => addLineRow(`broj bodova poslednjeplasiranog tima${line === 0.5 ? '1' : line === 1.5 ? '2' : '3'}`, line, fourthPtsSims));
            }

            teams.forEach(team => {
                const probMostGoals = (groupData[team]?.mostGFCount || 0) / currentNumSims;
                addYesNoRow(`${team} - najefikasniji tim u grupi`, probMostGoals);
            });

            csvContent += rows.join('');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            if (link.download !== undefined) { 
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `group_odds_${groupKey}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });

        // --- New Feature: Scenario Lock clear button ---
        clearLocksBtnEl.addEventListener('click', () => {
            lockedScenarios = {};
            scenarioLockTableBodyEl.querySelectorAll('.scenario-lock-score-input').forEach(input => { input.value = ''; });
        });

        // --- New Feature: Export Raw Simulation Data ---
        exportRawDataBtnEl.addEventListener('click', exportRawSimData);

        // --- New Feature: Multi-Group View ---
        showMultiGroupViewBtnEl.addEventListener('click', displayMultiGroupView);

        // --- New Feature: Language Toggle ---
        langToggleBtnEl.addEventListener('click', () => {
            currentLanguage = currentLanguage === 'en' ? 'sr' : 'en';
            const enPill = langToggleBtnEl.querySelector('[data-lang="en"]');
            const srPill = langToggleBtnEl.querySelector('[data-lang="sr"]');
            if (enPill) enPill.className = `lang-pill ${currentLanguage === 'en' ? 'lang-pill-active' : 'lang-pill-inactive'}`;
            if (srPill) srPill.className = `lang-pill ${currentLanguage === 'sr' ? 'lang-pill-active' : 'lang-pill-inactive'}`;
            langToggleBtnEl.title = `Current language: ${currentLanguage.toUpperCase()}. Click to switch.`;
        });
