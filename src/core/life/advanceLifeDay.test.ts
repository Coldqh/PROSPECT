import { describe, expect, it } from "vitest";
import { createFootballCareerState } from "../../sports/football/career/createFootballCareer";
import type { FootballCareerSetup } from "../../sports/football/career/types";
import { createInitialLifeState } from "./createInitialLifeState";
import { advanceLifeDay } from "./advanceLifeDay";

const setup: FootballCareerSetup = {
  character: {
    firstName: "Cain",
    lastName: "Vale",
    birthDate: "2008-02-14",
    gender: "male",
    handedness: "right",
    originId: "houston",
    familyIncome: "working",
    familyStructure: "two-parent",
    familySupport: "supportive",
    mindset: "obsessed",
  },
  position: "WR",
  archetypeId: "route-technician",
  jerseyNumber: 11,
};

describe("advanceLifeDay", () => {
  it("is deterministic for the same date and seed", () => {
    const generated = createFootballCareerState("life-test", setup);
    const life = createInitialLifeState();
    const date = { year: 2026, month: 8, day: 17 };
    expect(advanceLifeDay(generated.character, life, date, "life-test")).toEqual(
      advanceLifeDay(generated.character, life, date, "life-test"),
    );
  });

  it("advances the calendar and records an outcome", () => {
    const generated = createFootballCareerState("life-test", setup);
    const result = advanceLifeDay(generated.character, createInitialLifeState(), { year: 2026, month: 8, day: 17 }, "life-test");
    expect(result.nextDate).toEqual({ year: 2026, month: 8, day: 18 });
    expect(result.life.dayIndex).toBe(1);
    expect(result.life.completedDays).toBe(1);
    expect(result.life.lastOutcome?.grade).toMatch(/[ABCD]/);
  });
});
