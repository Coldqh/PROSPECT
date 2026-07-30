import { describe, expect, it } from "vitest";
import type { FootballPosition } from "../career/types";
import {
  createLivePlayEngine,
  decodeLivePlayOutcome,
  encodeLivePlayOutcome,
  issueLivePlayCommand,
  liveFieldViewport,
  liveHeroControlActive,
  livePassInterceptionChance,
  liveReceiverTargets,
  liveRoleActions,
  liveWorldToFieldYard,
  stepLivePlayEngine,
  type MatchLivePlayOutcome,
} from "./realTimeEngine";
import type { MatchEpisode, MatchPlayerAssignment, MatchPlayCall } from "./types";

function call(side: "offense" | "defense"): MatchPlayCall {
  return side === "offense"
    ? {
        id: "gun-mesh",
        formation: "Gun Doubles",
        personnel: "11",
        concept: "Mesh",
        playType: "pass",
        strength: "middle",
        calledBy: "offensive-coordinator",
        canCheck: false,
        aggression: 52,
        primarySlot: "H",
        progression: ["H", "Y", "RB", "X", "Z"],
        tags: ["short", "man-beater"],
      }
    : {
        id: "nickel-one",
        formation: "Nickel 4–2–5",
        personnel: "Nickel",
        concept: "Cover 1 Robber",
        playType: "coverage",
        strength: "middle",
        calledBy: "defensive-coordinator",
        canCheck: false,
        aggression: 55,
        progression: [],
        tags: ["man", "single-high"],
      };
}

function assignment(
  id: string,
  side: "hero" | "opponent",
  unit: "offense" | "defense",
  slot: string,
  position: string,
  kind: MatchPlayerAssignment["kind"],
  start: { x: number; y: number },
  end: { x: number; y: number },
  isHero = false,
  matchupSlot?: string,
): MatchPlayerAssignment {
  return {
    id,
    playerId: id,
    playerName: id,
    side,
    unit,
    slot,
    position,
    label: slot,
    isHero,
    kind,
    task: kind,
    start,
    end,
    delayMs: 0,
    overall: isHero ? 82 : 72,
    health: 92,
    depthRank: 1,
    ...(matchupSlot ? { matchupSlot } : {}),
  };
}

