import { describe, expect, it } from "vitest";
import type { FootballPosition } from "../career/types";
import { aggregateMatchEvaluation, evaluateSnapPerformance } from "./performanceEvaluation";
import type { MatchAdvancedStatLine, MatchEpisode, MatchStatLine } from "./types";

function statLine(overrides: Partial<MatchStatLine> = {}): MatchStatLine {
  return {
    passingAttempts: 0, completions: 0, passingYards: 0, rushingAttempts: 0, rushingYards: 0,
    targets: 0, receptions: 0, receivingYards: 0, touchdowns: 0, turnovers: 0,
    tackles: 0, tacklesForLoss: 0, sacks: 0, passBreakups: 0, interceptions: 0,
    sacksAllowed: 0, pressuresAllowed: 0, pancakes: 0, hurries: 0, runStops: 0,
    coverageSnaps: 0, fieldGoalsAttempted: 0, fieldGoalsMade: 0, longestFieldGoal: 0,
    punts: 0, puntYards: 0, puntsInside20: 0, returnYardsAllowed: 0,
    ...overrides,
  };
}

function advancedLine(overrides: Partial<MatchAdvancedStatLine> = {}): MatchAdvancedStatLine {
  return {
    snaps: 1, assignmentWins: 0, assignmentLosses: 0, routeWins: 0, separationWins: 0,
    blocksWon: 0, pressures: 0, coverageWins: 0, missedTackles: 0,
    passProtectionWins: 0, runBlockWins: 0, doubleTeamWins: 0, kickQuality: 0, puntQuality: 0,
    ...overrides,
  };
}

function episode(position: FootballPosition, playType: MatchEpisode["playCall"]["playType"] = "pass"): MatchEpisode {
  const call = {
    id: "call",
    formation: "Gun Doubles",
    personnel: "11",
    concept: "Drive",
    playType,
    strength: "middle" as const,
    calledBy: "offensive-coordinator" as const,
    canCheck: true,
    aggression: 55,
    primarySlot: "X",
    progression: ["X", "H", "Y", "RB"],
    tags: ["intermediate"],
  };
  return {
    id: `episode-${position}`,
    driveId: "drive",
    possession: "hero",
    unit: ["CB", "S", "LB", "EDGE", "DT"].includes(position) ? "defense" : "offense",
    position,
    quarter: 2,
    clockSeconds: 421,
    playClockSeconds: 25,
    down: 3,
    distance: 7,
    fieldPosition: 44,
    scoreMargin: 0,
    title: "Evaluation test",
    situation: "3rd & 7",
    assignment: "Execute the call",
    read: "Read leverage",
    playCall: call,
    opponentCall: { ...call, id: "defense", calledBy: "defensive-coordinator", concept: "Cover 3", playType: "coverage" },
    heroInvolvement: "primary",
    heroRole: "Primary responsibility",
    heroSlot: position,
    assignments: [],
    options: [],
  };
}

function evaluate(position: FootballPosition, overrides: Partial<Parameters<typeof evaluateSnapPerformance>[0]> = {}) {
  return evaluateSnapPerformance({
    position,
    episode: episode(position),
    assignmentScore: 72,
    teamExecutionScore: 70,
    snapResult: "completion",
    yards: 8,
    involved: true,
    pressureOccurred: false,
    statDelta: statLine(),
    advancedDelta: advancedLine(),
    ...overrides,
  });
}

describe("position-specific performance evaluation", () => {
  it("penalizes a broken route while crediting separation created by improvisation", () => {
    const result = evaluate("WR", {
      liveSignals: { routeAdherence: 42, separationScore: 94 },
      statDelta: statLine({ targets: 0 }),
      involved: false,
    });
    const route = result.criteria.find((item) => item.id === "route");
    const separation = result.criteria.find((item) => item.id === "separation");
    expect(route?.score).toBe(42);
    expect(route?.detail).toContain("импровизация");
    expect(separation?.score).toBe(94);
    expect(result.corrections).toContain("Маршрут");
    expect(result.strengths).toContain("Отрыв");
  });

  it("makes a quarterback turnover materially worse than a completed read", () => {
    const completion = evaluate("QB", {
      liveSignals: { decisionQuality: 84, timingScore: 82, timeToThrow: 2.7 },
      statDelta: statLine({ passingAttempts: 1, completions: 1, passingYards: 15 }),
      snapResult: "completion",
      yards: 15,
    });
    const turnover = evaluate("QB", {
      liveSignals: { decisionQuality: 38, timingScore: 52, timeToThrow: 4.1 },
      statDelta: statLine({ passingAttempts: 1, turnovers: 1 }),
      snapResult: "turnover",
      yards: 0,
    });
    expect(completion.score - turnover.score).toBeGreaterThan(25);
    expect(turnover.grade).toBe("D");
  });

  it("punishes an offensive lineman for allowing pressure and a sack", () => {
    const clean = evaluate("OT", {
      assignmentScore: 86,
      statDelta: statLine(),
      advancedDelta: advancedLine({ passProtectionWins: 1 }),
    });
    const beaten = evaluate("OT", {
      assignmentScore: 40,
      snapResult: "sack",
      yards: -8,
      statDelta: statLine({ pressuresAllowed: 1, sacksAllowed: 1 }),
    });
    expect(clean.score - beaten.score).toBeGreaterThan(25);
    expect(beaten.corrections).toContain("Protection");
  });

  it.each<FootballPosition>(["QB", "RB", "WR", "TE", "OT", "OG", "C", "EDGE", "DT", "LB", "CB", "S", "K", "P"])(
    "builds a complete weighted rubric for %s",
    (position) => {
      const result = evaluate(position);
      expect(result.criteria).toHaveLength(4);
      expect(result.criteria.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    },
  );

  it("aggregates snap grades into an independent match report", () => {
    const strong = evaluate("S", { assignmentScore: 90, statDelta: statLine({ passBreakups: 1 }), advancedDelta: advancedLine({ coverageWins: 1 }) });
    const weak = evaluate("S", { assignmentScore: 45, statDelta: statLine(), advancedDelta: advancedLine({ missedTackles: 1 }) });
    const report = aggregateMatchEvaluation("S", [strong, weak]);
    expect(report.snapCount).toBe(2);
    expect(report.score).toBeCloseTo((strong.score + weak.score) / 2, 1);
    expect(report.criteria).toHaveLength(4);
    expect(report.bestSnapIds).toHaveLength(2);
  });
});
