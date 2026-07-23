import { SeededRandom } from "../../../core/random/SeededRandom";
import { tacticalTeamModifier } from "./tactics";
import { teamSocialGameModifier } from "./social";
import type {
  EcosystemCoach,
  EcosystemCompetitionAward,
  EcosystemCompetitionGame,
  EcosystemCompetitionState,
  EcosystemConference,
  EcosystemNationalRanking,
  EcosystemPlayer,
  EcosystemProgramLegacy,
  EcosystemRankingSnapshot,
  EcosystemRivalry,
  EcosystemSocialState,
  EcosystemStoryKind,
  EcosystemTeam,
} from "./types";

export interface CompetitionStoryDraft {
  kind: EcosystemStoryKind;
  title: string;
  detail: string;
  importance: 1 | 2 | 3 | 4 | 5;
  teamIds: string[];
  playerIds: string[];
}

export interface CompetitionWeekResult {
  competition: EcosystemCompetitionState;
  teams: EcosystemTeam[];
  coaches: EcosystemCoach[];
  stories: CompetitionStoryDraft[];
  playedTeamIds: string[];
}

export interface CompetitionPostseasonResult extends CompetitionWeekResult {
  conferences: EcosystemConference[];
  complete: boolean;
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, Math.round(value * 10) / 10));

function pairRoundRobin(teamIds: string[], round: number): Array<[string, string]> {
  const ids = [...teamIds].sort();
  if (ids.length % 2 === 1) ids.push("");
  if (ids.length < 2) return [];
  const fixed = ids[0] ?? "";
  const rotating = ids.slice(1);
  for (let index = 0; index < round % Math.max(1, rotating.length); index += 1) {
    const moved = rotating.pop();
    if (moved !== undefined) rotating.unshift(moved);
  }
  const arranged = [fixed, ...rotating];
  const pairs: Array<[string, string]> = [];
  for (let index = 0; index < arranged.length / 2; index += 1) {
    const left = arranged[index];
    const right = arranged[arranged.length - 1 - index];
    if (left && right) pairs.push([left, right]);
  }
  return pairs;
}

function crossConferencePairs(leftIds: string[], rightIds: string[], offset: number): Array<[string, string]> {
  const left = [...leftIds].sort();
  const right = [...rightIds].sort();
  return left.map((teamId, index) => [teamId, right[(index + offset) % right.length] ?? ""] as [string, string]).filter((pair) => pair[1] !== "");
}

function createRivalries(conferences: EcosystemConference[], teams: EcosystemTeam[]): EcosystemRivalry[] {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  return conferences.flatMap((conference) => {
    const ids = [...conference.teamIds].sort();
    const rivalries: EcosystemRivalry[] = [];
    for (let index = 0; index < ids.length; index += 2) {
      const teamAId = ids[index];
      const teamBId = ids[index + 1];
      if (!teamAId || !teamBId) continue;
      const teamA = teamMap.get(teamAId);
      const teamB = teamMap.get(teamBId);
      rivalries.push({
        id: `rivalry:${conference.id}:${teamAId}:${teamBId}`,
        name: `${teamA?.shortName ?? teamAId}–${teamB?.shortName ?? teamBId}`,
        teamAId,
        teamBId,
        intensity: clamp(55 + Math.abs((teamA?.prestige ?? 50) - (teamB?.prestige ?? 50)) * 0.25 + conference.prestige * 0.2),
        meetings: 0,
        winsA: 0,
        winsB: 0,
        ties: 0,
        streak: 0,
      });
    }
    return rivalries;
  });
}

function gameId(seasonYear: number, week: number, homeId: string, awayId: string, kind: EcosystemCompetitionGame["kind"]): string {
  return `${seasonYear}:${week}:${kind}:${homeId}:${awayId}`;
}

function scheduledGame(
  seasonYear: number,
  week: number,
  leftId: string,
  rightId: string,
  kind: EcosystemCompetitionGame["kind"],
  conferenceGame: boolean,
  neutralSite: boolean,
  rivalries: EcosystemRivalry[],
  random: SeededRandom,
): EcosystemCompetitionGame {
  const rivalry = rivalries.find((item) => (item.teamAId === leftId && item.teamBId === rightId) || (item.teamAId === rightId && item.teamBId === leftId));
  const swap = !neutralSite && random.chance(0.5);
  const homeTeamId = swap ? rightId : leftId;
  const awayTeamId = swap ? leftId : rightId;
  return {
    id: gameId(seasonYear, week, homeTeamId, awayTeamId, rivalry && conferenceGame ? "rivalry" : kind),
    seasonYear,
    week,
    kind: rivalry && conferenceGame ? "rivalry" : kind,
    homeTeamId,
    awayTeamId,
    neutralSite,
    conferenceGame,
    ...(rivalry ? { rivalryId: rivalry.id } : {}),
    status: "scheduled",
  };
}

