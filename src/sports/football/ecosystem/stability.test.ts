import { describe, expect, it } from "vitest";
import { inspectEcosystemInvariants, runAutonomousStabilitySimulation } from "./stability";
import { createStabilitySave } from "./stabilityTestUtils";

describe("full-roster autonomous stability", () => {
  it("keeps the football world coherent for three full seasons", () => {
    const initial = createStabilitySave();
    expect(inspectEcosystemInvariants(initial.world)).toEqual([]);

    const { save, report } = runAutonomousStabilitySimulation(initial, 3);

    expect(report.completedSeasons).toBe(3);
    expect(report.finalSeasonYear).toBe(report.initialSeasonYear + 3);
    expect(report.violations).toEqual([]);
    expect(report.totalNationalTitles).toBe(3);
    expect(report.uniqueNationalChampions).toBeGreaterThanOrEqual(2);
    expect(report.totalCoachingChanges).toBeGreaterThan(0);
    expect(report.totalTransfers).toBeGreaterThan(0);
    expect(report.minPlayerPopulation).toBeGreaterThan(2_200);
    expect(report.maxPlayerPopulation).toBeLessThan(4_000);
    expect(report.snapshots.every((snapshot) => snapshot.collegeTeams === 24)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.coaches === initial.world.coaches.length)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.minCollegeRoster >= 65)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.maxCollegeRoster <= save.world.constitution.collegeRosterLimit)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.activeSocialBonds > snapshot.teams)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.strainedSocialBonds >= 0)).toBe(true);
    expect(save.world.social.teamCultures).toHaveLength(save.world.teams.length);
    expect(save.world.social.bonds.length).toBeLessThanOrEqual(12_000);
    expect(save.world.social.incidents.length).toBeLessThanOrEqual(180);
    expect(save.world.competition.programLegacies).toHaveLength(24);
    expect(save.world.talentPipeline.classHistory).toHaveLength(Math.min(20, 1 + report.completedSeasons));
    expect(save.world.worldHistory.facts.length).toBeGreaterThan(0);
    expect(save.world.worldHistory.objectives.some((objective) => objective.status === "active")).toBe(true);
    expect(save.world.worldHistory.arcs.length).toBeGreaterThan(0);
    expect(report.snapshots.every((snapshot) => snapshot.historyFacts <= 1_200)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.activeObjectives <= 420)).toBe(true);
    expect(report.snapshots.every((snapshot) => snapshot.activeStoryArcs <= 180)).toBe(true);
  }, 90_000);
});
