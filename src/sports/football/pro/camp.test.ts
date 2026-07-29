import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { advanceProfessionalTrainingCamp } from "./draft";
import { acceptProfessionalFreeAgentOffer, setProfessionalWeekFocus } from "./league";
import {
  activateProfessionalCareer,
  cloneCareer,
  draftEligibleCareer,
  reachCamp,
  weakenCampProspect,
} from "./professionalTestFixtures";

let campFixture: CareerSave;
let activeFixture: CareerSave;

beforeAll(() => {
  campFixture = reachCamp(draftEligibleCareer("professional-shared-camp-fixture"));
  activeFixture = activateProfessionalCareer(cloneCareer(campFixture));
}, 45_000);

describe("professional camp and roster ecosystem", () => {
  it("turns camp performance into a persistent roster decision", () => {
    let save = cloneCareer(campFixture);
    for (let day = 0; day < 4; day += 1) save = advanceProfessionalTrainingCamp(save, "balanced");
    expect(["roster", "practice-squad", "free-agent"]).toContain(save.football.professional.status);
    expect(save.football.professional.camp?.sessions).toHaveLength(4);
    expect(save.football.professional.camp?.outcome).toBeDefined();
    expect(save.football.professional.contract?.teamId).toBe(save.football.professional.camp?.teamId);
    expect(save.football.professional.contract?.agentFee).toBeGreaterThan(0);
    expect(save.meta.phase).toBe("professional-career");
    expect(save.football.stage).toBe("professional-career");
  });

  it("lets a released athlete sign without breaking the 53-player active roster", () => {
    let save = weakenCampProspect(cloneCareer(campFixture));
    for (let day = 0; day < 4; day += 1) save = advanceProfessionalTrainingCamp(save, "aggressive");
    expect(save.football.professional.status).toBe("free-agent");
    const offer = save.football.professional.campInvites[0];
    if (!offer) throw new Error("No free-agent offer");
    save = acceptProfessionalFreeAgentOffer(save, offer.teamId);
    expect(["roster", "practice-squad"]).toContain(save.football.professional.status);
    expect(save.football.professional.heroCareer?.teamId).toBe(offer.teamId);
    expect(save.football.professional.teams.every((team) => team.rosterSize === 53)).toBe(true);
  });

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
