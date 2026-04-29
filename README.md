# Football Competition Betting Simulator

A browser-based group stage and knockout simulator for football tournaments (built for the 2026 FIFA World Cup). Runs Dixon-Coles Monte Carlo simulations and exports bookmaker-formatted CSV files ready for import into betting software.

---

## Features

- **Dixon-Coles simulation** — per-match attack/defense ratings with correlation correction (rho)
- **Group stage** — standings, tiebreakers, third-place advancement logic
- **Knockout stage** — full bracket simulation with extra time and penalties
- **Scenario locking** — fix a match score and simulate around it
- **CSV export** — bookmaker-format output (Mozzart Bet 13-column layout) for:
  - Individual team markets
  - Per-group markets
  - Global tournament markets (Specijal, Grupa pobednika, Finalisti)
- **Admin panel** — fetch live odds from The Odds API and pair with group assignments from Wikipedia
- **Language toggle** — EN / SR (Serbian) interface labels
- **Multi-group view** — compare all groups side by side
- **Lambda view** — inspect computed attack/defense ratings per team

---

## Getting Started

No build step required. Open `index.html` in a browser (served via a local HTTP server — required for ES module imports).

```bash
# Example using Python
python -m http.server 8080
# Then open http://localhost:8080
```

---

## Workflow

### 1. Prepare match odds data

**Option A — Admin Panel (live data)**
1. Open `admin.html`
2. Fetch the Wikipedia 2026 WC schedule (group assignments)
3. Enter your [The Odds API](https://the-odds-api.com) key and fetch match odds
4. Click **Auto-Pair Matches with Groups** → **Use in Simulator**

**Option B — Manual CSV paste**

Paste tab- or semicolon-delimited lines into the match data textarea:

```
group   home            away            1      X      2      value  under  over
A       Mexico          South Africa    1.56   4.33   6.40   2.5    1.91   1.91
A       Mexico          South Korea     1.97   3.65   3.75   2.5    1.85   1.95
```

Columns: `group | home | away | home_odds | draw_odds | away_odds | goals_line | under | over`

### 2. Run the simulation

Select the number of simulations (default 10,000) and click **Run Simulation**.

### 3. Export CSV

Three export buttons become active after simulation:

| Button | Output |
|---|---|
| **Generate Team CSV** | Per-team markets (tournament winner, knockout progression) |
| **Generate Group CSV** | Per-group markets (winner, standings, goals, draws, 3+ goals, 0:0, GG) |
| **Generate Global Tournament CSV** | Specijal + Grupa pobednika + Finalisti top 200 |

---

## CSV Output Format

All exports use the 13-column bookmaker format:

```
Datum | Vreme | Sifra | Domacin | Gost | 1 | X | 2 | GR | U | O | Yes | No
```

- **Yes/No markets** — odds written to column `1` (index 5)
- **Line markets** — line in `GR` (index 8), under in `U` (index 9), over in `O` (index 10)
- **MATCH_NAME / LEAGUE_NAME** rows mark section headers

---

## Project Structure

```
├── index.html                  Main simulator UI
├── admin.html                  Odds fetching and pairing panel
├── app.js                      Simulation engine, UI logic, CSV exports
├── admin.js                    Admin panel logic
├── styles.css                  Shared styles (Tailwind + custom)
│
├── modules/
│   ├── api/
│   │   ├── oddsExtractor.js    Pinnacle-first odds extraction
│   │   ├── scheduleLoader.js   Official schedule fetching
│   │   └── teamNameMapping.js  Team name normalization
│   ├── data/
│   │   ├── matchOddsProcessor.js   Match odds → CSV pipeline
│   │   ├── matchFilter.js          Group stage match filtering
│   │   └── groupDetection.js       BFS graph-based group detection
│   ├── ui/
│   │   ├── teamMapper.js       Interactive team-to-group assignment UI
│   │   └── statusRenderer.js   Status bars and inline error display
│   ├── knockoutStage.js        Bracket simulation (ET + penalties)
│   ├── knockoutStats.js        Knockout stats aggregation
│   └── uiTabs.js               Tab navigation
│
└── utils/
    ├── csvParser.js            CSV parsing and row building
    ├── storage.js              localStorage wrappers
    └── html.js                 Component-based HTML generation
```

---

## Admin Panel

See [docs/ADMIN_PANEL.md](docs/ADMIN_PANEL.md) for full documentation on fetching live odds and pairing with group data.

**APIs used:**
- [The Odds API](https://the-odds-api.com) — match odds (h2h + totals markets)
- Wikipedia API — 2026 FIFA World Cup group assignments

---

## Technical Notes

- Pure ES modules — no bundler, no framework
- Dixon-Coles CDFs are precomputed once per match and cached (`dcCDFCache`)
- All simulation state lives in `simulationAggStats` inside `app.js`
- Modules are stateless; global state is passed explicitly
- Margin conversion: `odd = 1 / (probability × (1 + margin))`
