import { beforeAll, describe, expect, it } from "vitest";
import type { CareerSave } from "../../../storage/saves/schema";
import { startMatch } from "../matches/simulateMatch";
import {
  advanceProfessionalOffseason,
  advanceProfessionalWeek,
  finalizeProfessionalMatch,
  isProfessionalMatchAwaitingResolution,
  professionalStandings,
} from "./league";
import {
  activateProfessionalCareer,
  cloneCareer,
  draftEligibleCareer,
  reachCamp,
} from "./professionalTestFixtures";

let activeFixture: CareerSave;

beforeAll(() => {
  activeFixture = activateProfessionalCareer(reachCamp(draftEligibleCareer("professional-shared-league-fixture")));
}, 45_000);

describe("professional league integration", () => {
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
