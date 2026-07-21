# Life loop v0.3

## Purpose

The first playable loop advances one deterministic game day at a time. The player chooses a weekly plan and an intensity. The simulation then combines that plan with the athlete's current condition, personality, academics, football schedule, and the seeded random stream for the date.

## State

`LifeState` stores only persistent decisions and outcomes:

- current week and weekday;
- total completed days;
- active weekly plan;
- consistency;
- the most recent day report.

The visible daily schedule is derived from the weekday and active plan. It is not duplicated in the save.

## Flow

1. The player selects a plan template and intensity.
2. `CareerRepository.updateWeeklyPlan` saves the decision.
3. The player completes the day.
4. `advanceLifeDay` calculates condition and academic changes without importing football code.
5. `advanceFootballCareerDay` applies football development and coach trust.
6. The repository validates schema v3 and writes a new IndexedDB snapshot.

## Determinism

Daily randomness uses the world seed and current game date. Repeating the same state, plan, and date produces the same result. `Math.random` is not used.

## Save migration

Schema v2 careers receive an initial balanced plan and retain the existing athlete and football world. Schema v1 careers migrate through player creation and then into schema v3.