export function createCompetitionSchedule(
  seasonYear: number,
  conferences: EcosystemConference[],
  teams: EcosystemTeam[],
  random: SeededRandom,
): { schedule: EcosystemCompetitionGame[]; rivalries: EcosystemRivalry[] } {
  const collegeConferences = conferences.filter((conference) => conference.teamIds.length >= 2);
  const rivalries = createRivalries(collegeConferences, teams);
  const schedule: EcosystemCompetitionGame[] = [];
  const conferencePairs = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]] as const;

  for (let week = 1; week <= 3; week += 1) {
    const pairOffset = (week - 1) * 2;
    for (let index = 0; index < 2; index += 1) {
      const pair = conferencePairs[pairOffset + index];
      if (!pair) continue;
      const leftConference = collegeConferences[pair[0]];
      const rightConference = collegeConferences[pair[1]];
      if (!leftConference || !rightConference) continue;
      for (const [leftId, rightId] of crossConferencePairs(leftConference.teamIds, rightConference.teamIds, week - 1)) {
        schedule.push(scheduledGame(seasonYear, week, leftId, rightId, "nonconference", false, false, rivalries, random.fork(`w${week}:${leftId}:${rightId}`)));
      }
    }
  }

  for (let week = 4; week <= 8; week += 1) {
    for (const conference of collegeConferences) {
      for (const [leftId, rightId] of pairRoundRobin(conference.teamIds, week - 4)) {
        schedule.push(scheduledGame(seasonYear, week, leftId, rightId, "conference", true, false, rivalries, random.fork(`w${week}:${conference.id}:${leftId}:${rightId}`)));
      }
    }
  }

  const latePairs = [[0, 1], [2, 3]] as const;
  for (let week = 9; week <= 10; week += 1) {
    for (const pair of latePairs) {
      const leftConference = collegeConferences[pair[0]];
      const rightConference = collegeConferences[pair[1]];
      if (!leftConference || !rightConference) continue;
      for (const [leftId, rightId] of crossConferencePairs(leftConference.teamIds, rightConference.teamIds, week - 8)) {
        schedule.push(scheduledGame(seasonYear, week, leftId, rightId, "nonconference", false, false, rivalries, random.fork(`late:${week}:${leftId}:${rightId}`)));
      }
    }
  }

  return { schedule, rivalries };
}

function initialLegacies(teams: EcosystemTeam[]): EcosystemProgramLegacy[] {
  return teams.filter((team) => team.level === "college").map((team) => ({
    teamId: team.id,
    allTimeWins: 0,
    allTimeLosses: 0,
    nationalTitles: 0,
    playoffAppearances: 0,
    bowlWins: 0,
    rivalryWins: 0,
    bestRank: 99,
    reputation: clamp(team.prestige),
    eraLabel: team.prestige >= 88 ? "power" : team.prestige >= 72 ? "contender" : "building",
  }));
}

export function calculateNationalRankings(
  teams: EcosystemTeam[],
  schedule: EcosystemCompetitionGame[],
  seasonYear: number,
  week: number,
  previous: EcosystemNationalRanking[] = [],
): EcosystemNationalRanking[] {
  const complete = schedule.filter((game) => game.status === "complete" && game.seasonYear === seasonYear);
  const previousMap = new Map(previous.map((item) => [item.teamId, item.rank]));
  const ranked = teams.filter((team) => team.level === "college").map((team) => {
    const games = complete.filter((game) => game.homeTeamId === team.id || game.awayTeamId === team.id);
    const opponents = games.map((game) => teams.find((item) => item.id === (game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId))).filter((item): item is EcosystemTeam => Boolean(item));
    const pointsFor = games.reduce((sum, game) => sum + (game.homeTeamId === team.id ? game.homeScore ?? 0 : game.awayScore ?? 0), 0);
    const pointsAgainst = games.reduce((sum, game) => sum + (game.homeTeamId === team.id ? game.awayScore ?? 0 : game.homeScore ?? 0), 0);
    const sos = opponents.length > 0 ? opponents.reduce((sum, opponent) => sum + opponent.rating, 0) / opponents.length : 50;
    const qualityWins = games.filter((game) => game.winnerTeamId === team.id).filter((game) => {
      const opponent = teams.find((item) => item.id === (game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId));
      return (opponent?.rating ?? 0) >= 72;
    }).length;
    const roadWins = games.filter((game) => game.awayTeamId === team.id && game.winnerTeamId === team.id).length;
    const winPct = games.length > 0 ? team.wins / games.length : 0;
    const pointDifferential = pointsFor - pointsAgainst;
    const score = clamp(winPct * 48 + sos * 0.22 + qualityWins * 5 + roadWins * 2 + Math.max(-10, Math.min(10, pointDifferential / Math.max(1, games.length))) + team.rating * 0.12);
    return { team, score, sos, qualityWins, pointDifferential };
  }).sort((left, right) => right.score - left.score || right.team.rating - left.team.rating || left.team.id.localeCompare(right.team.id));

  return ranked.map((item, index) => ({
    seasonYear,
    week,
    teamId: item.team.id,
    rank: index + 1,
    ...(previousMap.has(item.team.id) ? { previousRank: previousMap.get(item.team.id) } : {}),
    score: item.score,
    strengthOfSchedule: clamp(item.sos),
    qualityWins: item.qualityWins,
    pointDifferential: item.pointDifferential,
  }));
}

