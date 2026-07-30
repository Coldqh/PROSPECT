import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { advanceProfessionalTrainingCamp } from "./draft";
import { acceptProfessionalFreeAgentOffer } from "./league";
import { cloneCareer, draftEligibleCareer, reachCamp, weakenCampProspect } from "./professionalTestFixtures";

let campFixture: CareerSave;

beforeAll(() => {
  campFixture = reachCamp(draftEligibleCareer("professional-camp-free-agent-fixture"));
}, 45_000);

describe("professional camp free agency", () => {
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
});
