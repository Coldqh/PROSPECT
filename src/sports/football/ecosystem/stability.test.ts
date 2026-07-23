import { describe, expect, it } from "vitest";
import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import { createFootballEcosystem } from "./createEcosystem";
import { inspectEcosystemInvariants, runAutonomousStabilitySimulation } from "./stability";

function createSave(seed = "twenty-season-stability"): CareerSave {
  const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
  const life = createInitialLifeState();
  const date = { year: 2026, month: 8, day: 17 };
  return {
    meta: {
      id: "stability-observer",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sport: "american-football",
      worldSeed: seed,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z",
      currentDate: date,
      phase: "high-school-preseason",
      revision: 1,
    },
    character: generated.character,
    football: generated.football,
    life,
    relationships: createFootballRelationships(seed, generated.character, generated.football),
    world: createFootballEcosystem(seed, generated.character, generated.football, date),
    history: [],
  };
}

describe("twenty-season autonomous stability", () => {
  it("keeps the football world coherent for twenty full seasons", () => {
    const initial = createSave();
    expect(inspectEcosystemInvariants(initial.world)).toEqual([]);

    const { save, report } = runAutonomousStabilitySimulation(initial, 20);

    expect(report.completedSeasons).toBe(20);
    expect(report.finalSeasonYear).toBe(report.initialSeasonYear + 20);
    expect(report.violations).toEqual([]);
    expect(report.totalNationalTitles).toBe(20);
    expect(report.uniqueNationalChampions).toBeGreaterThanOrEqual(2);
    expect(report.totalCoachingChanges).toBeGreaterThan(0);
    expect(report.totalTransfers).toBeGreaterThan(0);
    expect(report.minPlayerPopulation).toBeGreaterThan(200);
    expect(report.maxPlayerPopulation).toBeLessThan(2_000);
    expect(report.snapshots.every((snapshot) => snapshot.collegeTeams === 24)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.coaches === initial.world.coaches.length)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.minCollegeRoster >= 10)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.maxCollegeRoster <= save.world.constitution.collegeRosterLimit)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.activeSocialBonds > snapshot.teams)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.strainedSocialBonds >= 0)).toBe(true);
    expect(save.world.social.teamCultures).toHaveLength(save.world.teams.length);
    expect(save.world.social.bonds.length).toBeLessThanOrEqual(3_000);
    expect(save.world.social.incidents.length).toBeLessThanOrEqual(180);
    expect(save.world.competition.programLegacies).toHaveLength(24);
    expect(save.world.talentPipeline.classHistory).toHaveLength(20);
  }, 60_000);

  it("produces the same five-season report from the same seed", () => {
    const left = runAutonomousStabilitySimulation(createSave("stability-repeatable"), 5);
    const right = runAutonomousStabilitySimulation(createSave("stability-repeatable"), 5);
    expect(left.report).toEqual(right.report);
    expect(left.save.world).toEqual(right.save.world);
  }, 30_000);
});
