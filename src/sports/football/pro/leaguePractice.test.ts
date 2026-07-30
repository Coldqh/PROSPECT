import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { advanceProfessionalWeek } from "./league";
import { activeProfessionalCareer, cloneCareer } from "./professionalTestFixtures";

let activeFixture: CareerSave;

beforeAll(() => {
  activeFixture = activeProfessionalCareer("professional-practice-squad-fixture");
}, 45_000);

describe("professional practice squad week", () => {
  it("advances a practice-squad week while the autonomous league resolves every game", () => {
    const active = cloneCareer(activeFixture);
    const career = active.football.professional.heroCareer;
    if (!career) throw new Error("No professional hero career");
    let save: CareerSave = {
      ...active,
      football: {
        ...active.football,
        professional: {
          ...active.football.professional,
          status: "practice-squad",
          heroCareer: { ...career, role: "practice-squad" },
          league: { ...active.football.professional.league, activeGameId: undefined },
        },
      },
    };
    save = advanceProfessionalWeek(save);
    expect(save.football.professional.league.week).toBe(2);
    expect(save.football.professional.teams.reduce((sum, team) => sum + team.wins, 0)).toBe(8);
    expect(save.football.professional.heroCareer?.coachTrust).toBeGreaterThanOrEqual(0);
  });
});