export function createCompetitionState(
  seasonYear: number,
  conferences: EcosystemConference[],
  teams: EcosystemTeam[],
  random: SeededRandom,
): EcosystemCompetitionState {
  const { schedule, rivalries } = createCompetitionSchedule(seasonYear, conferences, teams, random.fork("schedule"));
  const rankings = calculateNationalRankings(teams, schedule, seasonYear, 0);
  return {
    version: 1,
    seasonYear,
    schedule,
    rankings,
    rankingHistory: [{ seasonYear, week: 0, rankings }],
    playoff: { seasonYear, stage: "regular-season", seedTeamIds: [], gameIds: [] },
    awards: [],
    rivalries,
    programLegacies: initialLegacies(teams),
    digest: ["Национальный сезон сформирован: расписание, rivalry и рейтинг готовы."],
  };
}

function scoreGame(team: EcosystemTeam, opponent: EcosystemTeam, players: EcosystemPlayer[], random: SeededRandom, homeAdvantage: number, social?: EcosystemSocialState): number {
  const tactical = tacticalTeamModifier(team, players);
  const socialModifier = teamSocialGameModifier(social, team.id);
  const trend = team.trend === "rising" ? 2.5 : team.trend === "falling" ? -2.5 : 0;
  const matchup = (team.rating - opponent.rating) * 0.2;
  return Math.max(3, Math.min(55, Math.round(23 + tactical + socialModifier + trend + matchup + homeAdvantage + random.integer(-10, 11))));
}

function completeGame(game: EcosystemCompetitionGame, teams: EcosystemTeam[], players: EcosystemPlayer[], random: SeededRandom, social?: EcosystemSocialState): EcosystemCompetitionGame {
  const home = teams.find((team) => team.id === game.homeTeamId);
  const away = teams.find((team) => team.id === game.awayTeamId);
  if (!home || !away) return game;
  let homeScore = scoreGame(home, away, players, random.fork("home"), game.neutralSite ? 0 : 2, social);
  let awayScore = scoreGame(away, home, players, random.fork("away"), 0, social);
  if (homeScore === awayScore) homeScore += random.chance(0.5) ? 3 : -3;
  const homeWon = homeScore > awayScore;
  const winnerTeamId = homeWon ? home.id : away.id;
  const loserTeamId = homeWon ? away.id : home.id;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;
  return { ...game, status: "complete", homeScore, awayScore, winnerTeamId, loserTeamId, upset: winner.rating + 7 < loser.rating };
}

function updateTeamsFromGames(teams: EcosystemTeam[], games: EcosystemCompetitionGame[]): EcosystemTeam[] {
  const teamMap = new Map(teams.map((team) => [team.id, { ...team }]));
  for (const game of games) {
    if (game.status !== "complete" || !game.winnerTeamId || !game.loserTeamId) continue;
    const winner = teamMap.get(game.winnerTeamId);
    const loser = teamMap.get(game.loserTeamId);
    if (!winner || !loser) continue;
    teamMap.set(winner.id, {
      ...winner,
      wins: winner.wins + 1,
      conferenceWins: winner.conferenceWins + (game.conferenceGame ? 1 : 0),
      streak: Math.max(1, winner.streak + 1),
      trend: winner.streak >= 0 ? "rising" : "stable",
      prestige: clamp(winner.prestige + (game.kind === "playoff" ? 1.2 : game.kind === "conference-championship" ? 0.8 : game.upset ? 0.5 : 0.1)),
    });
    teamMap.set(loser.id, {
      ...loser,
      losses: loser.losses + 1,
      conferenceLosses: loser.conferenceLosses + (game.conferenceGame ? 1 : 0),
      streak: Math.min(-1, loser.streak - 1),
      trend: loser.streak <= 0 ? "falling" : "stable",
      prestige: clamp(loser.prestige - (game.upset ? 0.4 : 0.05)),
    });
  }
  return [...teamMap.values()];
}

