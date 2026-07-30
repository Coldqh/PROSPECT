import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { advanceProfessionalTrainingCamp } from "./draft";
import { cloneCareer, draftEligibleCareer, reachCamp } from "./professionalTestFixtures";

let campFixture: CareerSave;

beforeAll(() => {
  campFixture = reachCamp(draftEligibleCareer("professional-camp-decision-fixture"));
}, 45_000);

describe("professional camp roster decision", () => {
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
});
