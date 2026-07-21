# 0004 — Black/red identity and persistent team world

## Decision

PROSPECT uses black as the base interface color and restrained crimson red as the only primary accent. Team-generated colors no longer control whole screens.

The football team is persisted inside the career save instead of being regenerated on every render. React only displays roster and staff state. Depth-chart evaluation lives in the football simulation layer.

## Mobile structure

The Team section is split into four focused views:

- Summary;
- Depth;
- Roster;
- Staff.

Long rosters and position rooms remain vertically scrollable while the primary view stays compact.