function episode(heroPosition: FootballPosition = "QB"): MatchEpisode {
  const offense: MatchPlayerAssignment[] = [
    assignment("o-qb", "hero", "offense", "QB", "QB", "pass-read", { x: 50, y: 68 }, { x: 50, y: 74 }, heroPosition === "QB"),
    assignment("o-rb", "hero", "offense", "RB", "RB", "route", { x: 55, y: 72 }, { x: 61, y: 42 }, heroPosition === "RB"),
    assignment("o-x", "hero", "offense", "X", "WR", "route", { x: 12, y: 55 }, { x: 22, y: 22 }, heroPosition === "WR"),
    assignment("o-z", "hero", "offense", "Z", "WR", "route", { x: 88, y: 55 }, { x: 78, y: 24 }),
    assignment("o-h", "hero", "offense", "H", "WR", "route", { x: 30, y: 54 }, { x: 45, y: 34 }),
    assignment("o-y", "hero", "offense", "Y", "TE", "route", { x: 72, y: 56 }, { x: 60, y: 35 }, heroPosition === "TE"),
    assignment("o-lt", "hero", "offense", "LT", "OT", "pass-protection", { x: 35, y: 58 }, { x: 35, y: 52 }, heroPosition === "OT", "LE"),
    assignment("o-lg", "hero", "offense", "LG", "OG", "pass-protection", { x: 42, y: 58 }, { x: 42, y: 52 }, heroPosition === "OG", "DT1"),
    assignment("o-c", "hero", "offense", "C", "C", "pass-protection", { x: 50, y: 58 }, { x: 50, y: 52 }, heroPosition === "C", "MIKE"),
    assignment("o-rg", "hero", "offense", "RG", "OG", "pass-protection", { x: 58, y: 58 }, { x: 58, y: 52 }, false, "DT2"),
    assignment("o-rt", "hero", "offense", "RT", "OT", "pass-protection", { x: 65, y: 58 }, { x: 65, y: 52 }, false, "RE"),
  ];
  const defense: MatchPlayerAssignment[] = [
    assignment("d-le", "opponent", "defense", "LE", "EDGE", "rush", { x: 34, y: 48 }, { x: 42, y: 62 }, heroPosition === "EDGE", "LT"),
    assignment("d-dt1", "opponent", "defense", "DT1", "DT", "rush", { x: 43, y: 48 }, { x: 47, y: 62 }, heroPosition === "DT", "LG"),
    assignment("d-dt2", "opponent", "defense", "DT2", "DT", "rush", { x: 57, y: 48 }, { x: 53, y: 62 }, false, "RG"),
    assignment("d-re", "opponent", "defense", "RE", "EDGE", "rush", { x: 66, y: 48 }, { x: 58, y: 62 }, false, "RT"),
    assignment("d-mike", "opponent", "defense", "MIKE", "LB", "zone-coverage", { x: 50, y: 40 }, { x: 50, y: 34 }, heroPosition === "LB"),
    assignment("d-will", "opponent", "defense", "WILL", "LB", "zone-coverage", { x: 35, y: 39 }, { x: 35, y: 30 }),
    assignment("d-sam", "opponent", "defense", "SAM", "LB", "zone-coverage", { x: 65, y: 39 }, { x: 65, y: 30 }),
    assignment("d-lcb", "opponent", "defense", "LCB", "CB", "man-coverage", { x: 12, y: 42 }, { x: 18, y: 23 }, heroPosition === "CB", "X"),
    assignment("d-rcb", "opponent", "defense", "RCB", "CB", "man-coverage", { x: 88, y: 42 }, { x: 80, y: 23 }, false, "Z"),
    assignment("d-fs", "opponent", "defense", "FS", "S", "zone-coverage", { x: 45, y: 25 }, { x: 45, y: 18 }, heroPosition === "S"),
    assignment("d-ss", "opponent", "defense", "SS", "S", "zone-coverage", { x: 58, y: 27 }, { x: 58, y: 20 }),
  ];
  return {
    id: `episode-${heroPosition}`,
    driveId: "drive-1",
    possession: "hero",
    unit: ["EDGE", "DT", "LB", "CB", "S"].includes(heroPosition) ? "defense" : "offense",
    position: heroPosition,
    quarter: 1,
    clockSeconds: 720,
    playClockSeconds: 25,
    down: 1,
    distance: 10,
    fieldPosition: 25,
    scoreMargin: 0,
    title: "Live snap",
    situation: "1st & 10",
    assignment: "Execute",
    read: "Read the field",
    playCall: call("offense"),
    opponentCall: call("defense"),
    heroInvolvement: "primary",
    heroRole: "Direct control",
    heroSlot: heroPosition,
    assignments: [...defense, ...offense],
    options: [],
  };
}

function blockerPosition(position: string): boolean {
  return ["OT", "OG", "C"].includes(position);
}

function runUntilWhistle(position: FootballPosition, onFrame?: (frame: number, state: ReturnType<typeof createLivePlayEngine>) => void): ReturnType<typeof createLivePlayEngine> {
  const state = createLivePlayEngine(episode(position), position, `test-${position}`);
  issueLivePlayCommand(state, { type: "snap" });
  for (let frame = 0; frame < 900 && !state.outcome; frame += 1) {
    onFrame?.(frame, state);
    stepLivePlayEngine(state, { moveX: 0, moveY: 0 }, 1 / 60);
  }
  return state;
}

