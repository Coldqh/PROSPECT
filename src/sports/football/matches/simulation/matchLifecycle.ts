import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import { createEmptyAdvancedMatchStats, createEmptyMatchStats } from "../createMatchState";
import { calculateDecisionForecast } from "../decisionForecast";
import { buildMatchUsagePlan, createEmptyMatchUsageStats } from "../usage";
import type { FootballMatchState, MatchEpisode, MatchParticipationMode } from "../types";
import { advanceToSpecialOpportunity, backgroundDrive, startControlledDrive } from "./driveSimulation";
import { generateEpisode } from "./episodeBuilder";
import { resolveOneMatchDecision } from "./matchDecision";
import { GAME_SECONDS, QUARTER_SECONDS, clamp, controlledOffense } from "./matchMath";
import { finalResult } from "./matchResult";

function startMatchCore(save: CareerSave, participationMode: MatchParticipationMode, analysisMode: boolean): CareerSave {
  const match = save.football.match;
  if (match.status !== "upcoming") return save;
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:kickoff`);
  const controlledSide = controlledOffense(match);
  let started: FootballMatchState = {
    ...match,
    status: "in-progress",
    participationMode,
    analysisMode,
    heroScore: 0,
    opponentScore: 0,
    quarter: 1,
    clockSeconds: QUARTER_SECONDS,
    gameClockSeconds: GAME_SECONDS,
    playClockSeconds: 25,
    possession: controlledSide,
    heroFatigue: clamp(save.character.condition.fatigue * .16 + (100 - save.football.training.body.readiness) * .12, 3, 24),
    coachGrade: 55,
    episodeIndex: 0,
    driveDown: 1,
    driveDistance: 10,
    driveFieldPosition: 25,
    driveNumber: 1,
    currentDriveId: `${match.gameId}-drive-1`,
    driveStartQuarter: 1,
    driveStartClockSeconds: QUARTER_SECONDS,
    driveStartFieldPosition: 25,
    drivePlays: 0,
    driveYards: 0,
    timeoutsHero: 3,
    timeoutsOpponent: 3,
    tacticalMemory: { heroOffense: [], opponentOffense: [] },
    usagePlan: buildMatchUsagePlan(save, match.rosterRole),
    usageStats: createEmptyMatchUsageStats(),
    completedEpisodes: [],
    drives: [],
    stats: createEmptyMatchStats(),
    advancedStats: createEmptyAdvancedMatchStats(),
    finalResult: undefined,
    currentEpisode: undefined,
    lastResolvedEpisode: undefined,
    lastResolvedResult: undefined,
  };

  if (match.openingKickoffReceiver !== controlledSide) {
    const opening = backgroundDrive(save, match.openingKickoffReceiver, GAME_SECONDS, 25, 1, `${save.meta.worldSeed}:${match.gameId}:opening-drive`);
    started = {
      ...started,
      heroScore: opening.heroScoreDelta,
      opponentScore: opening.opponentScoreDelta,
      drives: [opening.summary],
    };
    started = startControlledDrive(started, opening.gameClockSeconds, opening.nextControlledFieldPosition, 2);
  } else {
    started = startControlledDrive(started, GAME_SECONDS, random.integer(22, 28), 1);
  }
  if (started.heroUnit === "special") started = advanceToSpecialOpportunity(save, started, 0);
  if (started.gameClockSeconds > 0) started = { ...started, currentEpisode: generateEpisode(save, started, 0) };
  else {
    const result = finalResult(started, save);
    started = { ...started, status: "complete", finalResult: result, quarter: 4, clockSeconds: 0, currentEpisode: undefined };
  }

  return {
    ...save,
    football: { ...save.football, match: started },
    history: [
      ...save.history,
      {
        id: `${match.gameId}-started`,
        occurredAt: save.meta.updatedAt,
        type: "match-started",
        title: `Матч против ${match.opponentName}`,
        description: `${save.football.position} · ${match.opponentName}`,
      },
    ],
  };
}

function automaticDecisionId(save: CareerSave): string {
  const match = save.football.match;
  const episode = match.currentEpisode;
  if (!episode) throw new Error("Match has no active episode");
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:${episode.id}:auto-choice`);
  return [...episode.options]
    .map((optionValue) => {
      const forecast = calculateDecisionForecast(save, match, episode, optionValue);
      const personalityRisk = save.character.personality.riskTolerance;
      const riskFit = optionValue.risk === "aggressive"
        ? (personalityRisk - 50) * .08
        : optionValue.risk === "safe"
          ? (50 - personalityRisk) * .05
          : 2;
      const value = forecast.executionChance * .48
        + forecast.playImpact * .28
        + forecast.bigPlayChance * .12
        - forecast.mistakeChance * .36
        + riskFit
        + random.integer(-3, 3);
      return { id: optionValue.id, value };
    })
    .sort((left, right) => right.value - left.value)[0]!.id;
}