function updateCoachesFromGames(
  coaches: EcosystemCoach[],
  teams: EcosystemTeam[],
  games: EcosystemCompetitionGame[],
  random: SeededRandom,
): EcosystemCoach[] {
  return coaches.map((coach) => {
    if (coach.role !== "head-coach") return coach;
    const team = teams.find((item) => item.id === coach.teamId);
    if (!team) return coach;
    const teamGames = games.filter((game) => game.homeTeamId === coach.teamId || game.awayTeamId === coach.teamId);
    const wins = teamGames.filter((game) => game.winnerTeamId === coach.teamId).length;
    const losses = teamGames.filter((game) => game.loserTeamId === coach.teamId).length;
    if (wins === 0 && losses === 0) return coach;

    const played = Math.max(1, team.wins + team.losses);
    const actualRate = team.wins / played;
    const expectedRate = team.expectation / 125;
    const upsetWins = teamGames.filter((game) => game.winnerTeamId === coach.teamId && game.upset).length;
    const damagingLosses = teamGames.filter((game) => game.loserTeamId === coach.teamId && game.upset).length;
    const resultDelta = wins * 0.7 - losses * 1.05;
    const expectationDelta = (actualRate - expectedRate) * 2.6;
    const volatility = random.fork(`coach-security:${coach.id}:${played}`).integer(-1, 1);
    const jobSecurity = clamp(
      coach.jobSecurity
        + resultDelta
        + expectationDelta
        + upsetWins * 1.4
        - damagingLosses * 1.8
        + volatility,
    );
    const status: EcosystemCoach["status"] = jobSecurity < 35 ? "hot-seat" : jobSecurity < 55 ? "watched" : "secure";

    return {
      ...coach,
      careerWins: coach.careerWins + wins,
      careerLosses: coach.careerLosses + losses,
      jobSecurity,
      pressure: clamp(100 - jobSecurity + team.losses * 1.6),
      status,
    };
  });
}

function updateRivalries(rivalries: EcosystemRivalry[], games: EcosystemCompetitionGame[]): EcosystemRivalry[] {
  return rivalries.map((rivalry) => {
    const game = games.find((item) => item.rivalryId === rivalry.id && item.status === "complete");
    if (!game || !game.winnerTeamId) return rivalry;
    const wonA = game.winnerTeamId === rivalry.teamAId;
    const sameWinner = rivalry.lastWinnerTeamId === game.winnerTeamId;
    return {
      ...rivalry,
      meetings: rivalry.meetings + 1,
      winsA: rivalry.winsA + (wonA ? 1 : 0),
      winsB: rivalry.winsB + (wonA ? 0 : 1),
      streak: sameWinner ? rivalry.streak + 1 : 1,
      lastWinnerTeamId: game.winnerTeamId,
      intensity: clamp(rivalry.intensity + (game.upset ? 2 : 0.4)),
    };
  });
}

function awardPlayerOfWeek(players: EcosystemPlayer[], teams: EcosystemTeam[], games: EcosystemCompetitionGame[], seasonYear: number, week: number): EcosystemCompetitionAward | undefined {
  const winners = new Set(games.map((game) => game.winnerTeamId).filter((id): id is string => Boolean(id)));
  const candidates = players.filter((player) => player.level === "college" && winners.has(player.teamId) && player.status !== "injured" && player.depthRank <= 2);
  const player = [...candidates].sort((left, right) => (right.overall + right.form * 0.2 + right.tactical.schemeFit * 0.15) - (left.overall + left.form * 0.2 + left.tactical.schemeFit * 0.15) || left.id.localeCompare(right.id))[0];
  if (!player) return undefined;
  const team = teams.find((item) => item.id === player.teamId);
  return {
    id: `award:${seasonYear}:${week}:player:${player.id}`,
    seasonYear,
    week,
    kind: "player-of-week",
    playerId: player.id,
    teamId: player.teamId,
    title: `${player.name} — игрок недели`,
    detail: `${player.position} из ${team?.shortName ?? player.teamId} определил результат недели и усилил национальную репутацию программы.`,
  };
}

