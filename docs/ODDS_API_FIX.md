# CSV-Based Match Odds Setup

## Overview

The simulator now uses a **CSV-first approach** for match odds data:

1. **Match Odds**: Loaded from your CSV file (not fetched from API)
2. **Tournament Winner Odds**: Fetched from The Odds API for calibration calculations
3. **Groups**: Determined directly from the GROUP column in your CSV file

This approach is simpler, more reliable, and gives you full control over your match data.

## CSV Format

Your match odds CSV should use this format:

```csv
GROUP;TEAM_A;TEAM_B;ODD1;ODDX;ODD2;ODD_UNDER;ODD_OVER
A;Mexico;vs;South Africa;1.56;4.33;6.4;1.91;1.91
A;South Korea;vs;Czech Republic;2.6;3.11;2.61;1.62;2.18
B;Canada;vs;Bosnia & Herzegovina;1.86;3.55;3.72;1.65;2.13
...
```

**Format details:**
- **Delimiter**: Semicolon (`;`) or comma (`,`)
- **GROUP**: Single letter (A, B, C, etc.) in column 1
- **TEAM_A**: Home team name
- **vs**: Optional separator (can be omitted)
- **TEAM_B**: Away team name
- **ODD1**: Home win odds (decimal format, e.g., 2.5)
- **ODDX**: Draw odds
- **ODD2**: Away win odds
- **ODD_UNDER**: Under 2.5 goals odds
- **ODD_OVER**: Over 2.5 goals odds

**Important notes:**
- All odds must be in **decimal format** (not American or fractional)
- All odds must be **> 1.0**
- Each group should have **exactly 6 matches** (4 teams playing each other once)
- Each group should have **exactly 4 teams**

## How to Use

### Step 1: Prepare Your CSV File

1. Create a CSV file with all 72 group stage matches (12 groups × 6 matches)
2. Assign each match to the correct group (A through L)
3. Use the format shown above
4. Save as `.csv` file

**Example**: See `sample_match_odds.csv` for reference

### Step 2: Load Match Odds from CSV

1. Select **"Manual (CSV)"** or **"Hybrid"** input mode
2. Click **"Choose File"** and select your CSV file
3. Click **"Parse & Validate Data"**
4. Check for warnings about group sizes or match counts

### Step 3: Fetch Tournament Winner Odds (Optional)

1. Enter your Odds API key at the top
2. Click **"Fetch Tournament Winner Odds"**
3. This fetches outrights data used for rating calibration
4. Match odds from CSV remain unchanged

### Step 4: Run Simulation

1. Configure simulation settings
2. Click **"Run Simulation"**
3. View results by group and team

## Benefits of CSV-First Approach

✅ **Full Control**: You decide which matches and odds to include
✅ **No API Limitations**: No rate limits, no incomplete data issues
✅ **Consistent Groups**: Groups are exactly as you define them in the CSV
✅ **Historical Data**: Use odds from any time period, not just current
✅ **Custom Scenarios**: Test different odds scenarios easily

## Validation

After parsing, the system will validate:

- ✅ Each group has exactly 4 teams
- ✅ Each group has exactly 6 matches
- ✅ All odds are valid (decimal format, > 1.0)
- ✅ No duplicate matches within a group

**Warning messages:**
- `Gr X: N teams (exp 4)` - Group has wrong number of teams
- `Gr X: N matches (exp 6)` - Group has wrong number of matches
- `L{line}: xG solver did not converge` - Odds may be inconsistent (rare)

## Tournament Winner Odds

The "Fetch Tournament Winner Odds" button:

- **Does fetch**: Tournament winner outrights (soccer_fifa_world_cup_winner market)
- **Does NOT fetch**: Match odds (those come from your CSV)
- **Purpose**: Used to calibrate team power ratings to market expectations
- **Optional**: You can skip this if you don't need calibration

## Troubleshooting

**Q: Groups show wrong number of teams**
A: Check your CSV - make sure each team appears in exactly 3 matches per group

**Q: "xG solver did not converge" warnings**
A: Your odds may be slightly inconsistent (sum to >110% vig). Results are still usable but may be less accurate.

**Q: Some matches are skipped**
A: Check that all 5 odds columns are present and > 1.0

**Q: I want to use API odds instead**
A: The API odds fetching has been disabled to simplify the workflow. Use CSV files for match odds.

## Files Modified

- **app.js**: Removed match odds API fetching, kept only tournament winner odds
- **index.html**: Updated button text to "Fetch Tournament Winner Odds"
- **ODDS_API_FIX.md**: Updated documentation (this file)

Previous API-based filtering code remains in the codebase but is no longer used:
- `modules/data/matchFilter.js` - Match filtering logic
- `modules/api/fifaCodeMapping.js` - FIFA code mappings
- `modules/api/oddsExtractor.js` - Odds extraction from API

---

**Status:** ✅ Simplified - CSV-first approach active
**Last Updated:** 2026-04-24
