import { describe, expect, it } from "vitest";
import { generateHighSchoolSeason } from "./generateSeason";
import type { SchoolIdentity } from "../career/types";

const school: SchoolIdentity = {
  id: "school-test",
  name: "Houston Central",
  shortName: "H Central",
  mascot: "Wolves",
  city: "Houston",
  stateCode: "TX",
  primaryColor: "#d7192d",
  secondaryColor: "#08090b",
  prestige: 72,
  facilities: 68,
  coaching: 75,
  medicine: 70,
  discipline: 66,
  youthTrust: 71,
  philosophy: "balanced spread",
};

describe("high school season generation", () => {
  it("creates a deterministic eight-game regional season", () => {
    const first = generateHighSchoolSeason("season-seed", school, { year: 2026, month: 8, day: 17 });
    const second = generateHighSchoolSeason("season-seed", school, { year: 2026, month: 8, day: 17 });
    expect(first).toEqual(second);
    expect(first.schedule).toHaveLength(8);
    expect(first.opponents).toHaveLength(8);
    expect(first.standings).toHaveLength(9);
    expect(new Set(first.opponents.map((opponent) => opponent.name)).size).toBe(8);
  });

  it("starts with a real opponent and zeroed season totals", () => {
    const season = generateHighSchoolSeason("season-start", school, { year: 2026, month: 8, day: 17 });
    expect(season.nextOpponent.id).toBe(season.schedule[0]?.opponentId);
    expect(season.heroTotals.touchdowns).toBe(0);
    expect(season.schedule.every((game) => game.status === "scheduled")).toBe(true);
  });
});