describe("real-time football engine", () => {
  it("moves all agents and resolves a user-selected QB target", () => {
    const state = runUntilWhistle("QB", (frame, current) => {
      if (frame === 55) {
        const target = liveReceiverTargets(current).find((player) => player.slot === "H");
        expect(target).toBeDefined();
        if (target) issueLivePlayCommand(current, { type: "throw", targetId: target.id });
      }
    });

    expect(state.players).toHaveLength(22);
    expect(state.players.filter((player) => player.unit === "defense").some((player) => Math.hypot(player.x - player.startX, player.y - player.startY) > 1)).toBe(true);
    expect(state.events.some((event) => event.type === "throw" && event.text.includes("H"))).toBe(true);
    expect(state.events.some((event) => ["catch", "drop", "breakup", "interception"].includes(event.type))).toBe(true);
    expect(state.outcome).toBeDefined();
  });

  it("lets the QB commit to a scramble instead of selecting a scripted result", () => {
    const state = createLivePlayEngine(episode("QB"), "QB", "qb-run");
    issueLivePlayCommand(state, { type: "snap" });
    issueLivePlayCommand(state, { type: "run" });
    for (let frame = 0; frame < 900 && !state.outcome; frame += 1) {
      stepLivePlayEngine(state, { moveX: 0.15, moveY: -1 }, 1 / 60);
    }
    expect(state.runCommitted).toBe(true);
    expect(state.events.some((event) => event.type === "throw")).toBe(false);
    expect(state.outcome).toBeDefined();
    expect(["run", "sack", "touchdown"]).toContain(state.outcome?.snapResult);
  });



  it("uses a yard-based camera and supports a real long touchdown", () => {
    const state = createLivePlayEngine(episode("QB"), "QB", "long-touchdown");
    state.episode.fieldPosition = 20;
    state.players.filter((player) => player.unit === "defense").forEach((player) => { player.down = true; });
    issueLivePlayCommand(state, { type: "snap" });
    issueLivePlayCommand(state, { type: "run" });
    for (let frame = 0; frame < 1000 && !state.outcome; frame += 1) {
      stepLivePlayEngine(state, { moveX: 0, moveY: -1 }, 1 / 60);
    }
    expect(state.outcome?.snapResult).toBe("touchdown");
    expect(state.outcome?.yards).toBe(80);
    expect(state.outcome?.endFieldPosition).toBe(100);
    const viewport = liveFieldViewport(state);
    expect(viewport.spanYards).toBe(36);
    expect(viewport.highFieldYard - viewport.lowFieldYard).toBe(36);
    expect(liveWorldToFieldYard(state, state.players.find((player) => player.isHero)!.y)).toBeGreaterThanOrEqual(99);
  });

  it("does not let the QB move before receiving the snap", () => {
    const state = createLivePlayEngine(episode("QB"), "QB", "snap-lock");
    const qb = state.players.find((player) => player.isHero)!;
    const start = { x: qb.x, y: qb.y };
    issueLivePlayCommand(state, { type: "snap" });
    for (let frame = 0; frame < 8; frame += 1) {
      stepLivePlayEngine(state, { moveX: 1, moveY: -1 }, 1 / 60);
    }
    expect(qb.x).toBeCloseTo(start.x, 4);
    expect(qb.y).toBeCloseTo(start.y, 4);
  });

  it("turns a physical interception into a return that the offense can tackle", () => {
    const state = createLivePlayEngine(episode("QB"), "QB", "forced-interception");
    issueLivePlayCommand(state, { type: "snap" });
    for (let frame = 0; frame < 20; frame += 1) stepLivePlayEngine(state, { moveX: 0, moveY: 0 }, 1 / 60);
    const target = liveReceiverTargets(state).find((player) => player.slot === "H")!;
    issueLivePlayCommand(state, { type: "throw", targetId: target.id });
    const interceptor = state.players.find((player) => player.slot === "FS")!;
    for (const defender of state.players.filter((player) => player.unit === "defense" && player.id !== interceptor.id)) defender.down = true;
    interceptor.overall = 99;
    interceptor.actionMode = "intercept";
    interceptor.ballReactionDelay = 0;
    interceptor.x = state.ball.targetX;
    interceptor.y = state.ball.targetY;
    target.x = 95;
    target.y = 120;
    state.randomState = 1;
    for (let frame = 0; frame < 900 && !state.outcome; frame += 1) stepLivePlayEngine(state, { moveX: 0, moveY: 0 }, 1 / 60);
    expect(state.events.some((entry) => entry.type === "interception")).toBe(true);
    expect(state.events.some((entry) => entry.type === "tackle")).toBe(true);
    expect(state.outcome?.turnover).toBe(true);
    expect(state.outcome?.snapResult).toBe("turnover");
  });

  it("only creates interceptions from physical contact with the live ball", () => {
    const state = createLivePlayEngine(episode("QB"), "QB", "clean-window");
    for (const defender of state.players.filter((player) => player.unit === "defense")) {
      defender.x = 95;
      defender.y = 95;
      defender.startX = 95;
      defender.startY = 95;
      defender.ballReactionDelay = 2;
    }
    issueLivePlayCommand(state, { type: "snap" });
    for (let frame = 0; frame < 900 && !state.outcome; frame += 1) {
      if (frame === 65) {
        const target = liveReceiverTargets(state).find((player) => player.slot === "H");
        expect(target).toBeDefined();
        if (target) issueLivePlayCommand(state, { type: "throw", targetId: target.id });
      }
      stepLivePlayEngine(state, { moveX: 0, moveY: 0 }, 1 / 60);
    }
    expect(state.events.some((entry) => entry.type === "interception")).toBe(false);
    expect(state.outcome).toBeDefined();
    expect(state.outcome?.turnover).toBe(false);
    expect(["completion", "incomplete", "touchdown"]).toContain(state.outcome?.snapResult);
  });


  it("keeps physical interceptions rare even when a defender wins the catch point", () => {
    expect(livePassInterceptionChance(74, 0, 82, 0.3)).toBeLessThan(5);
    expect(livePassInterceptionChance(99, 7, 20, 2)).toBeLessThanOrEqual(11.5);
    expect(livePassInterceptionChance(55, 0, 99, 0)).toBeGreaterThanOrEqual(0.25);
  });

  it("hands control to the player only while movement input is active", () => {
    const state = createLivePlayEngine(episode("WR"), "WR", "seamless-control");
    const hero = state.players.find((player) => player.isHero)!;
    const start = { x: hero.x, y: hero.y };
    issueLivePlayCommand(state, { type: "snap" });

    for (let frame = 0; frame < 45; frame += 1) stepLivePlayEngine(state, { moveX: 0, moveY: 0 }, 1 / 60);
    expect(Math.hypot(hero.x - start.x, hero.y - start.y)).toBeGreaterThan(1);
    expect(liveHeroControlActive({ moveX: 0, moveY: 0 })).toBe(false);

    const beforeOverride = { x: hero.x, y: hero.y };
    for (let frame = 0; frame < 24; frame += 1) stepLivePlayEngine(state, { moveX: -1, moveY: 0 }, 1 / 60);
    expect(liveHeroControlActive({ moveX: -1, moveY: 0 })).toBe(true);
    expect(hero.x).toBeLessThan(beforeOverride.x);

    const releasePoint = { x: hero.x, y: hero.y };
    for (let frame = 0; frame < 45; frame += 1) stepLivePlayEngine(state, { moveX: 0, moveY: 0 }, 1 / 60);
    expect(liveHeroControlActive({ moveX: 0, moveY: 0 })).toBe(false);
    expect(Math.hypot(hero.x - releasePoint.x, hero.y - releasePoint.y)).toBeGreaterThan(0.8);
  });

  it("keeps automatic routes stable at waypoints", () => {
    const state = createLivePlayEngine(episode("WR"), "WR", "stable-route");
    const hero = state.players.find((player) => player.isHero)!;
    issueLivePlayCommand(state, { type: "snap" });
    let previousX = hero.x;
    let previousDirection = 0;
    let directionChanges = 0;
    let maximumStep = 0;
    for (let frame = 0; frame < 105 && !state.outcome; frame += 1) {
      stepLivePlayEngine(state, { moveX: 0, moveY: 0 }, 1 / 60);
      const dx = hero.x - previousX;
      maximumStep = Math.max(maximumStep, Math.abs(dx));
      const direction = Math.abs(dx) < 0.002 ? 0 : Math.sign(dx);
      if (direction !== 0 && previousDirection !== 0 && direction !== previousDirection) directionChanges += 1;
      if (direction !== 0) previousDirection = direction;
      previousX = hero.x;
    }
    expect(directionChanges).toBeLessThanOrEqual(2);
    expect(maximumStep).toBeLessThan(0.25);
  });

  it("moves the QB away from immediate edge pressure", () => {
    const state = createLivePlayEngine(episode("QB"), "QB", "pocket-escape");
    const qb = state.players.find((player) => player.isHero)!;
    const rusher = state.players.find((player) => player.slot === "LE" && player.unit === "defense")!;
    for (const defender of state.players.filter((player) => player.unit === "defense" && player.id !== rusher.id)) defender.down = true;
    for (const blocker of state.players.filter((player) => player.unit === "offense" && blockerPosition(player.position))) blocker.down = true;
    rusher.x = qb.x - 3.2;
    rusher.y = qb.y - 0.6;
    rusher.rushWon = true;
    const start = { x: qb.x, y: qb.y };
    issueLivePlayCommand(state, { type: "snap" });
    for (let frame = 0; frame < 70 && !state.outcome; frame += 1) stepLivePlayEngine(state, { moveX: 0, moveY: 0 }, 1 / 60);
    expect(state.pressureOccurred).toBe(true);
    expect(Math.hypot(qb.x - start.x, qb.y - start.y)).toBeGreaterThan(1.2);
  });

  it("keeps role controls deliberately small", () => {
    const positions: FootballPosition[] = ["QB", "RB", "WR", "TE", "OT", "OG", "C", "EDGE", "DT", "LB", "CB", "S", "K", "P"];
    for (const position of positions) {
      const actions = liveRoleActions(position);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.length).toBeLessThanOrEqual(3);
    }
  });

  it("serializes the actual live outcome for the save pipeline", () => {
    const outcome: MatchLivePlayOutcome = {
      version: 1,
      actionId: "live-qb",
      snapResult: "completion",
      yards: 12,
      points: 0,
      turnover: false,
      targetSlot: "H",
      ballCarrierSlot: "H",
      teamExecutionScore: 78,
      assignmentScore: 81,
      pressureOccurred: true,
      elapsedSeconds: 4,
      description: "Pass completed.",
      heroInvolved: true,
      statDelta: {
        passingAttempts: 1, completions: 1, passingYards: 12, rushingAttempts: 0, rushingYards: 0,
        targets: 0, receptions: 0, receivingYards: 0, touchdowns: 0, turnovers: 0,
        tackles: 0, tacklesForLoss: 0, sacks: 0, passBreakups: 0, interceptions: 0,
        sacksAllowed: 0, pressuresAllowed: 0, pancakes: 0, hurries: 0, runStops: 0,
        coverageSnaps: 0, fieldGoalsAttempted: 0, fieldGoalsMade: 0, longestFieldGoal: 0,
        punts: 0, puntYards: 0, puntsInside20: 0, returnYardsAllowed: 0,
      },
      advancedDelta: {
        snaps: 1, assignmentWins: 1, assignmentLosses: 0, routeWins: 0, separationWins: 0,
        blocksWon: 0, pressures: 0, coverageWins: 0, missedTackles: 0,
        passProtectionWins: 0, runBlockWins: 0, doubleTeamWins: 0, kickQuality: 0, puntQuality: 0,
      },
      events: [],
    };
    expect(decodeLivePlayOutcome(encodeLivePlayOutcome(outcome))).toEqual(outcome);
  });
});
