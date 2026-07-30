import { describe, expect, it } from "vitest";
import { callPlay } from "./playbook";
import type { MatchEpisode, MatchUsagePlan } from "./types";
import {
  addMatchUsageStats,
  createDefaultMatchUsagePlan,
  createEmptyMatchUsageStats,
  receiverPriorityMap,
  usageDeltaForSnap,
} from "./usage";

const deepPlan: MatchUsagePlan = {
  role: "deep-threat",
  label: "DEEP THREAT",
  targetPriority: 88,
  touchPriority: 58,
  redZonePriority: 60,
  deepPriority: 94,
  designedShare: 25,
  shadowRisk: 58,
  doubleTeamRisk: 20,
};

const call = {
  id: "four-verts",
  formation: "Gun Doubles",
  personnel: "11",
  concept: "Four Verticals",
  playType: "pass" as const,
  strength: "middle" as const,
  calledBy: "offensive-coordinator" as const,
  canCheck: false,
  aggression: 84,
  primarySlot: "Z",
  progression: ["Z", "H", "X", "Y"],
  tags: ["shot", "deep", "long-yardage"],
};

describe("match usage and target plan", () => {
  it("elevates a featured deep threat above the static progression when the concept fits", () => {
    const priorities = receiverPriorityMap(deepPlan, createEmptyMatchUsageStats(), call, "X", "WR", 42);
    expect(priorities.X).toBeGreaterThan(priorities.Z ?? 0);
    expect(priorities.X).toBeGreaterThanOrEqual(90);
  });

  it("changes the called concepts when a player is featured in the weekly plan", () => {
    let baselineDeep = 0;
    let featuredDeep = 0;
    let baselineRuns = 0;
    let featuredRuns = 0;
    for (let index = 0; index < 300; index += 1) {
      const baseline = callPlay(`usage-baseline-${index}`, "offense", 1, 10, 45, false);
      const featured = callPlay(`usage-deep-${index}`, "offense", 1, 10, 45, false, 0, 1, 720, {
        featuredRole: "deep-threat",
        featuredPriority: 95,
      });
      const baselineRun = callPlay(`usage-run-baseline-${index}`, "offense", 1, 5, 45, false);
      const featuredRun = callPlay(`usage-run-${index}`, "offense", 1, 5, 45, false, 0, 1, 720, {
        featuredRole: "lead-runner",
        featuredPriority: 95,
      });
      if (baseline.tags.some((tag) => ["shot", "deep", "long-yardage"].includes(tag))) baselineDeep += 1;
      if (featured.tags.some((tag) => ["shot", "deep", "long-yardage"].includes(tag))) featuredDeep += 1;
      if (baselineRun.playType === "run") baselineRuns += 1;
      if (featuredRun.playType === "run") featuredRuns += 1;
    }
    expect(featuredDeep).toBeGreaterThan(baselineDeep);
    expect(featuredRuns).toBeGreaterThan(baselineRuns);
  });

  it("tracks open windows that the quarterback used or missed", () => {
    const episode = {
      heroSlot: "X",
      heroInvolvement: "secondary",
      playCall: call,
      receiverPriorities: { X: 94 },
      assignments: [{ isHero: true, kind: "route" }],
    } as unknown as MatchEpisode;
    const targeted = usageDeltaForSnap("WR", episode, "X", undefined, { heroOpenWindow: true, targetedWhenOpen: true, separationYards: 4.8 });
    const missed = usageDeltaForSnap("WR", episode, "H", undefined, { heroOpenWindow: true, separationYards: 3.9 });
    const aggregate = addMatchUsageStats(targeted, missed);
    expect(aggregate.routesRun).toBe(2);
    expect(aggregate.openWindows).toBe(2);
    expect(aggregate.targetsWhenOpen).toBe(1);
    expect(aggregate.missedOpenWindows).toBe(1);
    expect(aggregate.separationTotal).toBeCloseTo(8.7);
  });

  it("keeps non-skill positions out of the target plan", () => {
    const plan = createDefaultMatchUsagePlan("EDGE", "starter");
    expect(plan.targetPriority).toBe(0);
    expect(plan.designedShare).toBe(0);
  });
});
