import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition } from "../career/types";
import {
  careerArchetypeRole,
  createPlayerTacticalProfile,
  createTacticalIdentity,
  refreshTacticalIdentityAfterCoachChange,
  roleFitScore,
  tacticalDevelopmentMultiplier,
  tacticalRecruitingFit,
} from "./tactics";
import type { EcosystemCoach, EcosystemPlayer, EcosystemTeam } from "./types";
import { createPlayerEligibility, createTeamCompliance } from "./constitution";
import { createProgramResources } from "./resources";
import { createEmptyRosterPlan } from "./rosterManagement";
import { createTalentProfile } from "./talent";

function createCoach(seed: string, teamId: string): EcosystemCoach {
  return {
    id: `${teamId}:${seed}`,
    seed,
    name: "Test Coach",
    teamId,
    role: "head-coach",
    age: 46,
    reputation: 74,
    development: 78,
    recruiting: 68,
    pressure: 25,
    jobSecurity: 82,
    status: "secure",
    philosophy: "Стабильная схема и развитие игроков",
    tenureYears: 4,
    careerWins: 61,
    careerLosses: 29,
    previousTeamIds: [],
  };
}

function createTeam(seed = "tactical-team", offenseStyle = "Air raid", defenseStyle = "4-2-5 quarters"): EcosystemTeam {
  const random = new SeededRandom(seed);
  const base = {
    id: seed,
    seed,
    name: "Tactical State",
    shortName: "TAC",
    level: "college" as const,
    stateCode: "TX",
    conferenceId: "conference-test",
    prestige: 78,
    rating: 76,
    expectation: 72,
    wins: 0,
    losses: 0,
    conferenceWins: 0,
    conferenceLosses: 0,
    streak: 0,
    championships: 0,
    offenseStyle,
    defenseStyle,
    positionNeeds: { QB: 65, RB: 65, WR: 65, LB: 65, CB: 65 },
    rosterIds: [] as string[],
    coachIds: [] as string[],
    trend: "stable" as const,
  };
  const coach = createCoach(`${seed}:coach`, seed);
  const compliance = createTeamCompliance(base, 0, random.fork("compliance"));
  const resources = createProgramResources(base, random.fork("resources"), 2026);
  const teamWithoutPlan = { ...base, compliance, resources };
  return {
    ...teamWithoutPlan,
    coachIds: [coach.id],
    rosterPlan: createEmptyRosterPlan(teamWithoutPlan, 2026),
    tactical: createTacticalIdentity(base, coach, random.fork("tactical")),
  };
}

function createPlayer(team: EcosystemTeam, position: FootballPosition = "WR"): EcosystemPlayer {
  const seed = `${team.seed}:player:${position}`;
  const random = new SeededRandom(seed);
  const base = {
    id: seed,
    seed,
    name: "Tactical Prospect",
    teamId: team.id,
    level: "college" as const,
    age: 19,
    classYear: "Freshman" as const,
    position,
    overall: 72,
    potential: 88,
    health: 94,
    form: 70,
    status: "rotation" as const,
    depthRank: 2,
    trajectory: "steady" as const,
    nationalRank: 240,
    recruitingStage: "committed" as const,
    eligibilityYears: 5,
    seasonsPlayed: 0,
    transferStatus: "none" as const,
    previousTeamIds: [] as string[],
    isHero: false,
    eligibility: createPlayerEligibility("college", 19, "Freshman", 2027, random.fork("eligibility")),
    talent: createTalentProfile({ level: "college", classYear: "Freshman", overall: 72, potential: 88, nationalRank: 240, isHero: false }, "TX", 2027, random.fork("talent")),
    usagePlan: "developmental" as const,
    positionHistory: [] as FootballPosition[],
  };
  return {
    ...base,
    tactical: createPlayerTacticalProfile(base, team.tactical, random.fork("tactical")),
  };
}

describe("tactical identity", () => {
  it("creates the same system for the same program and seed", () => {
    expect(createTeam()).toEqual(createTeam());
  });

  it("keeps the hero career archetype inside the ecosystem", () => {
    expect(careerArchetypeRole("WR", "route-technician")).toBe("separator");
    expect(careerArchetypeRole("LB", "edge-hunter")).toBe("edge-blitzer");
    expect(careerArchetypeRole("QB", "dual-threat")).toBe("dual-threat");
  });

  it("values a primary scheme role above an unrelated role", () => {
    const team = createTeam();
    const target = team.tactical.positionRoles.WR;
    const unrelated = target.primary === "power-back" ? "zone-corner" : "power-back";
    const primaryFit = roleFitScore(target.primary, target.secondary, team.tactical, "WR");
    const unrelatedFit = roleFitScore(unrelated, "run-anchor", team.tactical, "WR");
    expect(primaryFit).toBeGreaterThan(unrelatedFit);
    expect(tacticalRecruitingFit("WR", target.primary, target.secondary, team)).toBe(primaryFit);
  });

  it("makes development depend on scheme fit and playbook installation", () => {
    const team = createTeam();
    const player = createPlayer(team);
    const highFit = {
      ...player,
      tactical: { ...player.tactical, schemeFit: 92, roleFit: 96 },
    };
    const lowFit = {
      ...player,
      tactical: { ...player.tactical, schemeFit: 38, roleFit: 48 },
    };
    expect(tacticalDevelopmentMultiplier(highFit, team)).toBeGreaterThan(tacticalDevelopmentMultiplier(lowFit, team));
  });

  it("resets installation and continuity after a coaching change", () => {
    const team = createTeam();
    const nextCoach = createCoach("new-coach-system", team.id);
    const changed = refreshTacticalIdentityAfterCoachChange(team, nextCoach, 2028);
    expect(changed.tactical.headCoachFingerprint).toBe(nextCoach.seed);
    expect(changed.tactical.continuity).toBeLessThan(team.tactical.continuity);
    expect(changed.tactical.installation).toBeLessThanOrEqual(82);
  });
});
