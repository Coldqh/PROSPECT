# High school season

Version: 0.7.0

The school season is generated once from the career world seed.

## Stored state

- eight scheduled games;
- stable opponent identities and scouting profiles;
- regional standings;
- hero season totals;
- weekly awards;
- completed match history;
- current and next opponent.

## Simulation cadence

- the hero match is resolved through the match decision engine;
- other regional games are simulated when the hero match ends;
- standings and streaks are updated as one deterministic transaction;
- the next match is materialized after the weekly calendar returns to Monday.

## UI

The Career section is split into Season, Matches, Standings, Stats and History. Scouting details and team leaders use bottom sheets to keep the core mobile view compact.
