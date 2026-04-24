export function resolveBracketReferenceCandidates(ref, context) {
    const {
        groupStandings,
        thirdQualifiedByGroup,
        thirdRankedList,
        knockoutWinners,
        knockoutLosers
    } = context;
    const cleaned = String(ref || '').trim();
    const winnerGroupMatch = cleaned.match(/^Winner Group\s+([A-Za-z0-9]+)$/i);
    if (winnerGroupMatch) {
        const team = groupStandings[winnerGroupMatch[1]]?.[0]?.name;
        return team ? [team] : [];
    }
    const runnerUpGroupMatch = cleaned.match(/^Runner-up Group\s+([A-Za-z0-9]+)$/i);
    if (runnerUpGroupMatch) {
        const team = groupStandings[runnerUpGroupMatch[1]]?.[1]?.name;
        return team ? [team] : [];
    }
    const thirdGroupMatch = cleaned.match(/^3rd Group\s+(.+)$/i);
    if (thirdGroupMatch) {
        const groups = thirdGroupMatch[1].split('/').map(g => g.trim()).filter(Boolean);
        return thirdRankedList
            .filter(team => groups.includes(team.group) && thirdQualifiedByGroup.has(team.group))
            .map(team => team.name);
    }
    const winnerMatchRef = cleaned.match(/^Winner Match\s+(\d+)$/i);
    if (winnerMatchRef) {
        const winner = knockoutWinners[parseInt(winnerMatchRef[1], 10)];
        return winner ? [winner] : [];
    }
    const loserMatchRef = cleaned.match(/^Loser Match\s+(\d+)$/i);
    if (loserMatchRef) {
        const loser = knockoutLosers[parseInt(loserMatchRef[1], 10)];
        return loser ? [loser] : [];
    }
    return cleaned ? [cleaned] : [];
}

function assignRoundParticipants(matches, context) {
    const candidateByMatch = matches.map(match => ({
        match,
        teamAOptions: resolveBracketReferenceCandidates(match.sideARef, context),
        teamBOptions: resolveBracketReferenceCandidates(match.sideBRef, context)
    }));

    if (candidateByMatch.some(entry => entry.teamAOptions.length === 0 || entry.teamBOptions.length === 0)) {
        return null;
    }

    candidateByMatch.sort((a, b) => {
        const sizeA = a.teamAOptions.length * a.teamBOptions.length;
        const sizeB = b.teamAOptions.length * b.teamBOptions.length;
        if (sizeA !== sizeB) return sizeA - sizeB;
        return a.match.matchNum - b.match.matchNum;
    });

    const usedTeams = new Set();
    const assignments = [];

    function backtrack(index) {
        if (index >= candidateByMatch.length) return true;

        const entry = candidateByMatch[index];
        for (const teamA of entry.teamAOptions) {
            if (usedTeams.has(teamA)) continue;
            usedTeams.add(teamA);

            for (const teamB of entry.teamBOptions) {
                if (teamA === teamB || usedTeams.has(teamB)) continue;
                usedTeams.add(teamB);
                assignments.push({ match: entry.match, teamA, teamB });
                if (backtrack(index + 1)) return true;
                assignments.pop();
                usedTeams.delete(teamB);
            }

            usedTeams.delete(teamA);
        }

        return false;
    }

    return backtrack(0) ? assignments.sort((a, b) => a.match.matchNum - b.match.matchNum) : null;
}

export function runKnockoutStage({
    parsedBracketMatches,
    aggStats,
    groupStandings,
    thirdRankedList,
    simTournamentTotals,
    simulateKnockoutMatch,
    incrementRoundReach,
    recordMatchupInPath
}) {
    if (!parsedBracketMatches.length) return;
    const roundOrder = { R32: 1, R16: 2, QF: 3, SF: 4, '3RD': 5, FINAL: 6 };
    const knockoutWinners = {};
    const knockoutLosers = {};
    const thirdQualifiedByGroup = new Set(thirdRankedList.map(t => t.group));

    Object.entries(roundOrder)
        .sort(([, orderA], [, orderB]) => orderA - orderB)
        .forEach(([round]) => {
            const roundMatches = parsedBracketMatches
                .filter(match => match.round === round)
                .sort((a, b) => a.matchNum - b.matchNum);
            if (roundMatches.length === 0) return;

            const assignments = assignRoundParticipants(roundMatches, {
                groupStandings,
                thirdQualifiedByGroup,
                thirdRankedList,
                knockoutWinners,
                knockoutLosers
            });
            if (!assignments) return;

            assignments.forEach(({ match, teamA, teamB }) => {
                incrementRoundReach(aggStats, teamA, match.round);
                incrementRoundReach(aggStats, teamB, match.round);
                if (recordMatchupInPath) recordMatchupInPath(aggStats, teamA, teamB, match.round);

                const { winner, loser, goalsA, goalsB } = simulateKnockoutMatch(teamA, teamB);
                if (simTournamentTotals[teamA]) {
                    simTournamentTotals[teamA].gf += goalsA;
                    simTournamentTotals[teamA].ga += goalsB;
                    simTournamentTotals[teamA].games += 1;
                }
                if (simTournamentTotals[teamB]) {
                    simTournamentTotals[teamB].gf += goalsB;
                    simTournamentTotals[teamB].ga += goalsA;
                    simTournamentTotals[teamB].games += 1;
                }
                knockoutWinners[match.matchNum] = winner;
                knockoutLosers[match.matchNum] = loser;

                const loserStats = aggStats._knockout?.teamProgress?.[loser];
                if (loserStats) {
                    if (match.round === 'R32') loserStats.eliminateR32++;
                    if (match.round === 'R16') loserStats.eliminateR16++;
                    if (match.round === 'QF') loserStats.eliminateQF++;
                    if (match.round === 'SF') loserStats.eliminateSF++;
                    if (match.round === 'FINAL') loserStats.runnerUpCount++;
                }
                if (match.round === '3RD' && aggStats._knockout?.teamProgress?.[winner]) {
                    aggStats._knockout.teamProgress[winner].thirdPlaceCount++;
                }
                if (match.round === 'FINAL' && aggStats._knockout?.teamProgress?.[winner]) {
                    aggStats._knockout.teamProgress[winner].winFINAL++;
                }
            });
        });
}
