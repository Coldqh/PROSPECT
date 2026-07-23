import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballEcosystem } from "./createEcosystem";
import {
  advanceUnifiedMovementMarket,
  applyCoachMovementConsequences,
  createUnifiedMovementMarket,
} from "./movementMarket";
import type { EcosystemPlayer, EcosystemTeam } from "./types";

function fixture(seed = "unified-market") {
  const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
  const world = createFootballEcosystem(seed, generated.character, generated.football, { year: 2026, month: 8, day: 17 });
  const target = world.teams.find((team) => team.level === "college");
  const senior = world.players.find((player) => player.level === "high-school" && player.classYear === "Senior" && !player.isHero);
  if (!target || !senior) throw new Error("Unified market fixture is incomplete");
  return { generated, world, target, senior };
}

function isolateOpening(teams: EcosystemTeam[], targetId: string, position: EcosystemPlayer["position"], slots = 1): EcosystemTeam[] {
  return teams.map((team) => {
    if (team.level !== "college") return team;
    const projections = Object.fromEntries(Object.entries(team.rosterPlan.positionProjections).map(([key, projection]) => [key, {
      ...projection,
      targetAdds: team.id === targetId && key === position ? slots : 0,
      needNow: team.id === targetId && key === position ? 96 : 5,
      needNextYear: team.id === targetId && key === position ? 94 : 5,
    }])) as EcosystemTeam["rosterPlan"]["positionProjections"];
    return {
      ...team,
      rosterPlan: {
        ...team.rosterPlan,
        targetClassSize: team.id === targetId ? Math.max(2, slots) : 0,
        positionProjections: projections,
      },
      compliance: {
        ...team.compliance,
        status: "clear",
        estimatedRosterSize: Math.min(team.compliance.rosterLimit - 6, team.compliance.estimatedRosterSize),
        fundedScholarships: Math.max(team.compliance.fundedScholarships, team.compliance.scholarshipsUsed + 4),
      },
    };
  });
}

describe("unified movement market", () => {
  it("uses the same opening for offers and resolves a commitment deterministically", () => {
    const { world, target, senior } = fixture("shared-opening");
    const players = world.players.map((player) => player.id === senior.id ? {
      ...player,
      position: "WR" as const,
      overall: 84,
      potential: 92,
      nationalRank: 90,
      recruitingStage: "offered" as const,
    } : player);
    const teams = isolateOpening(world.teams, target.id, "WR", 1);
    const market = createUnifiedMovementMarket(teams, players, 2026);
    const runWeek = (week: number, currentMarket = market, currentPlayers = players, currentTeams = teams) => advanceUnifiedMovementMarket({
      teams: currentTeams,
      players: currentPlayers,
      coaches: world.coaches,
      talentPipeline: world.talentPipeline,
      movementMarket: currentMarket,
      context: {
        seasonYear: 2026,
        week,
        day: week * 7,
        date: { year: 2026, month: 9, day: 1 + week },
        phase: "regular-season",
        heroPosition: "WR",
        relevantProgramIds: [target.id],
      },
      random: new SeededRandom(`shared-opening:${week}`),
    });
    const weekOne = runWeek(1);
    const weekTwo = runWeek(2, weekOne.movementMarket, weekOne.players, weekOne.teams);
    const committed = weekTwo.players.find((player) => player.id === senior.id);
    expect(weekOne.movementMarket.negotiations.some((item) => item.status === "offered")).toBe(true);
    expect(committed?.committedTeamId).toBe(target.id);
    expect(weekTwo.movementMarket.negotiations.some((item) => item.candidateId.endsWith(senior.id) && item.status === "accepted")).toBe(true);
    expect(runWeek(1)).toEqual(weekOne);
  });

  it("lets a transfer consume the shared slot and reopen a displaced school commitment", () => {
    const { world, target, senior } = fixture("transfer-ripple");
    const source = world.teams.find((team) => team.level === "college" && team.id !== target.id);
    const transfer = world.players.find((player) => player.level === "college" && player.teamId === source?.id && !player.isHero);
    if (!source || !transfer) throw new Error("Transfer fixture is incomplete");
    const players = world.players.map((player) => {
      if (player.id === senior.id) return { ...player, position: "WR" as const, overall: 68, nationalRank: 780, recruitingStage: "committed" as const, committedTeamId: target.id };
      if (player.id === transfer.id) return { ...player, position: "WR" as const, overall: 89, potential: 93, depthRank: 4, usagePlan: "developmental" as const, transferStatus: "portal" as const };
      if (player.level === "college") return { ...player, depthRank: 1, usagePlan: "starter" as const };
      return player;
    });
    const teams = isolateOpening(world.teams, target.id, "WR", 1);
    const market = createUnifiedMovementMarket(teams, players, 2027);
    const result = advanceUnifiedMovementMarket({
      teams,
      players,
      coaches: world.coaches,
      talentPipeline: world.talentPipeline,
      movementMarket: market,
      context: {
        seasonYear: 2027,
        week: 1,
        day: 140,
        date: { year: 2027, month: 1, day: 5 },
        phase: "offseason",
        heroPosition: "WR",
        relevantProgramIds: [target.id],
      },
      random: new SeededRandom("transfer-ripple:market"),
    });
    expect(result.players.find((player) => player.id === transfer.id)?.teamId).toBe(target.id);
    expect(result.players.find((player) => player.id === senior.id)?.committedTeamId).toBeUndefined();
    expect(result.transactions.some((item) => item.kind === "offer-withdrawn" && item.playerId === senior.id)).toBe(true);
  });

  it("tracks a coaching vacancy and closes it after a hire", () => {
    const { world, target } = fixture("coach-market");
    const headCoach = world.coaches.find((coach) => coach.teamId === target.id && coach.role === "head-coach");
    const replacement = world.coaches.find((coach) => coach.teamId !== target.id);
    if (!headCoach || !replacement) throw new Error("Coach fixture is incomplete");
    const context = {
      seasonYear: 2027,
      week: 1,
      day: 150,
      date: { year: 2027, month: 1, day: 15 },
      phase: "offseason" as const,
      heroPosition: "WR" as const,
      relevantProgramIds: [target.id],
    };
    const result = applyCoachMovementConsequences({
      movementMarket: world.movementMarket,
      coachTransactions: [
        { id: "fired", kind: "coach-fired", seasonYear: 2027, week: 1, createdOn: context.date, title: "Увольнение", detail: "Штаб уволен после провала.", coachId: headCoach.id, fromTeamId: target.id, relatedToHero: false },
        { id: "hired", kind: "coach-hired", seasonYear: 2027, week: 1, createdOn: context.date, title: "Назначение", detail: "Новый главный тренер назначен.", coachId: replacement.id, toTeamId: target.id, relatedToHero: false },
      ],
      players: world.players,
      teams: world.teams,
      coaches: world.coaches,
      context,
      random: new SeededRandom("coach-market:reaction"),
    });
    expect(result.movementMarket.coachVacancies.some((vacancy) => vacancy.teamId === target.id && vacancy.status === "filled" && vacancy.hiredCoachId === replacement.id)).toBe(true);
  });
});
