import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import type { FootballMatchState, MatchStatLine } from "../matches/types";
import type { FootballSeasonState, SeasonAward, SeasonStanding } from "./types";

function addStats(left: MatchStatLine, right: MatchStatLine): MatchStatLine {
  return {
    passingAttempts: left.passingAttempts + right.passingAttempts,
    completions: left.completions + right.completions,
    passingYards: left.passingYards + right.passingYards,
    rushingAttempts: left.rushingAttempts + right.rushingAttempts,
    rushingYards: left.rushingYards + right.rushingYards,
    targets: left.targets + right.targets,
    receptions: left.receptions + right.receptions,
    receivingYards: left.receivingYards + right.receivingYards,
    touchdowns: left.touchdowns + right.touchdowns,
    turnovers: left.turnovers + right.turnovers,
    tackles: left.tackles + right.tackles,
    tacklesForLoss: left.tacklesForLoss + right.tacklesForLoss,
    sacks: left.sacks + right.sacks,
    passBreakups: left.passBreakups + right.passBreakups,
    interceptions: left.interceptions + right.interceptions,
  };
}

function simulateBackgroundStandings(
  standings: SeasonStanding[],
  worldSeed: string,
  week: number,
  heroTeamId: string,
  heroOpponentId: string,
): SeasonStanding[] {
  const next = standings.map((team) => ({ ...team }));
  const pool = next.filter((team) => team.teamId !== heroTeamId && team.teamId !== heroOpponentId);
  const random = new SeededRandom(`${worldSeed}:standings:${week}`);
  for (let index = 0; index + 1 < pool.length; index += 2) {
    const home = pool[index];
    const away = pool[index + 1];
    if (!home || !away) continue;
    const homeScore = random.integer(10, 38) + Math.round((home.rating - away.rating) * 0.22);
    const awayScore = random.integer(7, 35) + Math.round((away.rating - home.rating) * 0.18);
    const homeWon = homeScore >= awayScore;
    home.wins += homeWon ? 1 : 0;
    home.losses += homeWon ? 0 : 1;
    away.wins += homeWon ? 0 : 1;
    away.losses += homeWon ? 1 : 0;
    home.pointsFor += homeScore;
    home.pointsAgainst += awayScore;
    away.pointsFor += awayScore;
    away.pointsAgainst += homeScore;
    home.streak = homeWon ? Math.max(1, home.streak + 1) : Math.min(-1, home.streak - 1);
    away.streak = homeWon ? Math.min(-1, away.streak - 1) : Math.max(1, away.streak + 1);
  }
  return next;
}

function awardForMatch(save: CareerSave, match: FootballMatchState): SeasonAward[] {
  const result = match.finalResult;
  if (!result || (result.grade !== "A" && match.coachGrade < 77)) return [];
  return [{
    id: `award-${match.gameId}`,
    week: match.scheduledWeek,
    title: result.grade === "A" && result.won ? "Игрок недели школы" : "Выступление недели",
    playerName: save.character.identity.fullName,
    teamName: save.football.school.shortName,
    detail: result.spotlight,
    isHero: true,
  }];
}

export function applyCompletedMatchToSeason(save: CareerSave, match: FootballMatchState): FootballSeasonState {
  const result = match.finalResult;
  if (!result) throw new Error("Completed match has no final result");
  const season = save.football.season;
  const heroStanding = season.standings.find((team) => team.isHeroTeam);
  const opponentStanding = season.standings.find((team) => team.teamId === match.opponentId);
  if (!heroStanding || !opponentStanding) throw new Error("Season standings are incomplete");

  let standings = simulateBackgroundStandings(
    season.standings,
    save.meta.worldSeed,
    match.scheduledWeek,
    heroStanding.teamId,
    opponentStanding.teamId,
  );
  standings = standings.map((team) => {
    if (team.teamId === heroStanding.teamId) {
      return {
        ...team,
        wins: team.wins + (result.won ? 1 : 0),
        losses: team.losses + (result.won ? 0 : 1),
        pointsFor: team.pointsFor + result.heroScore,
        pointsAgainst: team.pointsAgainst + result.opponentScore,
        streak: result.won ? Math.max(1, team.streak + 1) : Math.min(-1, team.streak - 1),
      };
    }
    if (team.teamId === opponentStanding.teamId) {
      return {
        ...team,
        wins: team.wins + (result.won ? 0 : 1),
        losses: team.losses + (result.won ? 1 : 0),
        pointsFor: team.pointsFor + result.opponentScore,
        pointsAgainst: team.pointsAgainst + result.heroScore,
        streak: result.won ? Math.min(-1, team.streak - 1) : Math.max(1, team.streak + 1),
      };
    }
    return team;
  });

  const schedule = season.schedule.map((game) => game.week === match.scheduledWeek
    ? {
        ...game,
        status: "complete" as const,
        heroScore: result.heroScore,
        opponentScore: result.opponentScore,
        won: result.won,
        heroGrade: result.grade,
        spotlight: result.spotlight,
      }
    : game);
  const nextGame = schedule.find((game) => game.status === "scheduled");
  const nextStanding = nextGame ? standings.find((team) => team.teamId === nextGame.opponentId) : undefined;
  const nextOpponentProfile = nextGame ? season.opponents.find((opponent) => opponent.id === nextGame.opponentId) : undefined;
  const wins = season.wins + (result.won ? 1 : 0);
  const losses = season.losses + (result.won ? 0 : 1);

  return {
    ...season,
    phase: nextGame ? "regular-season" : "complete",
    week: match.scheduledWeek,
    wins,
    losses,
    schedule,
    standings,
    heroTotals: addStats(season.heroTotals, match.stats),
    awards: [...season.awards, ...awardForMatch(save, match)],
    nextOpponent: nextGame && nextOpponentProfile
      ? {
          id: nextGame.opponentId,
          name: nextGame.opponentName,
          record: `${nextStanding?.wins ?? 0}–${nextStanding?.losses ?? 0}`,
          threat: nextOpponentProfile.defenseStyle,
        }
      : {
          id: "season-complete",
          name: "Регулярный сезон завершён",
          record: `${wins}–${losses}`,
          threat: "Итоги сезона готовы",
        },
  };
}

export function orderedStandings(season: FootballSeasonState): SeasonStanding[] {
  return [...season.standings].sort((left, right) =>
    right.wins - left.wins || left.losses - right.losses || (right.pointsFor - right.pointsAgainst) - (left.pointsFor - left.pointsAgainst) || right.rating - left.rating,
  );
}