function updateLegacies(legacies: EcosystemProgramLegacy[], games: EcosystemCompetitionGame[], rankings: EcosystemNationalRanking[], rivalries: EcosystemRivalry[]): EcosystemProgramLegacy[] {
  const rankingMap = new Map(rankings.map((ranking) => [ranking.teamId, ranking.rank]));
  return legacies.map((legacy) => {
    const wins = games.filter((game) => game.winnerTeamId === legacy.teamId).length;
    const losses = games.filter((game) => game.loserTeamId === legacy.teamId).length;
    const rivalryWins = games.filter((game) => game.rivalryId && game.winnerTeamId === legacy.teamId).length;
    const bowlWins = games.filter((game) => game.kind === "bowl" && game.winnerTeamId === legacy.teamId).length;
    const bestRank = Math.min(legacy.bestRank, rankingMap.get(legacy.teamId) ?? 99);
    const reputation = clamp(legacy.reputation + wins * 0.35 - losses * 0.18 + rivalryWins * 0.5);
    const eraLabel: EcosystemProgramLegacy["eraLabel"] = legacy.nationalTitles >= 3 && reputation >= 88 ? "dynasty" : reputation >= 82 ? "power" : reputation >= 70 ? "contender" : losses > wins + 2 ? "decline" : "building";
    return { ...legacy, allTimeWins: legacy.allTimeWins + wins, allTimeLosses: legacy.allTimeLosses + losses, rivalryWins: legacy.rivalryWins + rivalryWins, bowlWins: legacy.bowlWins + bowlWins, bestRank, reputation, eraLabel };
  });
}

function storiesForGames(games: EcosystemCompetitionGame[], teams: EcosystemTeam[], rivalries: EcosystemRivalry[]): CompetitionStoryDraft[] {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  return games.flatMap((game): CompetitionStoryDraft[] => {
    if (game.status !== "complete" || !game.winnerTeamId || !game.loserTeamId) return [];
    const winner = teamMap.get(game.winnerTeamId);
    const loser = teamMap.get(game.loserTeamId);
    const rivalry = game.rivalryId ? rivalries.find((item) => item.id === game.rivalryId) : undefined;
    if (!winner || !loser) return [];
    if (rivalry) return [{ kind: "rivalry", title: `${winner.shortName} забрал rivalry`, detail: `${winner.name} победил ${loser.name} ${game.homeScore}:${game.awayScore} в ${rivalry.name}.`, importance: game.upset ? 5 : 4, teamIds: [winner.id, loser.id], playerIds: [] }];
    if (game.kind === "bowl") return [{ kind: "bowl", title: `${winner.shortName} выиграл bowl`, detail: `${winner.name} завершил сезон победой над ${loser.name} ${game.homeScore}:${game.awayScore}.`, importance: 3, teamIds: [winner.id, loser.id], playerIds: [] }];
    if (game.upset) return [{ kind: "upset", title: `${winner.shortName} сорвал прогноз`, detail: `${winner.name} обыграл ${loser.name} ${game.homeScore}:${game.awayScore} и изменил национальный рейтинг.`, importance: 4, teamIds: [winner.id, loser.id], playerIds: [] }];
    return [];
  });
}

