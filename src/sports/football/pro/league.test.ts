import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { startMatch } from "../matches/simulateMatch";
import { finalizeProfessionalMatch, professionalStandings } from "./league";
import { activeProfessionalCareer, cloneCareer } from "./professionalTestFixtures";

let activeFixture: CareerSave;

beforeAll(() => {
  activeFixture = activeProfessionalCareer("professional-interactive-match-fixture");
}, 45_000);

describe("professional real-time match kernel", () => {
  it("runs the hero professional game through the real-time match kernel", () => {
    let save = cloneCareer(activeFixture);
    const firstGameId = save.football.professional.league.activeGameId;
    expect(firstGameId).toBe(save.football.match.gameId);
    save = startMatch(save, "auto", false);
    expect(save.football.match.status).toBe("complete");
    save = finalizeProfessionalMatch(save);
    expect(save.football.professional.heroCareer?.gamesPlayed).toBe(1);
    expect(save.football.professional.heroCareer?.gameLog).toHaveLength(1);
    expect(save.football.professional.league.week).toBe(2);
    expect(save.football.professional.teams.reduce((sum, team) => sum + team.wins, 0)).toBe(8);
    expect(professionalStandings(save.football.professional.teams)[0]?.wins).toBeGreaterThanOrEqual(1);
  });
});
