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
