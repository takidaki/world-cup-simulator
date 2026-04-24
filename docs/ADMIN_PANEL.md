# Admin Panel - World Cup Simulator

## Overview

The Admin Panel is a separate tool for building match odds CSV data by fetching and combining data from two sources:
1. **Wikipedia** - Official 2026 FIFA World Cup group assignments
2. **The Odds API** - Live match odds data

## How to Access

Click **"Admin Panel"** in the header of the main simulator page, or go directly to `admin.html`.

## Workflow

### Step 1: Fetch Data from Sources

#### A. Fetch Wikipedia Schedule
1. Click **"Fetch Wikipedia Schedule"** button
2. The system scrapes the 2026 FIFA World Cup Wikipedia page
3. Parses group tables to extract team-to-group assignments
4. Displays 12 groups (A-L) with 4 teams each

**What it fetches:**
- Group A: Mexico, South Africa, South Korea, Czech Republic
- Group B: Canada, Bosnia and Herzegovina, Qatar, Switzerland
- (etc. for all 12 groups)

#### B. Fetch Match Odds
1. Enter your Odds API key
2. Click **"Fetch Match Odds"** button
3. The system fetches all World Cup match odds from The Odds API
4. Shows list of matches with available bookmaker data

**What it fetches:**
- Match: Home Team vs Away Team
- Markets: h2h (home/draw/away odds) + totals (over/under odds)
- Bookmakers: Pinnacle (preferred) or average from all

### Step 2: Match & Pair Data

Once both data sources are loaded, the **pairing panel** becomes active.

Click **"Auto-Pair Matches with Groups"** to:
1. Match API team names with Wikipedia team names (fuzzy matching)
2. Filter matches to only include those where **both teams are in the same group**
3. Extract odds from bookmaker data (Pinnacle first, then fallback to average)
4. Generate a pairing of: `Group + Match + Odds`

**Matching Logic:**
- Normalize team names (lowercase, remove spaces)
- Only keep matches where `homeGroup === awayGroup`
- This eliminates knockout/playoff matches that would create wrong group assignments

### Step 3: Generate CSV Output

The system generates a CSV file in the format:

```
GROUP;TEAM_A;vs;TEAM_B;ODD1;ODDX;ODD2;ODD_UNDER;ODD_OVER
```

**Example:**
```
A;Mexico;vs;South Africa;1.56;4.33;6.4;1.91;1.91
A;Mexico;vs;South Korea;1.97;3.65;3.75;1.85;1.95
B;Canada;vs;Bosnia & Herzegovina;1.86;3.55;3.72;1.65;2.13
```

**Actions available:**
1. **Copy to Clipboard** - Copy CSV data for manual pasting
2. **Download CSV** - Download as `world_cup_2026_odds.csv` file
3. **Use in Simulator** - Saves to localStorage and redirects to main simulator with data pre-loaded

## Features

### ✅ Automatic Team Matching
- Fuzzy matching handles name variations
- Case-insensitive comparison
- Ignores spaces (e.g., "Bosnia and Herzegovina" = "Bosnia&Herzegovina")

### ✅ Group Validation
- Only matches where both teams are in the same group
- Prevents knockout matches from contaminating group data
- Ensures each group has exactly 4 teams

### ✅ Odds Extraction
- Pinnacle odds preferred (most accurate)
- Falls back to first available bookmaker if Pinnacle unavailable
- Requires both h2h and totals markets

### ✅ Debug Logging
- Expandable debug panel at the bottom
- Shows all operations with timestamps
- Useful for troubleshooting matching issues

## Troubleshooting

### "No matches could be paired"
**Cause:** Team names from API don't match Wikipedia names

**Solution:**
- Check the debug log to see which teams failed to match
- May need to add team name variations to the matching logic

### "API error: 401"
**Cause:** Invalid or expired API key

**Solution:**
- Get a new API key from https://the-odds-api.com
- Check that the key is entered correctly

### "Could not parse group data from Wikipedia"
**Cause:** Wikipedia page structure changed

**Solution:**
- Wikipedia HTML parsing may need updating
- Check the debug log for parsing errors
- May need to manually update the group extraction logic

## Technical Details

### Files
- **admin.html** - Admin panel UI
- **admin.js** - Fetching, pairing, and CSV generation logic
- **styles.css** - Shared styles with main simulator

### APIs Used
1. **Wikipedia API**
   - Endpoint: `https://en.wikipedia.org/w/api.php`
   - Page: `2026_FIFA_World_Cup`
   - Format: HTML parsing of group tables

2. **The Odds API**
   - Endpoint: `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/`
   - Markets: `h2h,totals`
   - Format: `decimal`

### Data Flow
```
Wikipedia → Groups (A-L with team names)
     ↓
The Odds API → Matches (team pairs with odds)
     ↓
Pairing Logic → Filter by group + Extract odds
     ↓
CSV Generator → GROUP;TEAM_A;vs;TEAM_B;ODD1;ODDX;ODD2;UNDER;OVER
     ↓
Main Simulator → Parse and run simulations
```

## Future Improvements

Potential enhancements:
- ✅ Manual team name mapping override
- ✅ Edit individual odds before export
- ✅ Preview grouped matches before CSV generation
- ✅ Multiple bookmaker selection (not just Pinnacle)
- ✅ Save/load pairing configurations

---

**Status:** ✅ Fully functional
**Created:** 2026-04-24
**Location:** `admin.html` + `admin.js`
