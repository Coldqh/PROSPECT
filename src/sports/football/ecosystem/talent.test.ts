import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { createPlayerEligibility, createTeamCompliance, createWorldConstitution } from "./constitution";
import { createProgramResources } from "./resources";
import { createEmptyRosterPlan } from "./rosterManagement";
import { createUnifiedMovementMarket } from "./movementMarket";
import { ECOSYSTEM_MODULE_VERSION } from "./types";
import { createTalentPipeline, createTalentProfile, processAnnualTalentFlow, simulateTalentCamps } from "./talent";
import { createPlayerTacticalProfile, createTacticalIdentity } from "./tactics";
import type { EcosystemPlayer, EcosystemTeam, FootballEcosystemState } from "./types";

function createTeam(id: string, level: EcosystemTeam["level"], stateCode: string): EcosystemTeam {
  const random = new SeededRandom(id);
  const base = {
    id,
    seed: id,
    name: id,
    shortName: id.slice(0, 4),
    level,
    stateCode,
    prestige: level === "college" ? 78 : 65,
    rating: level === "college" ? 76 : 68,
    expectation: 70,
    wins: 0,
    losses: 0,
    conferenceWins: 0,
    conferenceLosses: 0,
    streak: 0,
    championships: 0,
    offenseStyle: "Spread option",
    defenseStyle: "4-2-5 pressure",
    positionNeeds: { QB: 70, RB: 70, WR: 70, LB: 70, CB: 70 },
    rosterIds: [],
    coachIds: [],
    trend: "stable" as const,
  };
  const compliance = createTeamCompliance(base, 0, random.fork("compliance"));
  const resources = createProgramResources(base, random.fork("resources"), 2026);
  return {
    ...base,
    compliance,
    resources,
    rosterPlan: createEmptyRosterPlan({ ...base, compliance }, 2026),
    tactical: createTacticalIdentity(base, undefined, random.fork("tactical")),
  };
}

function createSenior(team: EcosystemTeam): EcosystemPlayer {
  const random = new SeededRandom("unsigned-senior");
  const player = {
    id: "unsigned-senior",
    seed: "unsigned-senior",
    name: "Test Senior",
    teamId: team.id,
    level: "high-school" as const,
    age: 18,
    classYear: "Senior" as const,
    position: "WR" as const,
    overall: 72,
    potential: 84,
    health: 90,
    form: 67,
    status: "starter" as const,
    depthRank: 1,
    trajectory: "steady" as const,
    nationalRank: 700,
    recruitingStage: "tracked" as const,
    eligibilityYears: 4,
    seasonsPlayed: 0,
    transferStatus: "none" as const,
    previousTeamIds: [],
    isHero: false,
    eligibility: createPlayerEligibility("high-school", 18, "Senior", 2026, random.fork("eligibility")),
    usagePlan: "starter" as const,
    positionHistory: [],
  };
  return {
    ...player,
    tactical: createPlayerTacticalProfile(player, team.tactical, random.fork("tactical")),
    talent: {
      ...createTalentProfile(player, team.stateCode, 2026, random.fork("talent")),
      academicProjection: 50,
    },
  };
}

function createWorld(team: EcosystemTeam, college: EcosystemTeam, senior: EcosystemPlayer): FootballEcosystemState {
  const talentPipeline = createTalentPipeline([senior], 2026);
  return {
    moduleVersion: ECOSYSTEM_MODULE_VERSION,
    constitution: createWorldConstitution(),
    cycle: { academicYear: 2026, seasonYear: 2026, phase: "winter-evaluation", phaseWeek: 1 },
    lastSimulatedDay: 0,
    currentWeek: 1,
    lastUpdatedOn: { year: 2026, month: 8, day: 17 },
    seasonYear: 2026,
    seasonWeek: 1,
    phase: "offseason",
    lastOffseasonYear: 2025,
    conferences: [],
    teams: [team, college],
    players: [senior],
    coaches: [],
    stories: [],
    digest: [],
    market: {
      openScholarships: 10,
      activeRecruitments: 1,
      committedPlayers: 0,
      coachingHotSeats: 0,
      portalPlayers: 0,
      coachOpenings: 0,
      totalRecruitingBudget: college.resources.recruitingBudget,
      totalNilCapacity: college.resources.nilCapacity,
      programsUnderFinancialPressure: 0,
      annualProspects: 1,
      jucoProspects: 0,
      walkOnProspects: 0,
      nationallyExposedProspects: 0,
      plannedClassSpots: college.rosterPlan.targetClassSize,
      developmentalPlayers: 0,
      plannedPositionChanges: 0,
      activeNegotiations: 0,
      withdrawnOffers: 0,
      transferCandidates: 0,
      lowSchemeFitPlayers: 0,
      programsInstallingNewSystems: 0,
    },
    teamHistory: [],
    transactions: [],
    talentPipeline,
    movementMarket: createUnifiedMovementMarket([team, college], [senior], 2026),
  };
}

describe("annual talent pipeline", () => {
  it("generates the same freshman class for the same seed", () => {
    const school = createTeam("high-school-tx", "high-school", "TX");
    const college = createTeam("college-oh", "college", "OH");
    const senior = createSenior(school);
    const world = createWorld(school, college, senior);
    const run = () => processAnnualTalentFlow(
      world,
      [],
      [school, college],
      [senior],
      2027,
      new SeededRandom("annual-flow"),
      college.id,
    );
    expect(run()).toEqual(run());
    const result = run();
    expect(result.players.filter((player) => player.level === "high-school" && player.classYear === "Freshman")).toHaveLength(5);
    expect(result.pipeline.independentProspects.some((prospect) => prospect.route === "juco")).toBe(true);
    expect(result.pipeline.classHistory.some((record) => record.seasonYear === 2027)).toBe(true);
  });

  it("runs regional camps once per season and changes exposure", () => {
    const school = createTeam("high-school-tx", "high-school", "TX");
    const senior = createSenior(school);
    const junior = {
      ...senior,
      id: "junior-prospect",
      seed: "junior-prospect",
      age: 17,
      classYear: "Junior" as const,
      talent: { ...senior.talent, campExposure: 20, scoutingGrade: 70 },
    };
    const pipeline = createTalentPipeline([junior], 2026);
    const result = simulateTalentCamps(
      pipeline,
      [junior],
      { academicYear: 2026, seasonYear: 2026, phase: "summer-recruiting", phaseWeek: 2 },
      new SeededRandom("camp"),
      school.id,
    );
    expect(result.pipeline.camps.some((camp) => camp.lastHeldSeasonYear === 2026)).toBe(true);
    expect(result.players[0]?.talent.campExposure).toBeGreaterThanOrEqual(junior.talent.campExposure);
  });
});
