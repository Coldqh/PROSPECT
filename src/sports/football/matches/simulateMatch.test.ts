import { describe, expect, it } from "vitest";
import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { createFootballCareerState } from "../career/createFootballCareer";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import { createFootballEcosystem } from "../ecosystem/createEcosystem";
import { CAREER_FOOTBALL_POSITIONS, type FootballCareerSetup, type FootballPosition } from "../career/types";
import { careerSaveSchema, CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";
import { resolveMatchDecision, startMatch } from "./simulateMatch";

const setupByPosition: Record<FootballPosition, { archetypeId: string; jerseyNumber: number }> = {
  QB: { archetypeId: "field-general", jerseyNumber: 12 },
  RB: { archetypeId: "slasher", jerseyNumber: 22 },
  WR: { archetypeId: "route-technician", jerseyNumber: 1 },
  TE: { archetypeId: "move-tight-end", jerseyNumber: 87 },
  OT: { archetypeId: "blindside-anchor", jerseyNumber: 72 },
  OG: { archetypeId: "pull-guard", jerseyNumber: 66 },
  C: { archetypeId: "line-caller", jerseyNumber: 55 },
  EDGE: { archetypeId: "speed-rusher", jerseyNumber: 9 },
  DT: { archetypeId: "three-technique", jerseyNumber: 95 },
  LB: { archetypeId: "run-stopper", jerseyNumber: 7 },
  CB: { archetypeId: "press-corner", jerseyNumber: 2 },
  S: { archetypeId: "center-fielder", jerseyNumber: 3 },
  K: { archetypeId: "accuracy-kicker", jerseyNumber: 8 },
  P: { archetypeId: "directional-punter", jerseyNumber: 6 },
};

function makeSave(position: FootballPosition = "WR"): CareerSave {
  const positionSetup = setupByPosition[position];
  const setup: FootballCareerSetup = {
    character: {
      firstName: "Jalen",
      lastName: "Cole",
      birthDate: "2008-08-17",
      gender: "male",
      handedness: "right",
      originId: "houston",
      familyIncome: "working",
      familyStructure: "two-parent",
      familySupport: "supportive",
      mindset: "composed",
    },
    position,
    archetypeId: positionSetup.archetypeId,
    jerseyNumber: positionSetup.jerseyNumber,
  };
  const generated = createFootballCareerState(`match-${position}`, setup);
  const life = createInitialLifeState();
  life.dayIndex = 5;
  return {
    meta: {
      id: `career-${position}`,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sport: "american-football",
      worldSeed: `match-${position}`,
      createdAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
      currentDate: { year: 2026, month: 8, day: 22 },
      phase: "high-school-preseason",
      revision: 1,
    },
    ...generated,
    life,
    relationships: createFootballRelationships(`match-${position}`, generated.character, generated.football),
    world: createFootballEcosystem(`match-${position}`, generated.character, generated.football, { year: 2026, month: 8, day: 22 }),
    history: [],
  };
}

function expectPlayableSnap(save: CareerSave): void {
  const episode = save.football.match.currentEpisode;
  if (!episode) throw new Error("No active snap");
  expect(episode.assignments).toHaveLength(22);
  if (episode.unit === "special") {
    expect(episode.assignments.filter((assignment) => assignment.side === "hero")).toHaveLength(11);
    expect(episode.assignments.filter((assignment) => assignment.side === "opponent")).toHaveLength(11);
    expect(episode.assignments.every((assignment) => assignment.unit === "special")).toBe(true);
  } else {
    expect(episode.assignments.filter((assignment) => assignment.unit === "offense")).toHaveLength(11);
    expect(episode.assignments.filter((assignment) => assignment.unit === "defense")).toHaveLength(11);
  }
  expect(episode.assignments.filter((assignment) => assignment.isHero)).toHaveLength(1);
  expect(episode.assignments.every((assignment) => Boolean(assignment.playerId && assignment.playerName))).toBe(true);
  expect(episode.assignments.every((assignment) => typeof assignment.overall === "number" && typeof assignment.health === "number")).toBe(true);
  expect(new Set(episode.assignments.map((assignment) => assignment.playerId)).size).toBe(22);
  expect(episode.options).toHaveLength(3);
  expect(episode.playCall.calledBy).not.toBe("hero");
  expect(episode.opponentCall.calledBy).not.toBe("hero");
}

function finish(save: CareerSave): CareerSave {
  let current = startMatch(save);
  let guard = 0;
  while (current.football.match.status === "in-progress") {
    expectPlayableSnap(current);
    const optionId = current.football.match.currentEpisode?.options[1]?.id;
    if (!optionId) throw new Error("No match option");
    current = resolveMatchDecision(current, optionId);
    guard += 1;
    if (guard > 80) throw new Error("Match did not finish");
  }
  return current;
}

describe("football match simulation", () => {
  it("creates a staff-called 22-player snap for every playable position", () => {
    for (const position of CAREER_FOOTBALL_POSITIONS) {
      const started = startMatch(makeSave(position));
      const expectedUnit = position === "K" || position === "P"
        ? "special"
        : ["EDGE", "DT", "LB", "CB", "S"].includes(position)
          ? "defense"
          : "offense";
      expect(started.football.match.heroUnit).toBe(expectedUnit);
      expect(started.football.match.currentEpisode?.position).toBe(position);
      expectPlayableSnap(started);
    }
  });

  it("is deterministic for the same state and decision", () => {
    const started = startMatch(makeSave("WR"));
    const optionId = started.football.match.currentEpisode?.options[0]?.id;
    if (!optionId) throw new Error("No match option");
    expect(resolveMatchDecision(started, optionId)).toEqual(resolveMatchDecision(started, optionId));
  });

  it("keeps a receiver active without forcing a target on every snap", () => {
    const completed = finish(makeSave("WR"));
    const match = completed.football.match;
    expect(match.completedEpisodes.length).toBeGreaterThan(12);
    expect(match.stats.targets).toBeGreaterThan(0);
    expect(match.stats.targets).toBeLessThan(match.completedEpisodes.length);
    expect(match.completedEpisodes.some((episode) => !episode.involved)).toBe(true);
    expect(match.completedEpisodes.every((episode) => episode.assignmentScore >= 0 && episode.assignmentScore <= 100)).toBe(true);
    expect(match.advancedStats.snaps).toBe(match.completedEpisodes.length);
    expect(match.advancedStats.routeWins).toBeGreaterThan(0);
    expect(match.stats.turnovers).toBe(0);
  });

  it("tracks real drives, possession changes and the complete game clock", () => {
    const completed = finish(makeSave("QB"));
    const match = completed.football.match;
    expect(match.status).toBe("complete");
    expect(match.gameClockSeconds).toBe(0);
    expect(match.quarter).toBe(4);
    expect(match.drives.length).toBeGreaterThan(2);
    expect(match.drives.some((drive) => drive.controlled)).toBe(true);
    expect(match.drives.some((drive) => !drive.controlled)).toBe(true);
    expect(match.drives.every((drive) => drive.plays > 0 && (
      drive.startQuarter < drive.endQuarter || drive.startClockSeconds >= drive.endClockSeconds
    ))).toBe(true);
    expect(match.completedEpisodes.every((episode) => match.drives.some((drive) => drive.id === episode.driveId))).toBe(true);
    for (let index = 1; index < match.drives.length; index += 1) {
      const previous = match.drives[index - 1]!;
      const current = match.drives[index]!;
      if (previous.offense === current.offense) expect(previous.outcome).toBe("defensive-touchdown");
    }
    const turnoverIndex = match.drives.findIndex((drive) => drive.controlled && drive.outcome === "turnover");
    if (turnoverIndex >= 0) {
      const turnover = match.drives[turnoverIndex]!;
      const nextDrive = match.drives[turnoverIndex + 1];
      expect(nextDrive?.startFieldPosition).toBe(Math.max(20, Math.min(75, 100 - turnover.endFieldPosition)));
    }
    expect(match.heroScore).not.toBe(match.opponentScore);
  });

  it("does not grant the opponent two possessions when the snap limit ends on a drive boundary", () => {
    const source = makeSave("WR");
    let probe = startMatch(source);
    const firstControlledDriveId = probe.football.match.currentDriveId;
    let guard = 0;
    while (probe.football.match.status === "in-progress" && !probe.football.match.drives.some((drive) => drive.id === firstControlledDriveId)) {
      const optionId = probe.football.match.currentEpisode?.options[1]?.id;
      if (!optionId) throw new Error("No match option");
      probe = resolveMatchDecision(probe, optionId);
      guard += 1;
      if (guard > 20) throw new Error("Controlled drive did not finish");
    }
    const cutoff = probe.football.match.episodeIndex;
    expect(cutoff).toBeGreaterThan(0);

    let exact = startMatch(source);
    exact = {
      ...exact,
      football: {
        ...exact.football,
        match: { ...exact.football.match, totalEpisodes: cutoff },
      },
    };
    while (exact.football.match.status === "in-progress") {
      const optionId = exact.football.match.currentEpisode?.options[1]?.id;
      if (!optionId) throw new Error("No match option");
      exact = resolveMatchDecision(exact, optionId);
    }

    const drives = exact.football.match.drives;
    for (let index = 1; index < drives.length; index += 1) {
      const previous = drives[index - 1]!;
      const current = drives[index]!;
      if (previous.offense === current.offense) expect(previous.outcome).toBe("defensive-touchdown");
    }
  });

  it("completes and serializes a match for all fourteen positions", () => {
    for (const position of CAREER_FOOTBALL_POSITIONS) {
      const completed = finish(makeSave(position));
      const match = completed.football.match;
      expect(match.status).toBe("complete");
      expect(match.completedEpisodes.length).toBeGreaterThan(0);
      expect(match.advancedStats.snaps).toBe(match.completedEpisodes.length);
      expect(match.finalResult?.spotlight.length).toBeGreaterThan(5);
      expect(completed.football.season.wins + completed.football.season.losses).toBe(1);
      expect(completed.football.season.schedule[0]?.status).toBe("complete");
      expect(() => careerSaveSchema.parse(completed)).not.toThrow();
    }
  });
});
