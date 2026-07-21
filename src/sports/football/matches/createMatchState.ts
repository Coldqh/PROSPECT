import type { GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition } from "../career/types";
import type { FootballSeasonState } from "../season/types";
import type { FootballMatchState, MatchStatLine, MatchUnit } from "./types";

function addDays(date: GameDate, days: number): GameDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function matchUnitForPosition(position: FootballPosition): MatchUnit {
  return position === "LB" || position === "CB" ? "defense" : "offense";
}

export function createEmptyMatchStats(): MatchStatLine {
  return {
    passingAttempts: 0,
    completions: 0,
    passingYards: 0,
    rushingAttempts: 0,
    rushingYards: 0,
    targets: 0,
    receptions: 0,
    receivingYards: 0,
    touchdowns: 0,
    turnovers: 0,
    tackles: 0,
    tacklesForLoss: 0,
    sacks: 0,
    passBreakups: 0,
    interceptions: 0,
  };
}

export function createInitialMatchState(
  worldSeed: string,
  position: FootballPosition,
  season: FootballSeasonState,
  currentDate: GameDate,
  dayIndex = 0,
  scheduledWeek?: number,
): FootballMatchState {
  const game = scheduledWeek
    ? season.schedule.find((item) => item.week === scheduledWeek)
    : season.schedule.find((item) => item.status === "scheduled");
  const week = game?.week ?? Math.max(1, season.week + 1);
  const opponentId = game?.opponentId ?? season.nextOpponent.id;
  const opponentName = game?.opponentName ?? season.nextOpponent.name;
  const standing = season.standings.find((item) => item.teamId === opponentId);
  const profile = season.opponents.find((item) => item.id === opponentId);
  const random = new SeededRandom(`${worldSeed}:match:${week}:${opponentId}`);
  const daysUntilSaturday = (5 - dayIndex + 7) % 7;
  return {
    moduleVersion: 1,
    gameId: game?.id ?? `game-${week}-${opponentId}`,
    status: "upcoming",
    scheduledWeek: week,
    scheduledDate: game?.date ?? addDays(currentDate, daysUntilSaturday),
    opponentId,
    opponentName,
    opponentRecord: standing ? `${standing.wins}–${standing.losses}` : season.nextOpponent.record,
    opponentThreat: profile?.defenseStyle ?? season.nextOpponent.threat,
    heroUnit: matchUnitForPosition(position),
    heroScore: 0,
    opponentScore: 0,
    quarter: 1,
    clockSeconds: 12 * 60,
    heroFatigue: random.integer(4, 10),
    coachGrade: 55,
    episodeIndex: 0,
    totalEpisodes: 6,
    completedEpisodes: [],
    stats: createEmptyMatchStats(),
  };
}
