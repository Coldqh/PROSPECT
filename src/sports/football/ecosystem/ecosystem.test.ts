import { describe, expect, it } from "vitest";
import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import { createFootballEcosystem } from "./createEcosystem";
import { advanceFootballEcosystem } from "./simulateEcosystem";
import { placeHeroInCollegeEcosystem } from "./heroIntegration";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";

function createSave(seed = "ecosystem-test-seed"): CareerSave {
  const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
  const life = createInitialLifeState();
  const date = { year: 2026, month: 8, day: 17 };
  return {
    meta: {
      id: "ecosystem-career",
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

describe("football ecosystem", () => {
  it("creates a stable active world around the hero", () => {
    const left = createSave();
    const right = createSave();
    expect(left.world).toEqual(right.world);
    expect(left.world.teams.length).toBeGreaterThan(30);
    expect(left.world.players.length).toBeGreaterThan(100);
    expect(left.world.coaches.length).toBeGreaterThan(30);
    expect(left.world.conferences).toHaveLength(4);
    expect(left.world.players.some((player) => player.isHero)).toBe(true);
  });

  it("advances the market and synchronizes college needs with hero recruiting", () => {
    const base = createSave();
    const advancedInput: CareerSave = {
      ...base,
      meta: { ...base.meta, currentDate: { year: 2026, month: 8, day: 24 } },
      life: { ...base.life, completedDays: 7, weekNumber: 2, dayIndex: 0 },
    };
    const result = advanceFootballEcosystem(advancedInput);
    expect(result.world.lastSimulatedDay).toBe(7);
    expect(result.world.currentWeek).toBe(2);
    const program = result.football.recruitment.programs[0];
    if (!program) throw new Error("No recruiting program");
    const team = result.world.teams.find((item) => item.id === program.id);
    expect(team).toBeDefined();
    expect(program.positionNeed).toBe(team?.positionNeeds[result.football.position]);
    const firstOpponent = result.football.season.opponents[0];
    if (!firstOpponent) throw new Error("No season opponent");
    const worldOpponent = result.world.teams.find((item) => item.id === firstOpponent.id);
    expect(firstOpponent.rating).toBe(Math.round(worldOpponent?.rating ?? 0));
    const syncedRosterPlayer = result.football.roster.find((player) =>
      result.world.players.some((worldPlayer) => worldPlayer.id === player.id && worldPlayer.teamId === result.football.school.id),
    );
    if (!syncedRosterPlayer) throw new Error("No synchronized roster player");
    const worldRosterPlayer = result.world.players.find((player) => player.id === syncedRosterPlayer.id);
    expect(syncedRosterPlayer.health).toBe(Math.round(worldRosterPlayer?.health ?? 0));
  });

  it("plays coherent conference games where every win has a loss", () => {
    const base = createSave("conference-coherence");
    const result = advanceFootballEcosystem({
      ...base,
      life: { ...base.life, completedDays: 7, weekNumber: 2, dayIndex: 0 },
      meta: { ...base.meta, currentDate: { year: 2026, month: 8, day: 24 } },
    });
    const collegeTeams = result.world.teams.filter((team) => team.level === "college");
    expect(collegeTeams.reduce((sum, team) => sum + team.wins, 0)).toBe(
      collegeTeams.reduce((sum, team) => sum + team.losses, 0),
    );
    expect(result.world.seasonWeek).toBe(2);
  });

  it("archives a season and runs roster and coaching movement", () => {
    const base = createSave("ecosystem-rollover");
    const result = advanceFootballEcosystem({
      ...base,
      life: { ...base.life, completedDays: 91, weekNumber: 14, dayIndex: 0 },
      meta: { ...base.meta, currentDate: { year: 2027, month: 1, day: 4 } },
    });
    expect(result.world.seasonYear).toBe(2027);
    expect(result.world.phase).toBe("regular-season");
    expect(result.world.teamHistory.length).toBeGreaterThan(20);
    expect(result.world.transactions.some((transaction) => transaction.kind === "graduation")).toBe(true);
    expect(result.world.conferences.some((conference) => conference.champions.length > 0)).toBe(true);
  });


  it("moves the same hero entity into the selected college roster", () => {
    const base = createSave("hero-college-integration");
    const target = base.world.teams.find((team) => team.level === "college");
    if (!target) throw new Error("No college team");
    const previousHero = base.world.players.find((player) => player.isHero);
    if (!previousHero) throw new Error("No hero in ecosystem");
    const collegeFootball = {
      ...base.football,
      college: {
        ...base.football.college,
        stage: "orientation" as const,
        selectedProgramId: target.id,
        depthRank: 4,
      },
    };
    const world = placeHeroInCollegeEcosystem(
      base.world,
      base.character,
      collegeFootball,
      target.id,
      { year: 2027, month: 8, day: 16 },
    );
    const hero = world.players.find((player) => player.isHero);
    expect(hero?.id).toBe(previousHero.id);
    expect(hero?.teamId).toBe(target.id);
    expect(hero?.level).toBe("college");
    expect(world.teams.find((team) => team.id === target.id)?.rosterIds).toContain(previousHero.id);
    expect(world.teams.find((team) => team.id === previousHero.teamId)?.rosterIds).not.toContain(previousHero.id);
    expect(world.transactions.some((transaction) => transaction.kind === "recruit-enrolled" && transaction.relatedToHero)).toBe(true);
  });

  it("is deterministic for the same world state and completed day", () => {
    const base = createSave("ecosystem-repeatable");
    const input: CareerSave = {
      ...base,
      life: { ...base.life, completedDays: 7, weekNumber: 2, dayIndex: 0 },
      meta: { ...base.meta, currentDate: { year: 2026, month: 8, day: 24 } },
    };
    expect(advanceFootballEcosystem(input).world).toEqual(advanceFootballEcosystem(input).world);
  });
});
