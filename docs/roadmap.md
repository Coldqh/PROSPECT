# PROSPECT roadmap

- [x] Foundation, PWA and IndexedDB saves
- [x] Athlete creation and origin
- [x] Weekly life loop
- [x] Team world and dynamic depth chart
- [x] Training, development and health
- [x] Offensive and defensive match decisions
- [x] Full high-school regular season
- [x] Relationships, memory and contextual events
- [x] Realistic college recruiting
- [x] Official visits, offers and verbal commitment
- [x] Formal signing and college arrival
- [x] Autonomous football ecosystem core
- [x] Multi-season conferences, transfers and coaching carousel
- [x] World constitution, eligibility and roster compliance
- [x] Finite program resources and institutional economics
- [x] Annual talent pipeline and geographic recruiting classes
- [x] Multi-year roster-planning AI
- [x] Unified recruiting, transfer and coaching labor market
- [x] Tactical identities and scheme-driven roster value
- [x] National competition, rankings and program reputation
- [x] Twenty-season autonomous stability test
- [x] Social ecosystem
- [x] Resume hero gameplay inside the stable world
- [x] Mobile-first editorial interface and unified navigation
- [ ] Interactive college match layer and full multi-year athlete progression

## v0.11 — High school to college

- formal scholarship or preferred walk-on signing after the season;
- no artificial rescue offer when no legitimate option exists;
- graduate semester and offseason simulation;
- seeded college position room;
- comparison between recruiting promises and actual role;
- college orientation and a locked first-year priority;
- automatic migration from schema v10 to v11.

## v0.12 — Ecosystem core

- autonomous regional and college teams;
- persistent background players and coaches;
- weekly development, injuries, depth changes and commitments;
- coaching pressure and staff turnover;
- recruiting needs changed by other players;
- compact World view that reports state changes instead of inventing news;
- automatic migration from schema v11 to v12.


## v0.15 — Finite program resources

- annual football budgets and operating balances;
- finite coaching, recruiting, medical, facilities and academic allocations;
- NIL capacity and committed NIL spending;
- donor confidence, board patience and financial pressure;
- resource-dependent recovery, development, recruiting and coaching movement;
- annual budget rebalance based on results and institutional support;
- deterministic migration from schema v14 to v15.


## v0.16 — Annual talent pipeline

- eight persistent talent regions with different culture, infrastructure, exposure and academic access;
- annual freshman generation for every active high-school program;
- multi-sport and late-bloomer development profiles;
- regional spring combines and summer showcases;
- scouting grades that change when verified information appears;
- unsigned seniors preserved through JUCO and walk-on routes;
- independent prospects can develop, commit and enroll later;
- deterministic migration from schema v15 to v16.


## v0.17 — Multi-year roster planning AI

- three-year position-room projections for every active program;
- projected departures and retention risk;
- target recruiting-class size constrained by roster and scholarship space;
- usage plans: starter, rotation, special teams, developmental and redshirt;
- scholarship awards based on role, performance and available aid;
- position changes when one room is overloaded and another loses depth;
- automatic replanning after transfers, enrollment and coaching changes;
- deterministic migration from schema v16 to v17.


## v0.18 — Unified movement market

- shared roster openings for high-school recruits, JUCO, walk-on and transfer candidates;
- finite scholarships, NIL and recruiting budgets consumed by the same negotiations;
- offers, expiration, acceptance and withdrawal recorded as persistent market objects;
- an experienced transfer can close a position and reopen a displaced school recruit's market;
- coaching vacancies are tracked and staff changes can trigger decommitments and portal entries;
- independent prospects no longer choose destinations outside the common market;
- compact Market tab inside the autonomous World dashboard;
- deterministic migration from schema v17 to v18.


## v0.19 — Tactical identities

