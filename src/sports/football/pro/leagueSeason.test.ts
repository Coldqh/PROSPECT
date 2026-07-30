import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { startMatch } from "../matches/simulateMatch";
import {
  advanceProfessionalOffseason,
  advanceProfessionalWeek,
  finalizeProfessionalMatch,
  isProfessionalMatchAwaitingResolution,
} from "./league";
import { activeProfessionalCareer, cloneCareer } from "./professionalTestFixtures";

let activeFixture: CareerSave;

beforeAll(() => {
  activeFixture = activeProfessionalCareer("professional-complete-season-fixture");
}, 45_000);

describe("professional complete season", () => {
  it("resolves a complete professional season and seven-game playoff", () => {
    let save = cloneCareer(activeFixture);
    let safety = 0;
    while (save.football.professional.league.phase !== "complete" && safety < 25) {
      if (isProfessionalMatchAwaitingResolution(save)) {
        save = finalizeProfessionalMatch(startMatch(save, "auto", false));
      } else {
        save = advanceProfessionalWeek(save);
      }
      safety += 1;
    }
    const league = save.football.professional.league;
    expect(league.phase).toBe("complete");
    expect(league.championTeamId).toBeDefined();
    expect(league.schedule.filter((game) => game.status === "complete" && !game.playoffRound)).toHaveLength(120);
    expect(league.schedule.filter((game) => game.status === "complete" && game.playoffRound)).toHaveLength(7);
    expect(save.football.professional.teams.every((team) => team.wins + team.losses === 15)).toBe(true);

    const completedSeasonYear = league.seasonYear;
    const careerGames = save.football.professional.heroCareer?.gamesPlayed ?? 0;
    save = advanceProfessionalOffseason(save);
    const nextLeague = save.football.professional.league;
    expect(nextLeague.seasonYear).toBe(completedSeasonYear + 1);
    expect(nextLeague.phase).toBe("regular-season");
    expect(nextLeague.schedule).toHaveLength(120);
    expect(save.football.professional.teams.every((team) => team.rosterSize === 53)).toBe(true);
    expect(save.football.professional.teams.every((team) => team.payroll + team.deadCap <= team.salaryCap)).toBe(true);
    expect(save.football.professional.heroCareer?.gamesPlayed ?? 0).toBe(careerGames);
  });
});
