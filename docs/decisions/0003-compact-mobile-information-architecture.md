# 0003 — Compact mobile information architecture

## Decision

Career screens are designed around a 393×852 CSS pixel viewport, matching the iPhone 14 Pro portrait layout.

Each main navigation section exposes one focused task at a time through local subtabs. Secondary metrics and completed-day details open in a scrollable bottom sheet rather than expanding the main page.

## Structure

- Today: Summary, Plan, Schedule.
- Career: Path, History, Recruiting.
- Team: Summary, Depth Chart, Program.
- Player: Body, Character, Home, Academics.

The page itself remains vertically scrollable as a safety mechanism. Bottom sheets have their own bounded scroll area.

## Visual direction

The global interface now uses black surfaces and a restrained crimson red accent. Generated team colors no longer take over navigation or full-screen backgrounds.
