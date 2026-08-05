import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import { createEmptyAdvancedMatchStats, createEmptyMatchStats, matchUnitForPosition } from "../../matches/createMatchState";
import { buildMatchUsagePlan, createEmptyMatchUsageStats } from "../../matches/usage";
import type { FootballMatchState, MatchStatLine } from "../../matches/types";
import type { ProfessionalGame } from "../types";

export function createProfessionalMatchState(save: CareerSave, game: ProfessionalGame): FootballMatchState {
  const career = save.football.professional.heroCareer;
  const teamId = career?.teamId;
  if (!teamId || (game.homeTeamId !== teamId && game.awayTeamId !== teamId)) throw new Error("Professional game does not include the hero team");
  const opponentId = game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
  const opponent = save.football.professional.teams.find((team) => team.id === opponentId);
  const random = new SeededRandom(save.meta.worldSeed).fork(`professional-match:${game.id}`);
  const role = career.role;
  const specialist = save.football.position === "K" || save.football.position === "P";
  const totalEpisodes = specialist ? 18 : 120;
  const openingFieldPosition = random.integer(18, 34);
  return {
    moduleVersion: 1,
    gameId: game.id,
    status: "upcoming",
    scheduledWeek: game.week,
    scheduledDate: game.date,
    opponentId,
    opponentName: opponent?.shortName ?? opponentId,
    opponentRecord: opponent ? `${opponent.wins}–${opponent.losses}` : "0–0",
    opponentThreat: opponent ? `OVR ${Math.round(opponent.rosterStrength)} · CAP ${Math.round(opponent.capSpace / 1_000_000)}M` : "Нет данных",
    heroUnit: matchUnitForPosition(save.football.position),
    heroScore: 0,
    opponentScore: 0,
    quarter: 1,
    clockSeconds: 12 * 60,
    gameClockSeconds: 48 * 60,
    playClockSeconds: 25,
    possession: matchUnitForPosition(save.football.position) === "defense" ? "opponent" : "hero",
    openingKickoffReceiver: random.chance(0.5) ? "hero" : "opponent",
    participationMode: "key-moments",
    analysisMode: false,
    heroFatigue: random.integer(5, 14),
    coachGrade: Math.max(44, Math.min(74, Math.round((career.coachTrust ?? 55) * 0.38 + 35))),
    episodeIndex: 0,
    totalEpisodes,
    rosterRole: role,
    driveDown: 1,
    driveDistance: 10,
    driveFieldPosition: openingFieldPosition,
    driveNumber: 1,
    currentDriveId: `pro-drive-${game.week}-1`,
    driveStartQuarter: 1,
    driveStartClockSeconds: 12 * 60,
    driveStartFieldPosition: openingFieldPosition,
    drivePlays: 0,
    driveYards: 0,
    timeoutsHero: 3,
    timeoutsOpponent: 3,
    completedEpisodes: [],
    drives: [],
    stats: createEmptyMatchStats(),
    advancedStats: createEmptyAdvancedMatchStats(),
    tacticalMemory: { heroOffense: [], opponentOffense: [] },
    usagePlan: buildMatchUsagePlan(save, role),
    usageStats: createEmptyMatchUsageStats(),
  };
}

export function isProfessionalMatchAwaitingResolution(save: CareerSave): boolean {
  const state = save.football.professional;
  return save.meta.phase === "professional-career"
    && state.status === "roster"
    && state.heroCareer?.role !== "inactive"
    && Boolean(state.league.activeGameId)
    && state.league.activeGameId === save.football.match.gameId;
}

export function emptyProfessionalStats(): MatchStatLine {
  return createEmptyMatchStats();
}
