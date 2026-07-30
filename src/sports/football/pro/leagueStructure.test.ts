import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { advanceProfessionalWeek, createProfessionalMatchState, isProfessionalMatchAwaitingResolution, setProfessionalWeekFocus } from "./league";
import { callPlay } from "../matches/playbook";
import { expectedHeroSnapShare, heroParticipationForSnap } from "../matches/participation";
import { activeProfessionalCareer, cloneCareer } from "./professionalTestFixtures";

let activeFixture: CareerSave;

beforeAll(() => {
  activeFixture = activeProfessionalCareer("professional-league-structure-fixture");
}, 45_000);

describe("professional league roster and preparation", () => {
  it("creates cap-valid 53-player clubs and a complete regular-season calendar", () => {
    const save = cloneCareer(activeFixture);
    const state = save.football.professional;
    expect(state.league.schedule.filter((game) => !game.playoffRound)).toHaveLength(120);
    expect(state.league.roster.filter((player) => player.status !== "free-agent")).toHaveLength(16 * 53);
    expect(state.teams.every((team) => team.rosterSize === 53)).toBe(true);
    expect(state.teams.every((team) => team.payroll + team.deadCap <= team.salaryCap)).toBe(true);
    expect(state.league.freeAgents.length).toBeGreaterThan(0);
    expect(state.league.transactions.length).toBeGreaterThan(0);
    const draftedNpcIds = new Set(state.draftResults.filter((pick) => !pick.isHero).map((pick) => pick.sourcePlayerId));
    expect(state.league.roster.some((player) => player.sourcePlayerId && draftedNpcIds.has(player.sourcePlayerId))).toBe(true);
  });

  it("gives starters, rotation players and inactive players different package shares", () => {
    const base = cloneCareer(activeFixture);
    expect(base.football.position).toBe("EDGE");
    const game = base.football.professional.league.schedule.find((item) => item.id === base.football.professional.league.activeGameId);
    const career = base.football.professional.heroCareer;
    if (!game || !career) throw new Error("No professional hero game");
    const offenseCall = callPlay("participation-offense", "offense", 1, 10, 35, false);
    const defenseCall = callPlay("participation-defense", "defense", 1, 10, 35, false);
    const counts = new Map<string, number>();
    const shares = new Map<string, number>();
    for (const role of ["starter", "rotation", "special-teams", "inactive"] as const) {
      const save = {
        ...base,
        football: {
          ...base.football,
          professional: {
            ...base.football.professional,
            heroCareer: { ...career, role },
          },
        },
      };
      const match = createProfessionalMatchState(save, game);
      shares.set(role, expectedHeroSnapShare(save, match, offenseCall, defenseCall, true));
      let active = 0;
      for (let snap = 0; snap < 240; snap += 1) {
        if (heroParticipationForSnap(save, match, offenseCall, defenseCall, true, snap).active) active += 1;
      }
      counts.set(role, active);
      expect(match.totalEpisodes).toBe(120);
    }
    expect(shares.get("starter") ?? 0).toBeGreaterThan(shares.get("rotation") ?? 0);
    expect(shares.get("rotation") ?? 0).toBeGreaterThan(shares.get("special-teams") ?? 0);
    expect(counts.get("starter") ?? 0).toBeGreaterThan(counts.get("rotation") ?? 0);
    expect(counts.get("rotation") ?? 0).toBeGreaterThan(counts.get("special-teams") ?? 0);
    expect(counts.get("inactive")).toBe(0);

    const inactive = {
      ...base,
      football: {
        ...base.football,
        professional: {
          ...base.football.professional,
          heroCareer: { ...career, role: "inactive" as const },
        },
      },
    };
    expect(isProfessionalMatchAwaitingResolution(inactive)).toBe(false);
    const inactiveAdvanced = advanceProfessionalWeek(inactive);
    expect(inactiveAdvanced.football.professional.league.week).toBe(base.football.professional.league.week + 1);
    const practice = {
      ...base,
      football: {
        ...base.football,
        professional: {
          ...base.football.professional,
          status: "practice-squad" as const,
          heroCareer: { ...career, role: "practice-squad" as const },
        },
      },
    };
    expect(isProfessionalMatchAwaitingResolution(practice)).toBe(false);
  });

  it("creates specialist opportunities from drives instead of fixed attempt counts", () => {
    const base = cloneCareer(activeFixture);
    const game = base.football.professional.league.schedule.find((item) => item.id === base.football.professional.league.activeGameId);
    const career = base.football.professional.heroCareer;
    if (!game || !career) throw new Error("No professional hero game");
    const offenseCall = callPlay("specialist-offense", "offense", 4, 8, 42, false);
    const defenseCall = callPlay("specialist-defense", "defense", 4, 8, 42, false);
    const shares: number[] = [];
    for (const role of ["starter", "rotation", "special-teams", "inactive"] as const) {
      const save = {
        ...base,
        football: {
          ...base.football,
          position: "K" as const,
          professional: {
            ...base.football.professional,
            heroCareer: { ...career, role },
          },
        },
      };
      const match = createProfessionalMatchState(save, game);
      expect(match.totalEpisodes).toBe(18);
      shares.push(expectedHeroSnapShare(save, match, offenseCall, defenseCall, true));
    }
    expect(shares[0]).toBeGreaterThan(shares[1] ?? 0);
    expect(shares[1]).toBeGreaterThan(shares[3] ?? 0);
    expect(shares[3]).toBe(0);
  });


  it("turns weekly preparation into readiness, health and depth-chart consequences", () => {
    const initial = cloneCareer(activeFixture);
    const before = initial.football.professional.heroCareer;
    if (!before) throw new Error("No professional hero career");
    const prepared = setProfessionalWeekFocus(initial, "competition");
    const after = prepared.football.professional.heroCareer;
    expect(after?.weeklyPlan.resolved).toBe(true);
    expect(after?.weeklyPlan.focus).toBe("competition");
    expect(after?.weeklyPlan.coachTrustDelta).toBeCloseTo((after?.coachTrust ?? before.coachTrust) - before.coachTrust, 5);
    expect(after?.depthRank).toBeGreaterThanOrEqual(1);
    expect(["active", "questionable", "out", "injured-reserve"]).toContain(after?.availability);
    expect(() => setProfessionalWeekFocus(prepared, "recovery")).toThrow();
  });
});
