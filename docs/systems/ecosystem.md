# Autonomous football ecosystem

Version 0.12 shifts PROSPECT from a hero-centred career panel to an autonomous sports world.

## Active world

A career now stores a deterministic active ecosystem containing:

- the complete regional high-school field;
- all 24 recruiting college programs;
- more than one hundred materialized key players;
- head coaches and coordinators;
- team records, trends and positional needs;
- a live recruiting market;
- persistent world stories generated from actual state changes.

The same career seed always produces the same initial people and organizations.

## Autonomous simulation

Every completed game day advances the active world. Background players recover, lose form, develop and suffer injuries without waiting for the hero. Once per week the simulation also resolves:

- depth-chart movement;
- college results and program momentum;
- coaching pressure and possible staff changes;
- commitments by other high-school seniors;
- positional need changes across college programs.

## Direct effects on the hero

The ecosystem is not a separate news feed. Its changes alter the hero's career state:

- another recruit can occupy the same future position;
- a commitment reduces a program's positional need;
- depth competition changes as college rooms fill;
- coach instability lowers staff trust and role clarity;
- injuries and staff movement reshape opportunities.

The recruiting module reads these updated values during its normal evaluation cycle.

## Information design

The World screen exposes only meaningful consequences:

- a short digest of what changed without the hero;
- important state-derived stories;
- same-position recruiting rivals;
- programs with real positional need;
- coaches under pressure.

The world state creates the events. The interface only reports them.

## Связь с игровым полем

Экосистема не существует отдельно от карьеры героя:

- форма, здоровье и развитие игроков школы синхронизируются с реальным roster;
- автономный depth chart влияет на ближайшего конкурента и роль героя;
- сила соперников пересчитывается по доступным стартерам и глубине состава;
- обновлённый рейтинг попадает в расписание и используется матчевым движком;
- коммиты других рекрутов уменьшают потребность колледжа и повышают конкуренцию;
- смена тренера снижает надёжность обещаний и ясность будущей роли.

## Continuity layer — version 0.13

The ecosystem no longer resets after a single recruiting cycle.

### Conferences and coherent competition

The 24 college programs are divided into four persistent fictional conferences. Programs now play actual opponents from their own conference. Every recorded win belongs to one team and every recorded loss belongs to another. Conference standings, postseason champions and final program records are archived by season.

### Roster movement

At the end of a season:

- graduating seniors leave their programs;
- committed recruits enroll and occupy real roster places;
- buried college players may enter the transfer portal;
- transfer destinations are selected from programs with a positional need and available depth-chart space;
- incoming and outgoing movement changes team strength and future recruiting demand.

### Coaching carousel

A fired head coach is no longer replaced by a renamed copy. Existing coaches can move between programs, inherit a new roster and change the stability of both organizations. Their career record, tenure and previous employers persist across seasons.

### Persistent history

The world stores compact season records rather than full play-by-play data. Each record contains final standings, conference finish, rating, championship status and head coach. Transactions preserve graduations, enrollments, transfers, firings and hires.

### Hero integration

When the hero reports to college, the same ecosystem entity is removed from the high-school roster and inserted into the selected college roster. The hero then competes inside the same position room as background players. Future graduations, transfers, injuries and coaching changes affect the hero through the shared world state.