export function simulateCompetitionWeek(
  competition: EcosystemCompetitionState,
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  seasonYear: number,
  week: number,
  random: SeededRandom,
  social?: EcosystemSocialState,
): CompetitionWeekResult {
  const scheduled = competition.schedule.filter((game) => game.seasonYear === seasonYear && game.week === week && game.status === "scheduled");
  const completed = scheduled.map((game) => completeGame(game, teams, players, random.fork(game.id), social));
  const completedMap = new Map(completed.map((game) => [game.id, game]));
  const nextSchedule = competition.schedule.map((game) => completedMap.get(game.id) ?? game);
  const nextTeams = updateTeamsFromGames(teams, completed);
  const nextCoaches = updateCoachesFromGames(coaches, nextTeams, completed, random.fork("coach-pressure"));
  const nextRivalries = updateRivalries(competition.rivalries, completed);
  const rankings = calculateNationalRankings(nextTeams, nextSchedule, seasonYear, week, competition.rankings);
  const snapshot: EcosystemRankingSnapshot = { seasonYear, week, rankings };
  const weeklyAward = awardPlayerOfWeek(players, nextTeams, completed, seasonYear, week);
  const stories = storiesForGames(completed, nextTeams, nextRivalries);
  for (const coach of nextCoaches.filter((item) => item.role === "head-coach" && item.status === "hot-seat")) {
    const previous = coaches.find((item) => item.id === coach.id);
    if (previous?.status === "hot-seat") continue;
    const team = nextTeams.find((item) => item.id === coach.teamId);
    stories.push({
      kind: "coach-pressure",
      title: `${coach.name} оказался под угрозой увольнения`,
      detail: `${team?.name ?? coach.teamId} не выполняет ожидания. Позиция штаба, обещания игрокам и будущая схема больше не гарантированы.`,
      importance: 4,
      teamIds: [coach.teamId],
      playerIds: [],
    });
  }
  if (weeklyAward) stories.push({ kind: "award", title: weeklyAward.title, detail: weeklyAward.detail, importance: 3, teamIds: [weeklyAward.teamId], playerIds: [weeklyAward.playerId] });
  const top = rankings[0];
  const leader = top ? nextTeams.find((team) => team.id === top.teamId) : undefined;
  return {
    competition: {
      ...competition,
      schedule: nextSchedule,
      rankings,
      rankingHistory: [...competition.rankingHistory, snapshot].slice(-40),
      awards: weeklyAward ? [...competition.awards, weeklyAward].slice(-120) : competition.awards,
      rivalries: nextRivalries,
      programLegacies: updateLegacies(competition.programLegacies, completed, rankings, nextRivalries),
      digest: [leader ? `#1 ${leader.shortName}: ${leader.wins}–${leader.losses}, SOS ${Math.round(top?.strengthOfSchedule ?? 0)}.` : "Рейтинг формируется.", `${completed.length} национальных матчей сыграно на неделе ${week}.`, `${completed.filter((game) => game.upset).length} сенсаций изменили рынок и давление на штабы.`],
    },
    teams: nextTeams,
    coaches: nextCoaches,
    stories,
    playedTeamIds: [...new Set(completed.flatMap((game) => [game.homeTeamId, game.awayTeamId]))],
  };
}

function conferenceOrder(conference: EcosystemConference, teams: EcosystemTeam[]): EcosystemTeam[] {
  return conference.teamIds.map((teamId) => teams.find((team) => team.id === teamId)).filter((team): team is EcosystemTeam => Boolean(team)).sort((left, right) => right.conferenceWins - left.conferenceWins || left.conferenceLosses - right.conferenceLosses || right.wins - left.wins || right.rating - left.rating);
}

function createPostseasonGames(
  competition: EcosystemCompetitionState,
  teams: EcosystemTeam[],
  conferences: EcosystemConference[],
): EcosystemCompetitionGame[] {
  const stage = competition.playoff.stage;
  const seasonYear = competition.seasonYear;
  if (stage === "regular-season") {
    return conferences.flatMap((conference) => {
      const finalists = conferenceOrder(conference, teams).slice(0, 2);
      const first = finalists[0];
      const second = finalists[1];
      if (!first || !second) return [];
      return [{ id: gameId(seasonYear, 11, first.id, second.id, "conference-championship"), seasonYear, week: 11, kind: "conference-championship", homeTeamId: first.id, awayTeamId: second.id, neutralSite: true, conferenceGame: true, status: "scheduled" }];
    });
  }
  if (stage === "conference-championships") {
    const seeds = competition.rankings.slice(0, 8).map((ranking) => ranking.teamId);
    const quarterfinalPairs: ReadonlyArray<readonly [number, number]> = [[0, 7], [3, 4], [1, 6], [2, 5]];
    return quarterfinalPairs.flatMap(([leftIndex, rightIndex]) => {
      const left = seeds[leftIndex];
      const right = seeds[rightIndex];
      if (!left || !right) return [];
      return [{ id: gameId(seasonYear, 12, left, right, "playoff"), seasonYear, week: 12, kind: "playoff", homeTeamId: left, awayTeamId: right, neutralSite: true, conferenceGame: false, status: "scheduled" }];
    });
  }
  const previousWeek = stage === "quarterfinals" ? 12 : stage === "semifinals" ? 13 : -1;
  if (previousWeek < 0) return [];
  const winners = competition.schedule.filter((game) => game.seasonYear === seasonYear && game.week === previousWeek && game.kind === "playoff" && game.status === "complete").map((game) => game.winnerTeamId).filter((teamId): teamId is string => Boolean(teamId));
  const week = stage === "quarterfinals" ? 13 : 14;
  const pairs: ReadonlyArray<readonly [number, number]> = stage === "quarterfinals" ? [[0, 1], [2, 3]] : [[0, 1]];
  const games: EcosystemCompetitionGame[] = pairs.flatMap(([leftIndex, rightIndex]) => {
    const left = winners[leftIndex];
    const right = winners[rightIndex];
    if (!left || !right) return [];
    return [{ id: gameId(seasonYear, week, left, right, "playoff"), seasonYear, week, kind: "playoff" as const, homeTeamId: left, awayTeamId: right, neutralSite: true, conferenceGame: false, status: "scheduled" as const }];
  });
  if (stage === "semifinals") {
    const bowlTeams = competition.rankings.slice(8, 16).map((ranking) => ranking.teamId);
    for (let index = 0; index < bowlTeams.length; index += 2) {
      const left = bowlTeams[index];
      const right = bowlTeams[index + 1];
      if (!left || !right) continue;
      games.push({ id: gameId(seasonYear, week, left, right, "bowl"), seasonYear, week, kind: "bowl", homeTeamId: left, awayTeamId: right, neutralSite: true, conferenceGame: false, status: "scheduled" });
    }
  }
  return games;
}