- persistent offensive and defensive systems for every program;
- position-specific roles and player archetypes;
- scheme fit affects development, depth-chart value, recruiting and match execution;
- playbook installation, complexity, rotation depth and continuity;
- coaching changes install new systems and reduce short-term execution;
- roster and market AI value players inside specific systems instead of by OVR alone;
- compact Schemes tab inside the World dashboard;
- deterministic migration from schema v18 to v19.


## v0.20 — National competition and program history

- coherent ten-week schedules with conference and nonconference games;
- rivalry games with persistent series history;
- national ranking based on record, strength of schedule, quality wins, road wins and point differential;
- conference championships and an eight-team national playoff;
- bowls for ranked teams outside the playoff;
- weekly, positional, national and All-American awards;
- program legacies with titles, playoff appearances, bowl wins, rivalry wins and historical reputation;
- compact Competition tab inside the World dashboard;
- deterministic migration from schema v19 to v20.


## v0.21 — Twenty-season autonomous stability

- deterministic observer that advances the complete football world through twenty seasons;
- invariant audit for duplicate ids, broken references, roster and staff membership, conference coverage, compliance limits, numeric ranges and bounded histories;
- seasonal snapshots for population, roster sizes, rankings, champions, financial pressure, transfers and coaching movement;
- competition results now change head-coach security, pressure and hot-seat status;
- coaching carousel protects open programs, prevents repeat hires and restores the exact vacated staff role with unique ids;
- final offseason depth repair keeps every college roster above its minimum playable floor after market movement;
- twenty national champions, persistent program legacies and autonomous labor markets verified without structural drift;
- no save migration required because schema v20 remains structurally compatible.


## v0.22 — Social ecosystem

- persistent player-player, coach-player and staff relationships;
- trust, respect, chemistry, tension, influence and shared history;
- team culture with cohesion, accountability, coach trust, leadership, conflict, morale and stability;
- mentorship, position rivalry, locker-room conflict, reconciliation, staff friction and broken promises;
- social support changes development and weekly form;
- fractured rooms increase portal pressure and reduce match execution;
- bonds survive transfers and coaching changes as inactive social history;
- compact People tab and locker-room breakdown for every program;
- social invariants included in the twenty-season observer;
- deterministic migration from schema v20 to v21.

## v0.23 — Hero inside the stable world

- college orientation now activates a persistent freshman season inside the autonomous ecosystem;
- the hero occupies a real program roster slot and a real position-room depth rank;
- daily life and training update practice reps, coach trust, locker-room standing, health, form and ratings;
- weekly roles become starter, rotation, special teams or developmental from actual world state;
- completed national-schedule games create hero game logs with snaps, starts, grades and results;
- playing-time promises are checked against real roles and accumulated snaps;
- coach meetings, position rivalries and transfer pressure generate blocking career decisions;
- portal requests update the hero, world transactions and persistent history;
- compact Week, Depth, People and Season views replace the temporary end-of-demo state;
- deterministic migration from schema v21 to v22.


## v0.24 — Editorial career interface

- one navigation system for high school and college: Today, Career and World;
- contextual match, team and profile surfaces instead of permanent top-level tabs;
- compact player identity bar and one dominant action per mobile screen;
- editorial world feed, quick search and contextual exploration instead of eleven visible tabs;
- responsive career library and player creator for phone, tablet and desktop;
- shared visual tokens for surfaces, typography, spacing, radii, shadows, controls and motion;
- loading skeletons, empty states, errors, success feedback, disabled and selected states;
- keyboard focus trap, Escape handling and focus restoration for bottom sheets;
- reduced-motion support and touch targets designed around iPhone 14 Pro;
- no save migration required because game state and domain logic remain unchanged.


## v0.24.1 — Mobile cascade repair

- legacy and redesign styles are isolated in explicit cascade layers;
- iPhone creator uses a single-step flow instead of a full vertical navigation panel;
- mobile header, identity bar, week strip and bottom navigation are compressed;
- Today prioritizes condition, training, schedule and one action;
- World prioritizes stories and hides zero-value market cards;
- no save migration required.
