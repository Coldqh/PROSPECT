import { describe, expect, it } from "vitest";
import { callPlay } from "./playbook";
import type { MatchTacticalCall, MatchTacticalProfile } from "./types";

function profile(overrides: Partial<MatchTacticalProfile> = {}): MatchTacticalProfile {
  return {
    offenseSystem: "multiple",
    defenseSystem: "multiple-defense",
    runRate: 48,
    playActionRate: 18,
    screenRate: 12,
    deepShotRate: 20,
    blitzRate: 34,
    manCoverageRate: 42,
    disguiseRate: 55,
    fourthDownAggression: 50,
    adaptation: 55,
    ...overrides,
  };
}

describe("staff-driven play calling", () => {
  it("produces materially different offense for run-heavy and air-raid staffs", () => {
    let powerRuns = 0;
    let airRuns = 0;
    for (let index = 0; index < 240; index += 1) {
      const power = callPlay(`power-${index}`, "offense", 1, 10, 50, true, 0, 1, 620, {
        profile: profile({ offenseSystem: "power-run", runRate: 72, playActionRate: 31, deepShotRate: 12 }),
      });
      const air = callPlay(`air-${index}`, "offense", 1, 10, 50, true, 0, 1, 620, {
        profile: profile({ offenseSystem: "air-raid", runRate: 24, screenRate: 20, deepShotRate: 31 }),
      });
      if (power.playType === "run") powerRuns += 1;
      if (air.playType === "run") airRuns += 1;
    }
    expect(powerRuns).toBeGreaterThan(airRuns + 55);
  });

  it("lets an adaptive defense answer repeated offense tendencies", () => {
    const repeatedRuns: MatchTacticalCall[] = Array.from({ length: 8 }, (_, index) => ({
      id: `run-${index}`,
      concept: "Inside Zone",
      playType: "run",
      tags: ["zone", "early-down"],
      yards: 5,
      success: true,
    }));
    let runAnswers = 0;
    let passiveAnswers = 0;
    for (let index = 0; index < 180; index += 1) {
      const adaptive = callPlay(`adaptive-${index}`, "defense", 1, 10, 50, true, 0, 2, 500, {
        profile: profile({ defenseSystem: "over-43", adaptation: 92, blitzRate: 28 }),
        recentOffense: repeatedRuns,
      });
      const passive = callPlay(`passive-${index}`, "defense", 1, 10, 50, true, 0, 2, 500, {
        profile: profile({ defenseSystem: "over-43", adaptation: 25, blitzRate: 28 }),
        recentOffense: [],
      });
      if (adaptive.tags.some((tag) => tag === "run-support" || tag === "run-fit" || tag === "heavy-box")) runAnswers += 1;
      if (passive.tags.some((tag) => tag === "run-support" || tag === "run-fit" || tag === "heavy-box")) passiveAnswers += 1;
    }
    expect(runAnswers).toBeGreaterThan(passiveAnswers + 8);
  });
});
