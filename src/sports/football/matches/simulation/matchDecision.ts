import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import { updateRecruitingAfterMatch } from "../../recruiting/updateRecruiting";
import { applyCompletedMatchToSeason } from "../../season/updateSeason";
import { createEmptyAdvancedMatchStats, createEmptyMatchStats } from "../createMatchState";
import { decisionScoreCenter } from "../decisionForecast";
import { evaluateSnapPerformance } from "../performanceEvaluation";
import { decodeLivePlayOutcome } from "../realTimeEngine";
import { addMatchUsageStats, createEmptyMatchUsageStats, usageDeltaForSnap } from "../usage";
import type { FootballMatchState, MatchEpisodeResult, MatchTacticalCall } from "../types";
import { advanceDrive, advanceToSpecialOpportunity, backgroundDrive, driveSummary, finalizeScores, specialTeamsDecision, startControlledDrive } from "./driveSimulation";
import { generateEpisode } from "./episodeBuilder";
import type { SnapSimulation } from "./internalTypes";
import { addAdvancedStats, addStats, clamp, clampInteger, clockParts, gradeFromScore, otherSide, round } from "./matchMath";
import { finalResult, resultCopy } from "./matchResult";
import { fieldGoalChance, puntNetYards, ratingsForSide, specialistForSide } from "./matchupContext";
import { simulateSnap } from "./snapSimulation";
import { makeStatDelta } from "./statTracking";

