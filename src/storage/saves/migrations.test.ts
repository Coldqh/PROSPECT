import { describe, expect, it } from "vitest";
import { createFootballCareerState, createLegacyFootballSetup } from "../../sports/football/career/createFootballCareer";
import { migrateCareerSave } from "./migrations";
import { CURRENT_SCHEMA_VERSION } from "./schema";
import { ECOSYSTEM_MODULE_VERSION } from "../../sports/football/ecosystem/types";
import { FOOTBALL_ROSTER_POSITIONS, POSITION_ROOM_TARGETS } from "../../sports/football/team/positions";

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

  it("migrates version twenty worlds into the social ecosystem", () => {
    const current = migrateCareerSave(legacySave).save;
    const { social: _social, ...legacyWorld } = current.world;
    const versionTwenty = {
      ...current,
      meta: { ...current.meta, schemaVersion: 20 as const },
      world: { ...legacyWorld, moduleVersion: 9 as const },
    };
    const result = migrateCareerSave(versionTwenty);
    expect(result.migratedFrom).toBe(20);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.moduleVersion).toBe(ECOSYSTEM_MODULE_VERSION);
    expect(result.save.world.social.teamCultures).toHaveLength(result.save.world.teams.length);
    expect(result.save.world.social.bonds.length).toBeGreaterThan(result.save.world.teams.length);
    expect(result.save.world.social.bonds.every((bond) => bond.active)).toBe(true);
  });

  it("migrates version twenty-two college careers into multi-year progression", () => {
    const current = migrateCareerSave(legacySave).save;
    const collegeTeam = current.world.teams.find((team) => team.level === "college");
    if (!collegeTeam) throw new Error("No college team");
    const versionTwentyTwo = {
      ...current,
      meta: { ...current.meta, schemaVersion: 22 as const, phase: "college-season" as const },
      football: {
        ...current.football,
        stage: "college-season" as const,
        college: {
          ...current.football.college,
          status: "active" as const,
          signedProgramId: collegeTeam.id,
          heroCareer: {
            version: 1 as const,
            teamId: collegeTeam.id,
            seasonYear: current.world.seasonYear,
            week: 4,
            role: "rotation" as const,
            depthRank: 2,
            coachTrust: 61,
            lockerRoomStanding: 54,
            practiceReps: 48,
            weeklyPracticeGrade: "B" as const,
            seasonSnaps: 88,
            gamesPlayed: 4,
            starts: 1,
            redshirtStatus: "active" as const,
            transferIntent: "stay" as const,
            promises: [],
            gameLog: [],
            weekLog: [],
            lastSummary: "Сезон продолжается.",
          },
        },
      },
    };
    const result = migrateCareerSave(versionTwentyTwo);
    expect(result.migratedFrom).toBe(22);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.college.heroCareer?.version).toBe(2);
    expect(result.save.football.college.heroCareer?.careerSnaps).toBe(0);
    expect(result.save.football.college.heroCareer?.seasonOverallStart).toBe(result.save.football.ratings.overall);
    expect(result.save.football.college.heroCareer?.seasonHistory).toEqual([]);
  });

  it("migrates version twenty-one saves into the active hero schema", () => {
    const current = migrateCareerSave(legacySave).save;
    const versionTwentyOne = {
      ...current,
      meta: { ...current.meta, schemaVersion: 21 as const },
    };
    const result = migrateCareerSave(versionTwentyOne);
    expect(result.migratedFrom).toBe(21);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.college.heroCareer).toBeUndefined();
    expect(result.save.history.at(-1)?.title).toBe("Герой вернулся в живой мир");
  });



  it("migrates version twenty-eight saves into the hero control schema", () => {
    const current = migrateCareerSave(legacySave).save;
    const { heroControlMode: _heroControlMode, ...legacyMatch } = current.football.match;
    const legacyRoster = current.football.professional.league.roster.map(({ availability: _availability, injuryWeeks: _injuryWeeks, ...player }) => player);
    const legacyFreeAgents = current.football.professional.league.freeAgents.map(({ availability: _availability, injuryWeeks: _injuryWeeks, ...player }) => player);
    const heroCareer = current.football.professional.heroCareer;
    const legacyHeroCareer = heroCareer ? (({ availability: _availability, weeklyPlan: _weeklyPlan, ...career }) => career)(heroCareer) : undefined;
    const versionTwentyEight = {
      ...current,
      meta: { ...current.meta, schemaVersion: 28 as const },
      football: {
        ...current.football,
        match: legacyMatch,
        professional: {
          ...current.football.professional,
          league: { ...current.football.professional.league, roster: legacyRoster, freeAgents: legacyFreeAgents },
          heroCareer: legacyHeroCareer,
        },
      },
    };
    const result = migrateCareerSave(versionTwentyEight);
    expect(result.migratedFrom).toBe(28);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.match.heroControlMode).toBe("assisted");
    expect(result.save.football.professional.league.roster.every((player) => player.availability === "active" && player.injuryWeeks === 0)).toBe(true);
    expect(result.save.history.at(-1)?.title).toBe("Управление игроком обновлено");
  });

  it("migrates version twenty-seven saves into the professional league schema", () => {
    const current = migrateCareerSave(legacySave).save;
    const { league: _league, heroCareer: _heroCareer, ...professionalWithoutLeague } = current.football.professional;
    const legacyTeams = professionalWithoutLeague.teams.map(({ salaryCap: _salaryCap, payroll: _payroll, deadCap: _deadCap, rosterSize: _rosterSize, ...team }) => team);
    const versionTwentySeven = {
      ...current,
      meta: { ...current.meta, schemaVersion: 27 as const },
      football: {
        ...current.football,
        professional: {
          ...professionalWithoutLeague,
          version: 1 as const,
          teams: legacyTeams,
        },
      },
    };
    const result = migrateCareerSave(versionTwentySeven);
    expect(result.migratedFrom).toBe(27);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.professional.version).toBe(2);
    expect(result.save.football.professional.teams).toHaveLength(16);
    expect(result.save.football.professional.teams.every((team) => team.salaryCap > 0)).toBe(true);
    expect(result.save.football.professional.league.schedule).toEqual([]);
    expect(result.save.history.at(-1)?.title).toBe("Профессиональная лига запущена");
  });

  it("migrates version twenty-six saves into the rebuilt match experience", () => {
    const current = migrateCareerSave(legacySave).save;
    const {
      participationMode: _participationMode,
      analysisMode: _analysisMode,
      lastResolvedEpisode: _lastResolvedEpisode,
      lastResolvedResult: _lastResolvedResult,
      ...legacyMatch
    } = current.football.match;
    const versionTwentySix = {
      ...current,
      meta: { ...current.meta, schemaVersion: 26 as const },
      football: { ...current.football, match: legacyMatch },
    };
    const result = migrateCareerSave(versionTwentySix);
    expect(result.migratedFrom).toBe(26);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.match.participationMode).toBe("key-moments");
    expect(result.save.football.match.analysisMode).toBe(false);
    expect(result.save.football.match.lastResolvedEpisode).toBeUndefined();
    expect(result.save.football.match.lastResolvedResult).toBeUndefined();
    expect(result.save.history.at(-1)?.title).toBe("Матчевый опыт обновлён");
  });

  it("migrates version twenty-five saves into all-position career statistics", () => {
    const current = migrateCareerSave(legacySave).save;
    const stripStats = (stats: typeof current.football.match.stats) => {
      const {
        sacksAllowed: _sacksAllowed,
        pressuresAllowed: _pressuresAllowed,
        pancakes: _pancakes,
        hurries: _hurries,
        runStops: _runStops,
        coverageSnaps: _coverageSnaps,
        fieldGoalsAttempted: _fieldGoalsAttempted,
        fieldGoalsMade: _fieldGoalsMade,
        longestFieldGoal: _longestFieldGoal,
        punts: _punts,
        puntYards: _puntYards,
        puntsInside20: _puntsInside20,
        returnYardsAllowed: _returnYardsAllowed,
        ...legacy
      } = stats;
      return legacy;
    };
    const stripAdvanced = (stats: typeof current.football.match.advancedStats) => {
      const {
        passProtectionWins: _passProtectionWins,
        runBlockWins: _runBlockWins,
        doubleTeamWins: _doubleTeamWins,
        kickQuality: _kickQuality,
        puntQuality: _puntQuality,
        ...legacy
      } = stats;
      return legacy;
    };
    const versionTwentyFive = {
      ...current,
      meta: { ...current.meta, schemaVersion: 25 as const },
      football: {
        ...current.football,
        match: {
          ...current.football.match,
          stats: stripStats(current.football.match.stats),
          advancedStats: stripAdvanced(current.football.match.advancedStats),
          completedEpisodes: current.football.match.completedEpisodes.map((episode) => ({
            ...episode,
            statDelta: stripStats(episode.statDelta),
            advancedDelta: stripAdvanced(episode.advancedDelta),
          })),
        },
        season: { ...current.football.season, heroTotals: stripStats(current.football.season.heroTotals) },
      },
    };
    const result = migrateCareerSave(versionTwentyFive);
    expect(result.migratedFrom).toBe(25);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.match.stats.fieldGoalsAttempted).toBe(0);
    expect(result.save.football.match.stats.sacksAllowed).toBe(0);
    expect(result.save.football.match.advancedStats.passProtectionWins).toBe(0);
    expect(result.save.history.at(-1)?.title).toBe("Карьера всех позиций подключена");
  });

  it("migrates version twenty-four saves into complete football rosters", () => {
    const current = migrateCareerSave(legacySave).save;
    const versionTwentyFour = {
      ...current,
      meta: { ...current.meta, schemaVersion: 24 as const },
      world: {
        ...current.world,
        moduleVersion: 10 as const,
        players: current.world.players
          .filter((player) => player.position !== "K" && player.position !== "P")
          .map((player) => ({
            ...player,
            position: ["OT", "OG", "C"].includes(player.position)
              ? "OL"
              : ["EDGE", "DT"].includes(player.position)
                ? "DL"
                : player.position === "TE"
                  ? "WR"
                  : player.position === "S"
                    ? "CB"
                    : player.position,
          })),
      },
    };
    const result = migrateCareerSave(versionTwentyFour);
    expect(result.migratedFrom).toBe(24);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.world.moduleVersion).toBe(ECOSYSTEM_MODULE_VERSION);
    for (const team of result.save.world.teams) {
      const roster = result.save.world.players.filter((player) => player.teamId === team.id);
      for (const position of FOOTBALL_ROSTER_POSITIONS) {
        expect(roster.filter((player) => player.position === position && !player.isHero).length).toBeGreaterThanOrEqual(
          POSITION_ROOM_TARGETS[team.level][position],
        );
      }
    }
    for (const position of FOOTBALL_ROSTER_POSITIONS) {
      expect(result.save.football.roster.filter((player) => player.position === position).length).toBeGreaterThanOrEqual(
        POSITION_ROOM_TARGETS["high-school"][position],
      );
    }
  });

  it("migrates version twenty-three saves into the professional market", () => {
    const current = migrateCareerSave(legacySave).save;
    const { professional: _professional, ...legacyFootball } = current.football;
    const versionTwentyThree = {
      ...current,
      meta: { ...current.meta, schemaVersion: 23 as const },
      football: legacyFootball,
    };
    const result = migrateCareerSave(versionTwentyThree);
    expect(result.migratedFrom).toBe(23);
    expect(result.save.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.save.football.professional.status).toBe("dormant");
    expect(result.save.football.professional.teams).toHaveLength(16);
    expect(result.save.football.professional.agents.length).toBeGreaterThanOrEqual(3);
  });

  it("produces the same migrated athlete for the same seed", () => {
    expect(migrateCareerSave(legacySave).save.character).toEqual(migrateCareerSave(legacySave).save.character);
  });
});
