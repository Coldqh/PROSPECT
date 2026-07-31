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
- [x] Interactive college match layer and full multi-year athlete progression
- [x] Professional draft, contracts and pro football ecosystem
- [x] Autonomous professional league, salary cap, free agency and interactive pro seasons
- [x] Living professional week, injuries, dynamic depth chart and trade deadline
- [x] Seamless autopilot takeover with snap-result overlay
- [x] Persistent player identity from high school through professional retirement
- [x] Usage plans, target share and open-window QB logic
- [x] Core consolidation: sliced saves, dynamic participation and unified career navigation

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


## v0.25 — Interactive college career and multi-year progression

- role-dependent interactive college matches use the existing offense and defense decision engine;
- a completed interactive game overrides the autonomous result of the exact national-schedule fixture;
- match stats, spotlight, snaps, starts and coach grade persist in the hero game log;
- every completed college year is archived with team record, role, grade, OVR change, redshirt and awards;
- class year, eligibility and career totals continue across seasons;
- redshirt consumes no legacy competition season when the game limit is respected;
- portal entry creates concrete destination offers based on position need, depth, scheme fit and scholarship capacity;
- selecting a destination moves the hero between real rosters and deactivates old locker-room bonds;
- deterministic migration from schema v22 to v23.


## v0.26 — Professional draft and training camp

- the athlete can return to college while eligibility remains or submit an irreversible draft declaration;
- sixteen persistent professional clubs carry records, roster strength, cap space and position-specific needs;
- agents trade commission and risk for negotiation skill, media reach and direct team access;
- Combine and Pro Day produce athletic, technical, medical and interview results that move draft stock;
- the draft class combines graduating ecosystem players with a deterministic national prospect pool;
- seven rounds and 112 picks run autonomously, including traded selections and roster-need updates after every pick;
- falling below the draft line opens a real undrafted free-agent market instead of a rescue selection;
- draft slot or UDFA demand creates a rookie contract and concrete training-camp opportunity;
- four camp sessions determine active roster, practice squad or release from actual performance, health and coach trust;
- deterministic migration from schema v23 to v24.


## v0.27 — Compact career hierarchy

- primary navigation contains Profile, Home and Team;
- season, matches, standings, overview, recruiting, feed and rankings open from one drawer;
- player statistics and blocking decisions live in Profile;
- every team opens as a full page with roster, staff, system and resources;
- World contains only event feed, rankings and search;
- recruiting contains programs, offers, visits and activity on one page;
- career saves use compact rows with player, team, season, OVR, continue and delete actions;
- player creation and training choices show numeric skill effects instead of descriptive copy;
- career-index metadata is repaired automatically without changing save schema.


## v0.28 — Mobile visual system

- Inter is the only application font;
- page, section, body, caption and numeric text use one fixed scale;
- mobile content uses a 20 px gutter and a 4 px spacing grid;
- ordinary cards are capped at 16 px radius;
- decorative nested surfaces are flattened;
- borders are limited to structural separators;
- the career library, creator, Home, Profile, Team and World use denser layouts;
- secondary pages clear the active state in the primary navigation;
- no game state or save migration changes.

## v0.29 — Elite football interface

- единая чёрно-красная визуальная система для iPhone 14 Pro;
- профиль игрока с одним главным визуалом, рейтингами, статистикой и состоянием;
- полноценный профиль команды с рейтингами, штабом, лидерами, календарём и таблицами;
- отдельная социальная страница с контактами, отношениями и событиями;
- матчевый интерфейс с табло, ситуацией, вариантами решения, полем и журналом розыгрышей;
- драфтовый интерфейс с карточкой кандидата, Combine, Big Board и лагерем;
- портрет героя не повторяется на командных, социальных и домашних экранах;
- игровая логика и данные не изменены.

## v0.30 — UI architecture cleanup

- шесть одновременно подключённых версионных CSS-слоёв заменены модулями по ответственности;
- старые `legacy`, `redesign`, `refinement`, `game`, `visual-system-v2` и `elite-ui` больше не участвуют в каскаде;
- мобильный shell, header, нижняя навигация и safe-area используют одну симметричную геометрию;
- контент на 390 и 393 px начинается на 20 px и заканчивается за 20 px до правого края;
- типографика ограничена одним Inter и общей шкалой без текста меньше caption-размера;
- дублирующиеся селекторы и свойства удалены вместо перекрытия новыми правилами;
- стили профиля, команды, социальных связей, матча и драфта разделены и не пересекаются;
- добавлена автоматическая проверка UI-архитектуры, размеров файлов, навигации и горизонтального переполнения;
- drawer получил focus trap, Escape, восстановление фокуса и блокировку фоновой прокрутки;
- короткие анимации используются для входа страниц, карточек, шкал, drawer, sheet и маршрутов;
- игровая логика и схема сохранений не изменены.

## v0.39 — Autonomous professional league

