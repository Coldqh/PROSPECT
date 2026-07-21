# Football team world v0.4

## Purpose

The team is a persistent sports environment rather than a rating card. Each career now owns a deterministic coaching staff, roster, team dynamics and position room.

## Generated state

The football module stores:

- 51 background players across offense, defense and special teams;
- head coach, position coach, offensive coordinator and defensive coordinator;
- morale, cohesion, discipline and scheme mastery;
- the hero's full position room;
- current depth-chart evaluation and the last staff decision.

All entities are generated from the career world seed. Loading the same save never creates different people.

## Depth chart

The hero score combines:

- football overall;
- coach trust;
- health;
- confidence;
- discipline;
- fatigue.

Background players are evaluated through overall, coach standing and health. The ranking is recalculated after each completed day. Rank changes create career-history entries.

## Save migration

Schema v3 saves receive the same deterministic roster and staff through migration to schema v4. The athlete, weekly plan, history and current condition are preserved.