function annualAwards(players: EcosystemPlayer[], teams: EcosystemTeam[], seasonYear: number): EcosystemCompetitionAward[] {
  const eligible = players.filter((player) => player.level === "college" && player.status !== "injured");
  const ordered = [...eligible].sort((left, right) => (right.overall + right.form * 0.22 + right.tactical.schemeFit * 0.18) - (left.overall + left.form * 0.22 + left.tactical.schemeFit * 0.18) || left.id.localeCompare(right.id));
  const national = ordered[0];
  const awards: EcosystemCompetitionAward[] = [];
  if (national) {
    awards.push({ id: `award:${seasonYear}:national:${national.id}`, seasonYear, kind: "national-player", playerId: national.id, teamId: national.teamId, title: `${national.name} — национальный игрок года`, detail: `${national.position} из ${teams.find((team) => team.id === national.teamId)?.shortName ?? national.teamId} стал лицом сезона.` });
  }
  for (const position of ["QB", "RB", "WR", "LB", "CB"] as const) {
    const player = ordered.find((item) => item.position === position);
    if (!player) continue;
    awards.push({ id: `award:${seasonYear}:position:${position}:${player.id}`, seasonYear, kind: "position-award", playerId: player.id, teamId: player.teamId, title: `${player.name} — лучший ${position}`, detail: `Сочетание уровня, формы и соответствия системе сделало его лучшим игроком позиции.` });
  }
  for (const player of ordered.slice(0, 12)) {
    awards.push({ id: `award:${seasonYear}:all-american:${player.id}`, seasonYear, kind: "all-american", playerId: player.id, teamId: player.teamId, title: `${player.name} — All-American`, detail: `${player.position}, ${teams.find((team) => team.id === player.teamId)?.shortName ?? player.teamId}.` });
  }
  return awards;
}