- sixteen persistent clubs with active 53-player rosters and separate practice-squad contracts;
- salary cap, payroll, dead cap and available cap space recalculated after every personnel move;
- autonomous free agency driven by position need, player quality and available cap space;
- deterministic fifteen-week round robin with 120 regular-season games;
- conference seeding, wild card, conference finals and championship game;
- interactive professional games use the same real-time football kernel as school and college;
- professional depth chart, coach trust, role, starts, snaps, game logs and standings persist across the season;
- offseason ages players, expires contracts, creates rookies, resolves free agency and starts the next 120-game season;
- practice-squad development can lead to promotion with a corresponding active-roster release;
- released heroes receive concrete one-year free-agent offers instead of reaching a dead end;
- deterministic migration from schema v27 to v28.

## v0.40 — Living pro career and player control

- weekly professional preparation with playbook, technique, recovery and competition focuses;
- readiness, coach trust, health and depth rank react to preparation;
- active, questionable, out and injured-reserve availability;
- autonomous replacement signings, return-from-IR cuts and week-eight trades;
- seamless automatic assignments with instant joystick takeover and automatic resume on release;
- explicit snap-result dialog before the next play;
- lower interception rates in both statistical and physical pass resolution;
- redesigned football loading screen;
- deterministic migration from schema v28 to v29.
## v0.41 — Persistent player lifecycle and seamless control

- automatic assignment movement is always active until the player provides movement input;
- releasing the joystick returns control to AI from the current position;
- persistent career registry preserves one identity through school, college, transfer, draft, pro teams and retirement;
- real college graduates form every professional draft class;
- drafted players enter the selecting club roster and undrafted players enter free agency;
- school and college seasons continue in the background during the hero professional career;
- World career archive exposes stage, team history, draft data and career events;
- deterministic migration from schema v29 to v30.


## v0.46 — Core consolidation

- content-addressed world slices and compact career snapshots;
- full current-schema validation before persistence;
- dynamic participation from personnel, role, fatigue, quarter and score;
- real fourth-down opportunities for kickers and punters;
- one career shell and four primary destinations across all stages;
- season, schedule and standings consolidated into one workspace;
- professional career header no longer remains in draft mode;
- inactive professional weeks cannot deadlock;
- save schema 33, IndexedDB schema 2.

## v0.47 — World history and emergent stories

- immutable facts sourced from real simulation stories and transactions;
- autonomous seasonal objectives for programs, head coaches and notable players;
- persistent player-rise, career-crossroads, coach-tenure, team-run, rivalry and rebuild arcs;
- milestone storyline entries generated only from accumulated facts;
- visible active arcs in the World feed;
- schema 34 migration and module 13 ecosystem upgrade;
- hard history bounds and 20-season invariant coverage.

## v0.48 — Autonomous agency and consequences

- persistent player, team and coach conflicts driven by role, trust, scheme fit, results and finances;
- concern, meeting, ultimatum and resolved stages with deterministic escalation;
- real role changes, portal entries, roster-plan resets, tactical shifts and staff reshuffles;
- hero protection from automatic irreversible transfer decisions;
- conflict cooldowns, unique identities and bounded decision history;
- active conflicts and recent decisions in the World feed;
- schema 35 migration and module 14 ecosystem upgrade;
- three-season and twenty-season invariant coverage.
## v0.49 — Simulation quality and system repair

- social incidents use participant, team and incident-type cooldowns;
- conflict eruptions release tension instead of recursively creating more conflict pressure;
- player agency requires real merit, career leverage and position-room context;
- role reviews preserve contiguous unique depth ranks and aligned usage plans;
- one actor can open only one conflict per season;
- agency stories and transactions coalesce into one immutable world fact;
- long-run audits detect depth gaps, repeated incidents, semantic fact duplicates and actor-season conflict duplicates;
- schema 35 and ecosystem module 14 remain unchanged.
## v0.50 — Interface comprehension rebuild

- one recruiting board with persistent selected-program context;
- explicit status, role path, reason for interest and next contact for every program;
- weekly market digest, player movement table and concrete roster openings;
- College season center with featured game, ranking movement, conference races and real stories;
- PRO season center with featured game, conference playoff picture, transactions and power table;
- raw interface codes replaced by football language;
- no domain-state or save-schema changes.

## v0.51 — Sports operations visual rebuild

- fixed desktop operations rail and expanded manager workspace;
- team-branded recruiting rows, market needs and league tables;
- high-contrast editorial weekly digest and featured-game presentation;
- scoreboard mastheads for recruiting, market, College and PRO context;
- flat dense tables instead of repeated rounded card stacks;
- responsive mobile fallback using the same information architecture;
- no save migration or domain-system changes.

## v0.52 — F1 Dynasty style replacement

- delete the complete pre-0.52 visual cascade instead of layering another override;
- one light browser-manager shell with dark masthead and persistent primary navigation;
- compact square work surfaces, dense lists and sports-management tables;
- migrate recruiting, market, league, career, team, season, social, world, draft and match screens;
- preserve the 0.50 information architecture and all domain state;
- enforce absence of retired styles through release and UI checks;
- no save migration or simulation changes.

## v0.53 — Reference screen replacement

- remove the old React compositions from season home, team and player profile;
- introduce dark layered management surfaces and team-colored mastheads;
- use large OVR shields, player cards, role/status pills and semantic progress bars;
- rebuild roster browsing around position rooms with readable depth and role context;
- keep mobile and desktop on the same component hierarchy;
- prohibit the retired screen class names through automated UI checks;
- no save migration or domain-system changes.
