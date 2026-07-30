import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { setProfessionalWeekFocus } from "./league";
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
