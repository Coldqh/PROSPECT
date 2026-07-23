import { describe, expect, it } from "vitest";
import { createFootballCareerState, createLegacyFootballSetup } from "../../sports/football/career/createFootballCareer";
import { migrateCareerSave } from "./migrations";
import { CURRENT_SCHEMA_VERSION } from "./schema";
import { ECOSYSTEM_MODULE_VERSION } from "../../sports/football/ecosystem/types";

const legacySave = {
  meta: {
    id: "legacy-career",
    schemaVersion: 1,
    sport: "american-football",
    worldSeed: "football-legacy-seed",
    createdAt: "2026-07-21T10:00:00.000Z",
    updatedAt: "2026-07-21T10:00:00.000Z",
    currentDate: { year: 2026, month: 8, day: 17 },
    phase: "foundation",
    revision: 1,
  },
  football: {
    moduleVersion: 1,
    worldSeed: "football-legacy-seed",
    stage: "foundation",
  },
  history: [
    {
      id: "history-1",
      occurredAt: "2026-07-21T10:00:00.000Z",
      type: "career-created",
      title: "Карьера создана",
      description: "Технический фундамент.",
    },
  ],
};

describe("migrateCareerSave", () => {
  it("migrates foundation saves through player creation into the weekly loop schema", () => {
    const result = migrateCareerSave(legacySave);
    expect(result.migratedFrom).toBe(1);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.meta.phase).toBe("high-school-preseason");
    expect(result.save.character.identity.fullName.length).toBeGreaterThan(3);
    expect(result.save.football.stage).toBe("high-school-preseason");
    expect(result.save.life.weekNumber).toBe(1);
    expect(result.save.football.roster.length).toBeGreaterThan(40);
    expect(result.save.football.staff.headCoach.name.length).toBeGreaterThan(3);
    expect(result.save.life.weeklyPlan.templateId).toBe("balanced");
    expect(result.save.history.at(-1)?.type).toBe("save-migrated");
  });

  it("migrates version two saves without regenerating the athlete", () => {
    const generated = createFootballCareerState("football-v2-seed", createLegacyFootballSetup("football-v2-seed"));
    const versionTwo = {
      meta: {
        id: "v2-career",
        schemaVersion: 2,
        sport: "american-football",
        worldSeed: "football-v2-seed",
        createdAt: "2026-07-21T10:00:00.000Z",
        updatedAt: "2026-07-21T10:00:00.000Z",
        currentDate: { year: 2026, month: 8, day: 17 },
        phase: "high-school-preseason",
        revision: 2,
      },
      ...generated,
      history: [],
    };
    const result = migrateCareerSave(versionTwo);
    expect(result.migratedFrom).toBe(2);
    expect(result.save.character).toEqual(generated.character);
    expect(result.save.life.completedDays).toBe(0);
  });

  it("migrates version three saves into the generated team world", () => {
    const generated = createFootballCareerState("football-v3-seed", createLegacyFootballSetup("football-v3-seed"));
    const { staff: _staff, roster: _roster, teamDynamics: _teamDynamics, training: _training, ...footballWithoutTeam } = generated.football;
    const { evaluation: _evaluation, lastDecision: _lastDecision, ...legacyDepthChart } = footballWithoutTeam.depthChart;
    const versionThree = {
      meta: {
        id: "v3-career",
        schemaVersion: 3,
        sport: "american-football",
        worldSeed: "football-v3-seed",
        createdAt: "2026-07-21T10:00:00.000Z",
        updatedAt: "2026-07-21T10:00:00.000Z",
        currentDate: { year: 2026, month: 8, day: 17 },
        phase: "high-school-preseason",
        revision: 3,
      },
      character: generated.character,
      life: {
        moduleVersion: 1,
        weekNumber: 1,
        dayIndex: 0,
        completedDays: 0,
        weeklyPlan: {
          templateId: "balanced",
          intensity: "standard",
          focus: { training: 34, recovery: 25, study: 25, social: 16 },
          revision: 1,
        },
        consistency: 58,
      },
      football: { ...footballWithoutTeam, moduleVersion: 2, depthChart: legacyDepthChart },
      history: [],
    };
    const result = migrateCareerSave(versionThree);
    expect(result.migratedFrom).toBe(3);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.roster.length).toBeGreaterThan(40);
    expect(result.save.football.school.primaryColor).toBe("#d7192d");
    expect(result.save.football.training.body.medicalStatus).toBe("cleared");
  });


  it("migrates version four saves into the training and health schema", () => {
    const generated = createFootballCareerState("football-v4-seed", createLegacyFootballSetup("football-v4-seed"));
    const { training: _training, ...legacyFootball } = generated.football;
    const versionFour = {
      meta: {
        id: "v4-career",
        schemaVersion: 4,
        sport: "american-football",
        worldSeed: "football-v4-seed",
        createdAt: "2026-07-21T10:00:00.000Z",
        updatedAt: "2026-07-21T10:00:00.000Z",
        currentDate: { year: 2026, month: 8, day: 17 },
        phase: "high-school-preseason",
        revision: 4,
      },
      character: generated.character,
      life: {
        moduleVersion: 1,
        weekNumber: 1,
        dayIndex: 0,
        completedDays: 0,
        weeklyPlan: {
          templateId: "balanced",
          intensity: "standard",
          focus: { training: 34, recovery: 25, study: 25, social: 16 },
          revision: 1,
        },
        consistency: 58,
      },
      football: { ...legacyFootball, moduleVersion: 3 },
      history: [],
    };
    const result = migrateCareerSave(versionFour);
    expect(result.migratedFrom).toBe(4);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.moduleVersion).toBe(8);
    expect(result.save.football.training.plan.focusId).toBe("position-craft");
    expect(result.save.football.match.status).toBe("upcoming");
  });

  it("migrates version five saves into the match schema", () => {
    const generated = createFootballCareerState("football-v5-seed", createLegacyFootballSetup("football-v5-seed"));
    const { match: _match, ...legacyFootball } = generated.football;
    const versionFive = {
      meta: {
        id: "v5-career",
        schemaVersion: 5,
        sport: "american-football",
        worldSeed: "football-v5-seed",
        createdAt: "2026-07-21T10:00:00.000Z",
        updatedAt: "2026-07-21T10:00:00.000Z",
        currentDate: { year: 2026, month: 8, day: 20 },
        phase: "high-school-preseason",
        revision: 5,
      },
      character: generated.character,
      life: {
        moduleVersion: 1,
        weekNumber: 1,
        dayIndex: 3,
        completedDays: 3,
        weeklyPlan: {
          templateId: "balanced",
          intensity: "standard",
          focus: { training: 34, recovery: 25, study: 25, social: 16 },
          revision: 1,
        },
        consistency: 58,
      },
      football: { ...legacyFootball, moduleVersion: 4 },
      history: [],
    };
    const result = migrateCareerSave(versionFive);
    expect(result.migratedFrom).toBe(5);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.match.status).toBe("upcoming");
    expect(result.save.football.match.heroUnit).toMatch(/offense|defense/);
  });


  it("migrates version six match saves into the full season schema", () => {
    const generated = createFootballCareerState("football-v6-seed", createLegacyFootballSetup("football-v6-seed"));
    const firstOpponent = generated.football.season.opponents[0];
    if (!firstOpponent) throw new Error("No generated opponent");
    const versionSix = {
      meta: {
        id: "v6-career",
        schemaVersion: 6,
        sport: "american-football",
        worldSeed: "football-v6-seed",
        createdAt: "2026-07-21T10:00:00.000Z",
        updatedAt: "2026-07-21T10:00:00.000Z",
        currentDate: { year: 2026, month: 8, day: 20 },
        phase: "high-school-preseason",
        revision: 6,
      },
      character: generated.character,
      life: {
        moduleVersion: 1,
        weekNumber: 1,
        dayIndex: 3,
        completedDays: 3,
        weeklyPlan: {
          templateId: "balanced",
          intensity: "standard",
          focus: { training: 34, recovery: 25, study: 25, social: 16 },
          revision: 1,
        },
        consistency: 58,
      },
      football: {
        ...generated.football,
        moduleVersion: 5,
        season: {
          year: 2026,
          phase: "preseason",
          week: 0,
          wins: 0,
          losses: 0,
          nextOpponent: {
            id: firstOpponent.id,
            name: firstOpponent.name,
            record: "0–0",
            threat: firstOpponent.defenseStyle,
          },
        },
      },
      history: [],
    };
    const result = migrateCareerSave(versionSix);
    expect(result.migratedFrom).toBe(6);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.moduleVersion).toBe(8);
    expect(result.save.football.season.schedule).toHaveLength(8);
    expect(result.save.football.season.standings.length).toBeGreaterThan(8);
  });


  it("migrates version seven seasons into the relationship schema", () => {
    const current = migrateCareerSave(legacySave).save;
    const { relationships: _relationships, ...withoutRelationships } = current;
    const versionSeven = {
      ...withoutRelationships,
      meta: { ...withoutRelationships.meta, schemaVersion: 7 },
    };
    const result = migrateCareerSave(versionSeven);
    expect(result.migratedFrom).toBe(7);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.relationships.npcs).toHaveLength(7);
    expect(result.save.relationships.npcs.every((npc) => typeof npc.relationship === "number")).toBe(true);
  });

  it("migrates version eight relationship saves into recruiting schema", () => {
    const current = migrateCareerSave(legacySave).save;
    const versionEight = {
      ...current,
      meta: { ...current.meta, schemaVersion: 8 },
      football: {
        ...current.football,
        moduleVersion: 6,
        recruitment: {
          visibility: current.football.recruitment.visibility,
          interestedPrograms: 0,
          offers: 0,
          regionalRankLabel: current.football.recruitment.regionalRankLabel,
        },
      },
    };
    const result = migrateCareerSave(versionEight);
    expect(result.migratedFrom).toBe(8);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.moduleVersion).toBe(8);
    expect(result.save.football.recruitment.programs).toHaveLength(24);
  });

  it("migrates version nine recruiting saves into visits and commitment schema", () => {
    const current = migrateCareerSave(legacySave).save;
    const programs = current.football.recruitment.programs.map((program) => {
      const {
        contactQuality: _contactQuality,
        roleClarity: _roleClarity,
        staffTrust: _staffTrust,
        visitStatus: _visitStatus,
        officialVisit: _officialVisit,
        promises: _promises,
        playerRead: _playerRead,
        ...legacyProgram
      } = program;
      return legacyProgram;
    });
    const {
      decommitments: _decommitments,
      commitment: _commitment,
      ...legacyRecruitment
    } = current.football.recruitment;
    const versionNine = {
      ...current,
      meta: { ...current.meta, schemaVersion: 9 },
      football: {
        ...current.football,
        moduleVersion: 7,
        recruitment: { ...legacyRecruitment, moduleVersion: 1, programs },
      },
    };
    const result = migrateCareerSave(versionNine);
    expect(result.migratedFrom).toBe(9);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.moduleVersion).toBe(8);
    expect(result.save.football.recruitment.moduleVersion).toBe(2);
    expect(result.save.football.recruitment.programs[0]?.visitStatus).toBe("none");
  });

  it("migrates version ten saves into the college transition schema", () => {
    const current = migrateCareerSave(legacySave).save;
    const { college: _college, ...legacyFootball } = current.football;
    const versionTen = {
      ...current,
      meta: { ...current.meta, schemaVersion: 10 },
      football: legacyFootball,
    };
    const result = migrateCareerSave(versionTen);
    expect(result.migratedFrom).toBe(10);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.college.status).toBe("high-school");
  });

  it("migrates version eleven saves into the autonomous ecosystem", () => {
    const current = migrateCareerSave(legacySave).save;
    const { world: _world, ...versionElevenBase } = current;
    const versionEleven = {
      ...versionElevenBase,
      meta: { ...versionElevenBase.meta, schemaVersion: 11 },
    };
    const result = migrateCareerSave(versionEleven);
    expect(result.migratedFrom).toBe(11);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.teams.length).toBeGreaterThan(30);
    expect(result.save.world.players.length).toBeGreaterThan(100);
    expect(result.save.world.coaches.length).toBeGreaterThan(30);
  });

  it("migrates version thirteen continuity saves into the world constitution", () => {
    const current = migrateCareerSave(legacySave).save;
    const legacyWorld = {
      ...current.world,
      moduleVersion: 2 as const,
      teams: current.world.teams.map(({ compliance: _compliance, ...team }) => team),
      players: current.world.players.map(({ eligibility: _eligibility, talent: _talent, ...player }) => player),
    };
    const { constitution: _constitution, cycle: _cycle, talentPipeline: _talentPipeline, ...legacyWorldWithoutRules } = legacyWorld;
    const versionThirteen = {
      ...current,
      meta: { ...current.meta, schemaVersion: 13 as const },
      world: legacyWorldWithoutRules,
    };
    const result = migrateCareerSave(versionThirteen);
    expect(result.migratedFrom).toBe(13);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.moduleVersion).toBe(ECOSYSTEM_MODULE_VERSION);
    expect(result.save.world.constitution.collegeRosterLimit).toBe(105);
    expect(result.save.world.players.every((player) => player.eligibility.athleticallyEligible !== undefined)).toBe(true);
    expect(result.save.world.teams.every((team) => team.compliance.rosterLimit > 0)).toBe(true);
  });

  it("migrates version fourteen worlds into finite program resources", () => {
    const current = migrateCareerSave(legacySave).save;
    const legacyTeams = current.world.teams.map(({ resources: _resources, ...team }) => team);
    const legacyPlayers = current.world.players.map(({ talent: _talent, ...player }) => player);
    const {
      totalRecruitingBudget: _totalRecruitingBudget,
      totalNilCapacity: _totalNilCapacity,
      programsUnderFinancialPressure: _programsUnderFinancialPressure,
      annualProspects: _annualProspects,
      jucoProspects: _jucoProspects,
      walkOnProspects: _walkOnProspects,
      nationallyExposedProspects: _nationallyExposedProspects,
      ...legacyMarket
    } = current.world.market;
    const versionFourteen = {
      ...current,
      meta: { ...current.meta, schemaVersion: 14 as const },
      world: (() => {
        const { talentPipeline: _talentPipeline, ...worldWithoutTalent } = current.world;
        return {
        ...worldWithoutTalent,
        moduleVersion: 3 as const,
        teams: legacyTeams,
        players: legacyPlayers,
        market: legacyMarket,
      };
      })(),
    };
    const result = migrateCareerSave(versionFourteen);
    expect(result.migratedFrom).toBe(14);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.moduleVersion).toBe(ECOSYSTEM_MODULE_VERSION);
    expect(result.save.world.teams.every((team) => team.resources.annualBudget > 0)).toBe(true);
    expect(result.save.world.market.totalRecruitingBudget).toBeGreaterThan(0);
  });

  it("migrates version fifteen worlds into the annual talent pipeline", () => {
    const current = migrateCareerSave(legacySave).save;
    const legacyPlayers = current.world.players.map(({ talent: _talent, ...player }) => player);
    const { annualProspects: _annualProspects, jucoProspects: _jucoProspects, walkOnProspects: _walkOnProspects, nationallyExposedProspects: _nationallyExposedProspects, ...legacyMarket } = current.world.market;
    const { talentPipeline: _talentPipeline, ...worldWithoutTalent } = current.world;
    const versionFifteen = {
      ...current,
      meta: { ...current.meta, schemaVersion: 15 as const },
      world: { ...worldWithoutTalent, moduleVersion: 4 as const, players: legacyPlayers, market: legacyMarket },
    };
    const result = migrateCareerSave(versionFifteen);
    expect(result.migratedFrom).toBe(15);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.moduleVersion).toBe(ECOSYSTEM_MODULE_VERSION);
    expect(result.save.world.talentPipeline.regions.length).toBeGreaterThanOrEqual(8);
    expect(result.save.world.players.every((player) => Boolean(player.talent.regionId))).toBe(true);
  });

  it("migrates version sixteen worlds into multi-year roster planning", () => {
    const current = migrateCareerSave(legacySave).save;
    const legacyTeams = current.world.teams.map(({ rosterPlan: _rosterPlan, ...team }) => team);
    const legacyPlayers = current.world.players.map(({ usagePlan: _usagePlan, positionHistory: _positionHistory, ...player }) => player);
    const {
      plannedClassSpots: _plannedClassSpots,
      developmentalPlayers: _developmentalPlayers,
      plannedPositionChanges: _plannedPositionChanges,
      activeNegotiations: _activeNegotiations,
      withdrawnOffers: _withdrawnOffers,
      transferCandidates: _transferCandidates,
      ...legacyMarket
    } = current.world.market;
    const versionSixteen = {
      ...current,
      meta: { ...current.meta, schemaVersion: 16 as const },
      world: {
        ...(() => { const { movementMarket: _movementMarket, ...legacyWorld } = current.world; return legacyWorld; })(),
        moduleVersion: 5 as const,
        teams: legacyTeams,
        players: legacyPlayers,
        market: legacyMarket,
      },
    };
    const result = migrateCareerSave(versionSixteen);
    expect(result.migratedFrom).toBe(16);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.moduleVersion).toBe(ECOSYSTEM_MODULE_VERSION);
    expect(result.save.world.teams.every((team) => team.rosterPlan.planningHorizonYears === 3)).toBe(true);
    expect(result.save.world.players.every((player) => Boolean(player.usagePlan))).toBe(true);
    expect(result.save.world.market.plannedClassSpots).toBeGreaterThan(0);
  });

  it("migrates version seventeen worlds into the unified movement market", () => {
    const current = migrateCareerSave(legacySave).save;
    const { movementMarket: _movementMarket, ...legacyWorld } = current.world;
    const { activeNegotiations: _activeNegotiations, withdrawnOffers: _withdrawnOffers, transferCandidates: _transferCandidates, ...legacyMarket } = current.world.market;
    const versionSeventeen = {
      ...current,
      meta: { ...current.meta, schemaVersion: 17 as const },
      world: { ...legacyWorld, moduleVersion: 6 as const, market: legacyMarket },
    };
    const result = migrateCareerSave(versionSeventeen);
    expect(result.migratedFrom).toBe(17);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.moduleVersion).toBe(ECOSYSTEM_MODULE_VERSION);
    expect(result.save.world.movementMarket.version).toBe(1);
    expect(result.save.world.movementMarket.openings.length).toBeGreaterThan(0);
    expect(result.save.world.market.activeNegotiations).toBe(0);
  });

  it("migrates version eighteen worlds into tactical identities", () => {
    const current = migrateCareerSave(legacySave).save;
    const legacyTeams = current.world.teams.map(({ tactical: _tactical, ...team }) => team);
    const legacyPlayers = current.world.players.map(({ tactical: _tactical, ...player }) => player);
    const { lowSchemeFitPlayers: _lowSchemeFitPlayers, programsInstallingNewSystems: _programsInstallingNewSystems, ...legacyMarket } = current.world.market;
    const versionEighteen = {
      ...current,
      meta: { ...current.meta, schemaVersion: 18 as const },
      world: {
        ...current.world,
        moduleVersion: 7 as const,
        teams: legacyTeams,
        players: legacyPlayers,
        market: legacyMarket,
      },
    };
    const result = migrateCareerSave(versionEighteen);
    expect(result.migratedFrom).toBe(18);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.moduleVersion).toBe(ECOSYSTEM_MODULE_VERSION);
    expect(result.save.world.teams.every((team) => Boolean(team.tactical))).toBe(true);
    expect(result.save.world.players.every((player) => Boolean(player.tactical))).toBe(true);
    expect(result.save.world.market.lowSchemeFitPlayers).toBeGreaterThanOrEqual(0);
  });

  it("migrates version nineteen worlds into the competition ecosystem", () => {
    const current = migrateCareerSave(legacySave).save;
    const { competition: _competition, ...legacyWorld } = current.world;
    const versionNineteen = {
      ...current,
      meta: { ...current.meta, schemaVersion: 19 as const },
      world: { ...legacyWorld, moduleVersion: 8 as const },
    };
    const result = migrateCareerSave(versionNineteen);
    expect(result.migratedFrom).toBe(19);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.moduleVersion).toBe(ECOSYSTEM_MODULE_VERSION);
    expect(result.save.world.competition.schedule).toHaveLength(120);
    expect(result.save.world.competition.rankings).toHaveLength(24);
    expect(result.save.world.competition.rivalries).toHaveLength(12);
  });

  it("produces the same migrated athlete for the same seed", () => {
    expect(migrateCareerSave(legacySave).save.character).toEqual(migrateCareerSave(legacySave).save.character);
  });
});
