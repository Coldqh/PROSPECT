import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { createProfessionalMatchState, isProfessionalMatchAwaitingResolution, setProfessionalWeekFocus } from "./league";
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

  it("gives starters, rotation players and the bench different participation", () => {
    const base = cloneCareer(activeFixture);
    const game = base.football.professional.league.schedule.find((item) => item.id === base.football.professional.league.activeGameId);
    const career = base.football.professional.heroCareer;
    if (!game || !career) throw new Error("No professional hero game");
    const cases = [
      { role: "starter" as const, quarter: 1, snaps: 64 },
      { role: "rotation" as const, quarter: 2, snaps: 30 },
      { role: "special-teams" as const, quarter: 3, snaps: 10 },
      { role: "inactive" as const, quarter: 4, snaps: 1 },
    ];
    for (const item of cases) {
      const save = {
        ...base,
        football: {
          ...base.football,
          professional: {
            ...base.football.professional,
            heroCareer: { ...career, role: item.role },
          },
        },
      };
      const match = createProfessionalMatchState(save, game);
      expect(match.entryQuarter).toBe(item.quarter);
      expect(match.totalEpisodes).toBe(item.snaps);
      if (item.role === "inactive") {
        const inactive = { ...save, football: { ...save.football, match } };
        expect(isProfessionalMatchAwaitingResolution(inactive)).toBe(false);
      }
    }
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