function isKeyMoment(match: FootballMatchState, episode: MatchEpisode): boolean {
  if (episode.heroActive === false) return false;
  if (episode.unit === "special") return true;
  if (episode.down >= 3) return true;
  if (episode.fieldPosition >= 85 || episode.fieldPosition <= 5) return true;
  if (episode.quarter === 4 && episode.clockSeconds <= 300 && Math.abs(match.heroScore - match.opponentScore) <= 10) return true;

  const highRiskCall = episode.down >= 2 && Math.max(episode.playCall.aggression, episode.opponentCall.aggression) >= 90;
  const longYardage = episode.down >= 2 && episode.distance >= 8;
  const blitzRead = episode.playCall.playType === "blitz" || episode.opponentCall.playType === "blitz";
  const directPressureMoment = episode.heroInvolvement === "primary" && blitzRead && episode.down >= 2;
  const decisivePrimaryRole = episode.heroInvolvement === "primary" && (highRiskCall || longYardage);

  return directPressureMoment || decisivePrimaryRole;
}

function advancePastBenchSnaps(save: CareerSave): CareerSave {
  let current = save;
  let safety = 0;
  while (current.football.match.status === "in-progress"
    && current.football.match.currentEpisode?.heroActive === false
    && safety < 180) {
    current = resolveOneMatchDecision(current, automaticDecisionId(current));
    safety += 1;
  }
  return current;
}

function advanceAutomatic(save: CareerSave, stopAtKeyMoment: boolean): CareerSave {
  let current = save;
  let safety = 0;
  while (current.football.match.status === "in-progress" && current.football.match.currentEpisode && safety < 180) {
    if (stopAtKeyMoment && isKeyMoment(current.football.match, current.football.match.currentEpisode)) break;
    current = resolveOneMatchDecision(current, automaticDecisionId(current));
    safety += 1;
  }
  return current;
}

export function startMatch(
  save: CareerSave,
  participationMode: MatchParticipationMode = "key-moments",
  analysisMode = false,
): CareerSave {
  let started = startMatchCore(save, participationMode, analysisMode);
  if (participationMode === "auto") started = advanceAutomatic(started, false);
  if (participationMode === "every-snap") started = advancePastBenchSnaps(started);
  if (participationMode === "key-moments") {
    started = advancePastBenchSnaps(started);
    if (started.football.match.status === "in-progress") {
      started = {
        ...started,
        football: {
          ...started.football,
          match: { ...started.football.match, lastResolvedEpisode: undefined, lastResolvedResult: undefined },
        },
      };
    }
  }
  return started;
}

export function resolveMatchDecision(save: CareerSave, optionId: string): CareerSave {
  const resolved = resolveOneMatchDecision(save, optionId);
  const playbackEpisode = resolved.football.match.lastResolvedEpisode;
  const playbackResult = resolved.football.match.lastResolvedResult;
  if (resolved.football.match.status !== "in-progress") return resolved;
  if (resolved.football.match.participationMode === "every-snap") return advancePastBenchSnaps(resolved);
  const advanced = advanceAutomatic(resolved, resolved.football.match.participationMode === "key-moments");
  if (!playbackEpisode || !playbackResult) return advanced;
  return {
    ...advanced,
    football: {
      ...advanced.football,
      match: { ...advanced.football.match, lastResolvedEpisode: playbackEpisode, lastResolvedResult: playbackResult },
    },
  };
}