export function resolveOneMatchDecision(save: CareerSave, optionId: string): CareerSave {
  const match = save.football.match;
  const episode = match.currentEpisode;
  if (match.status !== "in-progress" || !episode) throw new Error("Match has no active episode");
  const liveOutcome = decodeLivePlayOutcome(optionId);
  const selected = liveOutcome
    ? episode.options.find((item) => item.risk === "balanced") ?? episode.options[0]
    : episode.options.find((item) => item.id === optionId);
  if (!selected) throw new Error("Unknown match decision");
  const heroActive = episode.heroActive !== false;

  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:${episode.id}:${optionId}`);
  const assignmentScore = liveOutcome
    ? clamp(liveOutcome.assignmentScore)
    : clamp(decisionScoreCenter(save, match, selected) + random.integer(-16, 16));
  const preliminaryGrade = gradeFromScore(assignmentScore);
  const simulation: SnapSimulation = liveOutcome
    ? {
        snapResult: liveOutcome.snapResult,
        yards: liveOutcome.yards,
        points: liveOutcome.points,
        ...(liveOutcome.scoringSide ? { scoringSide: liveOutcome.scoringSide } : {}),
        turnover: liveOutcome.turnover,
        firstDown: liveOutcome.yards >= episode.distance,
        repeatDown: false,
        ...(liveOutcome.targetSlot ? { targetSlot: liveOutcome.targetSlot } : {}),
        ...(liveOutcome.ballCarrierSlot ? { ballCarrierSlot: liveOutcome.ballCarrierSlot } : {}),
        teamExecutionScore: liveOutcome.teamExecutionScore,
        description: liveOutcome.description,
        pressureOccurred: liveOutcome.pressureOccurred,
        ...(liveOutcome.grossPuntYards !== undefined ? { grossPuntYards: liveOutcome.grossPuntYards } : {}),
        ...(liveOutcome.puntReturnYards !== undefined ? { puntReturnYards: liveOutcome.puntReturnYards } : {}),
        ...(liveOutcome.kickDistance !== undefined ? { kickDistance: liveOutcome.kickDistance } : {}),
      }
    : simulateSnap(save, match, episode, assignmentScore, selected, random);
  const statResolution = heroActive
    ? liveOutcome
      ? { stats: liveOutcome.statDelta, advanced: liveOutcome.advancedDelta, involved: liveOutcome.heroInvolved }
      : makeStatDelta(save, episode, simulation, preliminaryGrade, random)
    : { stats: createEmptyMatchStats(), advanced: createEmptyAdvancedMatchStats(), involved: false };
  const usageDelta = heroActive
    ? usageDeltaForSnap(
      save.football.position,
      episode,
      simulation.targetSlot,
      simulation.ballCarrierSlot,
      liveOutcome?.evaluationSignals ?? {
        heroOpenWindow: Boolean(simulation.heroOpenWindow),
        targetedWhenOpen: Boolean(simulation.heroOpenWindow && simulation.targetSlot === episode.heroSlot),
        separationYards: simulation.heroSeparationYards,
      },
      statResolution.advanced,
    )
    : createEmptyMatchUsageStats();
  const evaluation = heroActive ? evaluateSnapPerformance({
    position: save.football.position,
    episode,
    assignmentScore,
    teamExecutionScore: simulation.teamExecutionScore,
    snapResult: simulation.snapResult,
    yards: simulation.yards,
    involved: statResolution.involved,
    pressureOccurred: Boolean(simulation.pressureOccurred),
    statDelta: statResolution.stats,
    advancedDelta: statResolution.advanced,
    liveSignals: liveOutcome?.evaluationSignals,
  }) : undefined;
  const grade = evaluation?.grade ?? gradeFromScore(simulation.teamExecutionScore);
  const coachDelta = evaluation ? round((evaluation.score - 68) * .055, 1) : 0;
  const confidenceDelta = evaluation ? round((evaluation.score - 68) * .028, 1) : 0;
  const fatigueDelta = heroActive ? round(1 + selected.difficulty * .013 + (selected.risk === "aggressive" ? .65 : 0), 1) : 0;
  const snapTime = liveOutcome
    ? clampInteger(liveOutcome.elapsedSeconds + (simulation.snapResult === "incomplete" ? 8 : 24), 8, 42)
    : simulation.snapResult === "incomplete" || simulation.snapResult === "penalty"
      ? random.integer(7, 16)
      : random.integer(24, 39);
  let gameClockSeconds = Math.max(0, match.gameClockSeconds - snapTime);
  const clock = clockParts(gameClockSeconds);
  const advance = advanceDrive(episode, simulation);
  const copy = resultCopy(episode, simulation, grade, statResolution.involved);
  const outcome: MatchEpisodeResult = {
    id: `${episode.id}-result`,
    episodeId: episode.id,
    driveId: episode.driveId,
    optionId: liveOutcome?.actionId ?? optionId,
    grade,
    snapResult: simulation.snapResult,
    ...copy,
    yards: simulation.yards,
    points: simulation.points,
    scoringSide: simulation.scoringSide,
    coachDelta,
    confidenceDelta,
    fatigueDelta,
    assignmentScore,
    teamExecutionScore: simulation.teamExecutionScore,
    involved: statResolution.involved,
    firstDown: advance.firstDown,
    driveEnded: advance.driveEnded,
    startFieldPosition: episode.fieldPosition,
    endFieldPosition: advance.nextFieldPosition,
    pressureOccurred: Boolean(simulation.pressureOccurred),
    grossPuntYards: simulation.grossPuntYards,
    puntReturnYards: simulation.puntReturnYards,
    kickDistance: simulation.kickDistance,
    targetSlot: simulation.targetSlot,
    ballCarrierSlot: simulation.ballCarrierSlot,
    statDelta: statResolution.stats,
    advancedDelta: statResolution.advanced,
    ...(evaluation ? { evaluation } : {}),
  };

  let heroScore = match.heroScore + (simulation.scoringSide === "hero" ? simulation.points : 0);
  let opponentScore = match.opponentScore + (simulation.scoringSide === "opponent" ? simulation.points : 0);
  let driveEnded = advance.driveEnded;
  let driveOutcome = advance.outcome;
  let drivePoints = simulation.scoringSide === episode.possession ? simulation.points : 0;
  let driveDescription = simulation.description;
  let nextDown = advance.nextDown;
  let nextDistance = advance.nextDistance;
  let nextFieldPosition = advance.nextFieldPosition;
  let drivePlays = match.drivePlays + 1;
  let driveYards = match.driveYards + simulation.yards;
  let drives = [...match.drives];
  let nextPossessionStartFieldPosition: number | undefined;
  if (episode.unit === "special") {
    nextPossessionStartFieldPosition = simulation.snapResult === "punt"
      ? clampInteger(100 - nextFieldPosition, 5, 80)
      : simulation.snapResult === "missed-field-goal"
        ? clampInteger(100 - episode.fieldPosition, 20, 75)
        : 25;
  }

  if (!driveEnded) {
    const temporary = {
      ...match,
      quarter: clock.quarter,
      clockSeconds: clock.clockSeconds,
      gameClockSeconds,
      driveDown: nextDown,
      driveDistance: nextDistance,
      driveFieldPosition: nextFieldPosition,
    };
    const offenseMargin = episode.possession === "hero" ? heroScore - opponentScore : opponentScore - heroScore;
    const special = specialTeamsDecision(temporary, offenseMargin);
    if (special === "punt") {
      driveEnded = true;
      driveOutcome = "punt";
      const punter = specialistForSide(save, episode.possession, "P");
      const netYards = Math.min(99 - nextFieldPosition, puntNetYards(punter, random));
      nextPossessionStartFieldPosition = clampInteger(100 - (nextFieldPosition + netYards), 8, 45);
      driveDescription = `${punter.name} выполняет пант на ${netYards} ярдов.`;
      gameClockSeconds = Math.max(0, gameClockSeconds - random.integer(8, 16));
    } else if (special === "field-goal") {
      driveEnded = true;
      const kickDistance = 117 - nextFieldPosition;
      const offenseRatings = ratingsForSide(save, episode.possession);
      const kicker = specialistForSide(save, episode.possession, "K");
      const made = random.chance(fieldGoalChance(kicker, kickDistance, offenseRatings.coaching));
      driveOutcome = made ? "field-goal" : "missed-field-goal";
      drivePoints = made ? 3 : 0;
      driveDescription = made
        ? `${kicker.name} реализует филд-гол с ${kickDistance} ярдов.`
        : `${kicker.name} не реализует филд-гол с ${kickDistance} ярдов.`;
      nextPossessionStartFieldPosition = made ? 25 : clampInteger(100 - nextFieldPosition, 20, 75);
      if (made) {
        if (episode.possession === "hero") heroScore += 3;
        else opponentScore += 3;
      }
      gameClockSeconds = Math.max(0, gameClockSeconds - random.integer(5, 10));
    }
  }

  if (gameClockSeconds <= 0 && !driveEnded) {
    driveEnded = true;
    driveOutcome = "end-game";
    driveDescription = "Время матча истекло на текущем владении.";
  }

  const offenseCallForMemory = match.heroUnit === "offense" ? episode.playCall : episode.opponentCall;
  const tacticalCall: MatchTacticalCall = {
    id: offenseCallForMemory.id,
    concept: offenseCallForMemory.concept,
    playType: offenseCallForMemory.playType,
    tags: [...offenseCallForMemory.tags],
    yards: outcome.yards,
    success: outcome.firstDown || outcome.points > 0 || outcome.yards >= Math.max(4, episode.distance),
  };
  const offenseMemoryKey = episode.possession === "hero" ? "heroOffense" : "opponentOffense";
  const tacticalMemory = {
    ...match.tacticalMemory,
    [offenseMemoryKey]: [...match.tacticalMemory[offenseMemoryKey], tacticalCall].slice(-16),
  };

  let nextMatch: FootballMatchState = {
    ...match,
    heroScore,
    opponentScore,
    quarter: clockParts(gameClockSeconds).quarter,
    clockSeconds: clockParts(gameClockSeconds).clockSeconds,
    gameClockSeconds,
    playClockSeconds: 25,
    heroFatigue: clamp(match.heroFatigue + fatigueDelta),
    coachGrade: heroActive && evaluation
      ? round((match.completedEpisodes.reduce((sum, item) => sum + (item.evaluation?.score ?? 0), 0) + evaluation.score) / (match.completedEpisodes.filter((item) => item.evaluation).length + 1), 1)
      : match.coachGrade,
    episodeIndex: match.episodeIndex + 1,
    driveDown: nextDown,
    driveDistance: nextDistance,
    driveFieldPosition: nextFieldPosition,
    drivePlays,
    driveYards,
    tacticalMemory,
    completedEpisodes: heroActive ? [...match.completedEpisodes, { ...outcome, driveEnded }] : match.completedEpisodes,
    lastResolvedEpisode: heroActive ? episode : undefined,
    lastResolvedResult: heroActive ? { ...outcome, driveEnded } : undefined,
    stats: addStats(match.stats, statResolution.stats),
    advancedStats: addAdvancedStats(match.advancedStats, statResolution.advanced),
    usageStats: addMatchUsageStats(match.usageStats, usageDelta),
    currentEpisode: undefined,
  };

  if (driveEnded) {
    const endClock = clockParts(gameClockSeconds);
    const controlledSummary = driveSummary(
      { ...nextMatch, drivePlays, driveYards },
      endClock,
      nextFieldPosition,
      driveOutcome,
      drivePoints,
      driveDescription,
    );
    drives.push(controlledSummary);

    if (gameClockSeconds <= 0) {
      nextMatch = { ...nextMatch, heroScore, opponentScore, drives };
    } else if (driveOutcome === "defensive-touchdown") {
      nextMatch = startControlledDrive(
        { ...nextMatch, heroScore, opponentScore, drives },
        gameClockSeconds,
        25,
        match.driveNumber + 1,
      );
    } else {
      const backgroundOffense = otherSide(episode.possession);
      const backgroundStart = nextPossessionStartFieldPosition
        ?? (driveOutcome === "turnover" || driveOutcome === "turnover-on-downs" || driveOutcome === "missed-field-goal"
          ? clampInteger(100 - nextFieldPosition, 20, 75)
          : 25);
      const background = backgroundDrive(
        save,
        backgroundOffense,
        gameClockSeconds,
        backgroundStart,
        match.driveNumber + 1,
        `${save.meta.worldSeed}:${match.gameId}:background:${match.driveNumber + 1}`,
      );
      heroScore += background.heroScoreDelta;
      opponentScore += background.opponentScoreDelta;
      drives.push(background.summary);
      nextMatch = {
        ...nextMatch,
        heroScore,
        opponentScore,
        drives,
      };
      nextMatch = startControlledDrive(nextMatch, background.gameClockSeconds, background.nextControlledFieldPosition, match.driveNumber + 2);
    }
  } else {
    nextMatch = { ...nextMatch, drives };
  }

  const nextCharacter = {
    ...save.character,
    condition: {
      ...save.character.condition,
      confidence: clamp(save.character.condition.confidence + confidenceDelta),
      fatigue: clamp(save.character.condition.fatigue + fatigueDelta * .34),
      energy: clamp(save.character.condition.energy - fatigueDelta * .27),
    },
  };

  if (nextMatch.heroUnit === "special" && nextMatch.gameClockSeconds > 0) {
    nextMatch = advanceToSpecialOpportunity(save, nextMatch, nextMatch.episodeIndex);
  }
  const shouldFinish = nextMatch.episodeIndex >= nextMatch.totalEpisodes || nextMatch.gameClockSeconds <= 0;
  let nextFootball = save.football;
  let history = save.history;

  if (shouldFinish) {
    const completedClock = nextMatch.gameClockSeconds <= 0
      ? nextMatch
      : finalizeScores(save, nextMatch);
    const result = finalResult(completedClock, save);
    nextMatch = {
      ...completedClock,
      status: "complete",
      heroScore: result.heroScore,
      opponentScore: result.opponentScore,
      quarter: 4,
      clockSeconds: 0,
      gameClockSeconds: 0,
      finalResult: result,
      currentEpisode: undefined,
    };
    if (save.meta.phase === "college-season" && save.football.college.heroCareer) {
      const career = save.football.college.heroCareer;
      nextFootball = {
        ...save.football,
        match: nextMatch,
        college: {
          ...save.football.college,
          heroCareer: {
            ...career,
            coachTrust: clamp(career.coachTrust + result.coachTrustDelta),
            lockerRoomStanding: clamp(career.lockerRoomStanding + (result.grade === "A" ? 3 : result.grade === "B" ? 1 : result.grade === "D" ? -2 : 0)),
            lastSummary: `${result.summary} ${result.spotlight}.`,
          },
        },
      };
    } else if (save.meta.phase === "professional-career") {
      nextFootball = { ...save.football, match: nextMatch };
    } else {
      const season = applyCompletedMatchToSeason(save, nextMatch);
      nextFootball = {
        ...save.football,
        match: nextMatch,
        season,
        depthChart: {
          ...save.football.depthChart,
          coachTrust: clamp(save.football.depthChart.coachTrust + result.coachTrustDelta),
        },
        recruitment: save.football.recruitment,
      };
      const recruitingSave: CareerSave = { ...save, character: nextCharacter, football: nextFootball };
      nextFootball = { ...nextFootball, recruitment: updateRecruitingAfterMatch(recruitingSave, nextMatch) };
    }
    history = [
      ...history,
      {
        id: `${match.gameId}-complete`,
        occurredAt: save.meta.updatedAt,
        type: "match-completed",
        title: `${result.won ? "Победа" : "Поражение"} ${result.heroScore}:${result.opponentScore}`,
        description: `${result.summary} ${result.spotlight}.`,
      },
    ];
  } else {
    nextMatch = { ...nextMatch, currentEpisode: generateEpisode(save, nextMatch, nextMatch.episodeIndex) };
    nextFootball = { ...save.football, match: nextMatch };
  }

  return { ...save, character: nextCharacter, football: nextFootball, history };
}