export function simulateCompetitionPostseason(
  competition: EcosystemCompetitionState,
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  conferences: EcosystemConference[],
  random: SeededRandom,
  social?: EcosystemSocialState,
): CompetitionPostseasonResult {
  if (competition.playoff.stage === "complete") return { competition, teams, coaches, conferences, stories: [], playedTeamIds: [], complete: true };
  const newGames = createPostseasonGames(competition, teams, conferences);
  const completed = newGames.map((game) => completeGame(game, teams, players, random.fork(game.id), social));
  let nextTeams = updateTeamsFromGames(teams, completed);
  let nextCoaches = updateCoachesFromGames(coaches, nextTeams, completed, random.fork("coach-pressure"));
  let nextConferences = conferences;
  let nextStage: EcosystemCompetitionState["playoff"]["stage"] = competition.playoff.stage;
  const stories: CompetitionStoryDraft[] = [];
  let championTeamId = competition.playoff.championTeamId;
  let seeds = competition.playoff.seedTeamIds;

  if (competition.playoff.stage === "regular-season") {
    nextConferences = conferences.map((conference) => {
      const game = completed.find((item) => item.kind === "conference-championship" && conference.teamIds.includes(item.homeTeamId) && conference.teamIds.includes(item.awayTeamId));
      if (!game?.winnerTeamId) return conference;
      const champion = nextTeams.find((team) => team.id === game.winnerTeamId);
      if (champion) {
        nextTeams = nextTeams.map((team) => team.id === champion.id ? { ...team, championships: team.championships + 1, prestige: clamp(team.prestige + 1.2) } : team);
        stories.push({ kind: "championship", title: `${champion.shortName} выиграл ${conference.shortName}`, detail: `${champion.name} стал чемпионом конференции и получил место в национальном посеве.`, importance: 5, teamIds: [champion.id], playerIds: [] });
      }
      return { ...conference, champions: [...conference.champions, { seasonYear: competition.seasonYear, teamId: game.winnerTeamId }].slice(-20) };
    });
    const rankings = calculateNationalRankings(nextTeams, [...competition.schedule, ...completed], competition.seasonYear, 11, competition.rankings);
    seeds = rankings.slice(0, 8).map((ranking) => ranking.teamId);
    nextStage = "conference-championships";
  } else if (competition.playoff.stage === "conference-championships") {
    nextStage = "quarterfinals";
    stories.push({ kind: "playoff", title: "Определились полуфиналисты", detail: `Восьмёрка лучших сократилась до четырёх программ.`, importance: 5, teamIds: completed.map((game) => game.winnerTeamId).filter((id): id is string => Boolean(id)), playerIds: [] });
  } else if (competition.playoff.stage === "quarterfinals") {
    nextStage = "semifinals";
    stories.push({ kind: "playoff", title: "Национальный финал сформирован", detail: `Две программы пережили полуфиналы и сыграют за титул.`, importance: 5, teamIds: completed.map((game) => game.winnerTeamId).filter((id): id is string => Boolean(id)), playerIds: [] });
  } else if (competition.playoff.stage === "semifinals") {
    championTeamId = completed[0]?.winnerTeamId;
    nextStage = "complete";
    if (championTeamId) {
      const champion = nextTeams.find((team) => team.id === championTeamId);
      nextTeams = nextTeams.map((team) => team.id === championTeamId ? { ...team, championships: team.championships + 1, prestige: clamp(team.prestige + 3) } : team);
      stories.push({ kind: "championship", title: `${champion?.shortName ?? championTeamId} — национальный чемпион`, detail: `${champion?.name ?? championTeamId} завершил сезон титулом и изменил баланс престижа, денег и рекрутинга.`, importance: 5, teamIds: [championTeamId], playerIds: [] });
    }
  }

  const schedule = [...competition.schedule, ...completed];
  const rankings = calculateNationalRankings(nextTeams, schedule, competition.seasonYear, completed[0]?.week ?? 11, competition.rankings);
  let legacies = updateLegacies(competition.programLegacies, completed, rankings, competition.rivalries).map((legacy) => ({ ...legacy, playoffAppearances: legacy.playoffAppearances + (seeds.includes(legacy.teamId) && competition.playoff.stage === "conference-championships" ? 1 : 0) }));
  if (championTeamId) legacies = legacies.map((legacy) => legacy.teamId === championTeamId ? { ...legacy, nationalTitles: legacy.nationalTitles + 1, reputation: clamp(legacy.reputation + 5), eraLabel: legacy.nationalTitles + 1 >= 3 ? "dynasty" : "power" } : legacy);
  const awards = nextStage === "complete" ? [...competition.awards, ...annualAwards(players, nextTeams, competition.seasonYear)].slice(-160) : competition.awards;
  return {
    competition: {
      ...competition,
      schedule,
      rankings,
      rankingHistory: [...competition.rankingHistory, { seasonYear: competition.seasonYear, week: completed[0]?.week ?? 11, rankings }].slice(-50),
      playoff: { seasonYear: competition.seasonYear, stage: nextStage, seedTeamIds: seeds, gameIds: [...competition.playoff.gameIds, ...completed.filter((game) => game.kind === "playoff").map((game) => game.id)], ...(championTeamId ? { championTeamId } : {}) },
      awards,
      programLegacies: legacies,
      digest: championTeamId ? [`${nextTeams.find((team) => team.id === championTeamId)?.shortName ?? championTeamId} — национальный чемпион.`, `${awards.filter((award) => award.seasonYear === competition.seasonYear).length} сезонных наград распределено.`, "Историческая репутация программ обновлена."] : [`Постсезон: ${nextStage}.`, `${completed.length} матчей завершено.`, `${seeds.length} программ входят в национальный посев.`],
    },
    teams: nextTeams,
    coaches: nextCoaches,
    conferences: nextConferences,
    stories,
    playedTeamIds: [...new Set(completed.flatMap((game) => [game.homeTeamId, game.awayTeamId]))],
    complete: nextStage === "complete",
  };
}

export function resetCompetitionForSeason(
  competition: EcosystemCompetitionState,
  seasonYear: number,
  conferences: EcosystemConference[],
  teams: EcosystemTeam[],
  random: SeededRandom,
): EcosystemCompetitionState {
  const fresh = createCompetitionState(seasonYear, conferences, teams, random);
  return { ...fresh, awards: competition.awards.slice(-160), rankingHistory: [...competition.rankingHistory, ...fresh.rankingHistory].slice(-50), programLegacies: competition.programLegacies, rivalries: competition.rivalries.map((rivalry) => ({ ...rivalry })) };
}
