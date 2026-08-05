import { SeededRandom } from "../../../../core/random/SeededRandom";
import { professionalStaffRating, professionalTacticalModifier } from "../coaching";
import type { ProfessionalGame, ProfessionalLeagueState, ProfessionalTeam } from "../types";
import { addDays, seasonStart } from "./shared";

export function roundRobinSchedule(teamIds: string[], year: number): ProfessionalGame[] {
  const rotation = [...teamIds];
  const games: ProfessionalGame[] = [];
  const start = seasonStart(year);
  for (let week = 1; week <= teamIds.length - 1; week += 1) {
    for (let index = 0; index < teamIds.length / 2; index += 1) {
      const left = rotation[index]!;
      const right = rotation[rotation.length - 1 - index]!;
      const swap = (week + index) % 2 === 0;
      const homeTeamId = swap ? right : left;
      const awayTeamId = swap ? left : right;
      games.push({
        id: `pro:${year}:w${week}:${awayTeamId}:${homeTeamId}`,
        seasonYear: year,
        week,
        date: addDays(start, (week - 1) * 7),
        homeTeamId,
        awayTeamId,
        status: "scheduled",
      });
    }
    const fixed = rotation[0]!;
    const moving = rotation.slice(1);
    moving.unshift(moving.pop()!);
    rotation.splice(0, rotation.length, fixed, ...moving);
  }
  return games;
}

export function findHeroGame(league: ProfessionalLeagueState, heroTeamId: string | undefined, week = league.week): ProfessionalGame | undefined {
  if (!heroTeamId) return undefined;
  return league.schedule.find((game) => game.week === week && game.status === "scheduled" && (game.homeTeamId === heroTeamId || game.awayTeamId === heroTeamId));
}

export function simulationScore(seed: string, game: ProfessionalGame, home: ProfessionalTeam, away: ProfessionalTeam): { home: number; away: number } {
  const random = new SeededRandom(seed).fork(`pro-game:${game.id}`);
  const homePace = home.tactical?.tempo === "fast" ? 2 : home.tactical?.tempo === "controlled" ? -1 : 0;
  const awayPace = away.tactical?.tempo === "fast" ? 2 : away.tactical?.tempo === "controlled" ? -1 : 0;
  const homeBase = 17 + (home.rosterStrength - 65) * 0.46 + (professionalStaffRating(home) - 65) * .09 + professionalTacticalModifier(home, away) + homePace + random.integer(-9, 10) + 2;
  const awayBase = 17 + (away.rosterStrength - 65) * 0.46 + (professionalStaffRating(away) - 65) * .09 + professionalTacticalModifier(away, home) + awayPace + random.integer(-9, 10);
  let homeScore = Math.max(3, Math.round(homeBase));
  let awayScore = Math.max(3, Math.round(awayBase));
  if (homeScore === awayScore) {
    if (random.chance(0.5)) homeScore += 3;
    else awayScore += 3;
  }
  return { home: homeScore, away: awayScore };
}

export function resolveScheduledGame(seed: string, game: ProfessionalGame, teams: ProfessionalTeam[], forced?: { home: number; away: number }): ProfessionalGame {
  const home = teams.find((team) => team.id === game.homeTeamId);
  const away = teams.find((team) => team.id === game.awayTeamId);
  if (!home || !away) throw new Error("Professional schedule references a missing team");
  const score = forced ?? simulationScore(seed, game, home, away);
  return { ...game, status: "complete", homeScore: score.home, awayScore: score.away };
}

export function applyGameRecords(teams: ProfessionalTeam[], games: ProfessionalGame[]): ProfessionalTeam[] {
  const records = new Map(teams.map((team) => [team.id, { wins: 0, losses: 0 }]));
  for (const game of games.filter((item) => item.status === "complete" && !item.playoffRound)) {
    const home = records.get(game.homeTeamId)!;
    const away = records.get(game.awayTeamId)!;
    if ((game.homeScore ?? 0) > (game.awayScore ?? 0)) home.wins += 1, away.losses += 1;
    else away.wins += 1, home.losses += 1;
  }
  return teams.map((team) => ({ ...team, ...records.get(team.id)! }));
}

export function buildPlayoffWeek(league: ProfessionalLeagueState, teams: ProfessionalTeam[]): ProfessionalGame[] {
  const year = league.seasonYear;
  if (league.week === 15) {
    const qualifiers = (["AFC", "NFC"] as const).flatMap((conference) => teams.filter((team) => team.conference === conference).sort((a, b) => b.wins - a.wins || b.rosterStrength - a.rosterStrength).slice(0, 4));
    const games = (["AFC", "NFC"] as const).flatMap((conference) => {
      const seeds = qualifiers.filter((idOrTeam): idOrTeam is ProfessionalTeam => typeof idOrTeam !== "string" && idOrTeam.conference === conference);
      return [[seeds[0], seeds[3]], [seeds[1], seeds[2]]].map(([home, away], index) => ({
        id: `pro:${year}:w16:${conference}:${index}`,
        seasonYear: year,
        week: 16,
        date: addDays(seasonStart(year), 15 * 7),
        homeTeamId: home!.id,
        awayTeamId: away!.id,
        status: "scheduled" as const,
        playoffRound: "wild-card" as const,
      }));
    });
    return games;
  }
  const currentWeekGames = league.schedule.filter((game) => game.week === league.week && game.status === "complete");
  if (league.week === 16) {
    return (["AFC", "NFC"] as const).map((conference) => {
      const conferenceGames = currentWeekGames.filter((game) => teams.find((team) => team.id === game.homeTeamId)?.conference === conference);
      const winners = conferenceGames.map((game) => (game.homeScore ?? 0) > (game.awayScore ?? 0) ? game.homeTeamId : game.awayTeamId);
      return {
        id: `pro:${year}:w17:${conference}`,
        seasonYear: year,
        week: 17,
        date: addDays(seasonStart(year), 16 * 7),
        homeTeamId: winners[0]!,
        awayTeamId: winners[1]!,
        status: "scheduled" as const,
        playoffRound: "conference" as const,
      };
    });
  }
  if (league.week === 17) {
    const winners = currentWeekGames.map((game) => (game.homeScore ?? 0) > (game.awayScore ?? 0) ? game.homeTeamId : game.awayTeamId);
    return [{
      id: `pro:${year}:w18:championship`,
      seasonYear: year,
      week: 18,
      date: addDays(seasonStart(year), 17 * 7),
      homeTeamId: winners[0]!,
      awayTeamId: winners[1]!,
      status: "scheduled",
      playoffRound: "championship",
    }];
  }
  return [];
}
