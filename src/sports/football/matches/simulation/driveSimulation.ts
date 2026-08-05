import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import type {
  FootballMatchState,
  MatchDriveOutcome,
  MatchDriveSummary,
  MatchEpisode,
  MatchTeamSide,
} from "../types";
import type { BackgroundDriveResult, DriveAdvance, SnapSimulation } from "./internalTypes";
import { clampInteger, clockParts, controlledOffense, otherSide } from "./matchMath";
import { fieldGoalChance, puntNetYards, ratingsForSide, specialistForSide } from "./matchupContext";

export function advanceDrive(episode: MatchEpisode, simulation: SnapSimulation): DriveAdvance {
  const nextFieldPosition = clampInteger(episode.fieldPosition + simulation.yards, 1, 99);
  if (simulation.snapResult === "field-goal") return { driveEnded: true, outcome: "field-goal", nextDown: 1, nextDistance: 10, nextFieldPosition: 25, firstDown: false };
  if (simulation.snapResult === "missed-field-goal") return { driveEnded: true, outcome: "missed-field-goal", nextDown: 1, nextDistance: 10, nextFieldPosition: episode.fieldPosition, firstDown: false };
  if (simulation.snapResult === "punt") return { driveEnded: true, outcome: "punt", nextDown: 1, nextDistance: 10, nextFieldPosition, firstDown: false };
  if (simulation.snapResult === "touchdown") return { driveEnded: true, outcome: "touchdown", nextDown: 1, nextDistance: 10, nextFieldPosition: 25, firstDown: true };
  if (simulation.snapResult === "defensive-touchdown") return { driveEnded: true, outcome: "defensive-touchdown", nextDown: 1, nextDistance: 10, nextFieldPosition: 25, firstDown: false };
  if (simulation.turnover) {
    const turnoverSpot = clampInteger(episode.fieldPosition + simulation.yards, 1, 99);
    return { driveEnded: true, outcome: "turnover", nextDown: 1, nextDistance: 10, nextFieldPosition: turnoverSpot, firstDown: false };
  }
  if (simulation.repeatDown) return { driveEnded: false, outcome: "active", nextDown: episode.down, nextDistance: clampInteger(episode.distance - simulation.yards, 1, 99), nextFieldPosition, firstDown: false };
  const firstDown = simulation.yards >= episode.distance;
  if (firstDown) return { driveEnded: false, outcome: "active", nextDown: 1, nextDistance: Math.min(10, 100 - nextFieldPosition), nextFieldPosition, firstDown: true };
  if (episode.down === 4) return { driveEnded: true, outcome: "turnover-on-downs", nextDown: 1, nextDistance: 10, nextFieldPosition, firstDown: false };
  return {
    driveEnded: false,
    outcome: "active",
    nextDown: (episode.down + 1) as 2 | 3 | 4,
    nextDistance: clampInteger(episode.distance - simulation.yards, 1, 99),
    nextFieldPosition,
    firstDown: false,
  };
}

export function specialTeamsDecision(match: FootballMatchState, scoreMargin: number): "punt" | "field-goal" | "go" {
  if (match.driveDown !== 4) return "go";
  const lateNeed = match.quarter === 4 && match.clockSeconds < 240 && scoreMargin < 0;
  if (lateNeed && match.driveDistance <= 7) return "go";
  if (match.driveFieldPosition >= 63 && match.driveDistance <= 9) return "field-goal";
  if (match.driveDistance <= 2 && match.driveFieldPosition >= 45) return "go";
  return "punt";
}

export function driveSummary(
  match: FootballMatchState,
  endClock: { quarter: 1 | 2 | 3 | 4; clockSeconds: number },
  fieldPosition: number,
  outcome: MatchDriveOutcome,
  points: number,
  description: string,
): MatchDriveSummary {
  return {
    id: match.currentDriveId,
    offense: controlledOffense(match),
    startQuarter: match.driveStartQuarter,
    startClockSeconds: match.driveStartClockSeconds,
    endQuarter: endClock.quarter,
    endClockSeconds: endClock.clockSeconds,
    startFieldPosition: match.driveStartFieldPosition,
    endFieldPosition: fieldPosition,
    plays: match.drivePlays,
    yards: match.driveYards,
    points,
    outcome,
    description,
    controlled: true,
  };
}

export function backgroundDrive(
  save: CareerSave,
  offenseSide: MatchTeamSide,
  gameClockSeconds: number,
  startFieldPosition: number,
  driveNumber: number,
  seed: string,
): BackgroundDriveResult {
  const random = new SeededRandom(seed);
  const defenseSide = otherSide(offenseSide);
  const offenseRatings = ratingsForSide(save, offenseSide);
  const defenseRatings = ratingsForSide(save, defenseSide);
  const edge = (offenseRatings.offense + offenseRatings.coaching * .25 + offenseRatings.cohesion * .15)
    - (defenseRatings.defense + defenseRatings.coaching * .25 + defenseRatings.cohesion * .15)
    + random.integer(-24, 24);
  const plays = clampInteger(5 + Math.round(edge / 12) + random.integer(-2, 3), 3, 12);
  const timeUsed = Math.min(gameClockSeconds, clampInteger(plays * random.integer(24, 37), 70, 390));
  const nextClock = Math.max(0, gameClockSeconds - timeUsed);
  const start = clockParts(gameClockSeconds);
  const end = clockParts(nextClock);
  let outcome: MatchDriveOutcome;
  let points = 0;
  let yards = clampInteger(28 + edge * 1.15 + random.integer(-18, 25), 4, 90);
  if (edge >= 18 || startFieldPosition + yards >= 100) {
    outcome = "touchdown";
    points = 7;
    yards = Math.min(100 - startFieldPosition, Math.max(yards, 35));
  } else if (edge >= 7 && startFieldPosition + yards >= 55) {
    const kicker = specialistForSide(save, offenseSide, "K");
    const kickDistance = clampInteger(117 - clampInteger(startFieldPosition + yards, 1, 99), 18, 69);
    const made = random.chance(fieldGoalChance(kicker, kickDistance, offenseRatings.coaching));
    outcome = made ? "field-goal" : "missed-field-goal";
    points = made ? 3 : 0;
  } else if (edge <= -18 && random.chance(.62)) {
    outcome = "turnover";
  } else {
    outcome = "punt";
  }
  const heroScoreDelta = offenseSide === "hero" ? points : 0;
  const opponentScoreDelta = offenseSide === "opponent" ? points : 0;
  const punter = specialistForSide(save, offenseSide, "P");
  const nextControlledFieldPosition = outcome === "turnover"
    ? random.integer(38, 68)
    : outcome === "punt"
      ? clampInteger(100 - Math.min(99, startFieldPosition + yards + puntNetYards(punter, random)), 8, 45)
      : outcome === "missed-field-goal"
        ? clampInteger(100 - clampInteger(startFieldPosition + yards, 1, 99), 20, 75)
        : 25;
  return {
    summary: {
      id: `drive-${driveNumber}-auto`,
      offense: offenseSide,
      startQuarter: start.quarter,
      startClockSeconds: start.clockSeconds,
      endQuarter: end.quarter,
      endClockSeconds: end.clockSeconds,
      startFieldPosition,
      endFieldPosition: clampInteger(startFieldPosition + yards, 1, 99),
      plays,
      yards,
      points,
      outcome,
      description: outcome === "touchdown"
        ? "Автоматический драйв завершается тачдауном."
        : outcome === "field-goal"
          ? "Кикер автоматического юнита реализует филд-гол."
          : outcome === "missed-field-goal"
            ? "Кикер автоматического юнита не реализует филд-гол."
            : outcome === "turnover"
              ? "Защита забирает мяч на автоматическом драйве."
              : "Пантер автоматического юнита меняет позицию поля.",
      controlled: false,
    },
    heroScoreDelta,
    opponentScoreDelta,
    nextControlledFieldPosition,
    gameClockSeconds: nextClock,
  };
}

export function advanceToSpecialOpportunity(save: CareerSave, match: FootballMatchState, opportunityIndex: number): FootballMatchState {
  const position = save.football.position;
  if (position !== "K" && position !== "P") return match;
  let next = match;
  let offense: MatchTeamSide = next.possession;
  let startFieldPosition = next.driveFieldPosition;
  let driveNumber = next.driveNumber;
  let safety = 0;

  while (next.gameClockSeconds > 0 && safety < 28) {
    if (offense === "opponent") {
      const background = backgroundDrive(
        save,
        "opponent",
        next.gameClockSeconds,
        startFieldPosition,
        driveNumber,
        `${save.meta.worldSeed}:${match.gameId}:special-opponent:${opportunityIndex}:${driveNumber}`,
      );
      next = {
        ...next,
        heroScore: next.heroScore + background.heroScoreDelta,
        opponentScore: next.opponentScore + background.opponentScoreDelta,
        gameClockSeconds: background.gameClockSeconds,
        quarter: clockParts(background.gameClockSeconds).quarter,
        clockSeconds: clockParts(background.gameClockSeconds).clockSeconds,
        drives: [...next.drives, background.summary],
      };
      offense = "hero";
      startFieldPosition = background.nextControlledFieldPosition;
      driveNumber += 1;
      safety += 1;
      continue;
    }

    const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:special-hero:${opportunityIndex}:${driveNumber}`);
    const offenseRatings = ratingsForSide(save, "hero");
    const defenseRatings = ratingsForSide(save, "opponent");
    const edge = offenseRatings.offense + offenseRatings.coaching * .22 + offenseRatings.cohesion * .14
      - defenseRatings.defense - defenseRatings.coaching * .2 - defenseRatings.cohesion * .12
      + random.integer(-22, 22);
    const plays = clampInteger(5 + Math.round(edge / 14) + random.integer(-2, 3), 3, 12);
    const timeUsed = Math.min(next.gameClockSeconds, clampInteger(plays * random.integer(23, 36), 70, 390));
    const gameClockSeconds = Math.max(0, next.gameClockSeconds - timeUsed);
    const startClock = clockParts(next.gameClockSeconds);
    const endClock = clockParts(gameClockSeconds);
    const yards = clampInteger(24 + edge * 1.05 + random.integer(-16, 24), 3, 88);
    const endFieldPosition = clampInteger(startFieldPosition + yards, 1, 99);
    const touchdown = startFieldPosition + yards >= 100 || edge >= 24 && random.chance(.4);
    const turnover = !touchdown && edge <= -18 && random.chance(.42);

    if (!touchdown && !turnover) {
      const specialOpportunity = position === "K" ? endFieldPosition >= 56 : endFieldPosition < 72;
      if (specialOpportunity && gameClockSeconds > 0) {
        return {
          ...next,
          possession: "hero",
          quarter: endClock.quarter,
          clockSeconds: endClock.clockSeconds,
          gameClockSeconds,
          driveDown: 4,
          driveDistance: random.integer(1, 9),
          driveFieldPosition: endFieldPosition,
          driveNumber,
          currentDriveId: `${match.gameId}-drive-${driveNumber}`,
          driveStartQuarter: startClock.quarter,
          driveStartClockSeconds: startClock.clockSeconds,
          driveStartFieldPosition: startFieldPosition,
          drivePlays: plays,
          driveYards: yards,
        };
      }
    }

    let outcome: MatchDriveOutcome;
    let points = 0;
    let nextOpponentField = 25;
    if (touchdown) {
      outcome = "touchdown";
      points = 7;
    } else if (turnover) {
      outcome = "turnover";
      nextOpponentField = clampInteger(100 - endFieldPosition, 20, 72);
    } else if (position === "P" && endFieldPosition >= 72) {
      const kicker = specialistForSide(save, "hero", "K");
      const kickDistance = 117 - endFieldPosition;
      const made = random.chance(fieldGoalChance(kicker, kickDistance, offenseRatings.coaching));
      outcome = made ? "field-goal" : "missed-field-goal";
      points = made ? 3 : 0;
      nextOpponentField = made ? 25 : clampInteger(100 - endFieldPosition, 20, 75);
    } else {
      outcome = "punt";
      const punter = specialistForSide(save, "hero", "P");
      nextOpponentField = clampInteger(100 - Math.min(99, endFieldPosition + puntNetYards(punter, random)), 8, 45);
    }

    const summary: MatchDriveSummary = {
      id: `drive-${driveNumber}-special-background`,
      offense: "hero",
      startQuarter: startClock.quarter,
      startClockSeconds: startClock.clockSeconds,
      endQuarter: endClock.quarter,
      endClockSeconds: endClock.clockSeconds,
      startFieldPosition,
      endFieldPosition,
      plays,
      yards,
      points,
      outcome,
      description: `${outcome.toUpperCase()} · ${plays} · ${yards}`,
      controlled: false,
    };
    next = {
      ...next,
      heroScore: next.heroScore + points,
      gameClockSeconds,
      quarter: endClock.quarter,
      clockSeconds: endClock.clockSeconds,
      drives: [...next.drives, summary],
    };
    offense = "opponent";
    startFieldPosition = nextOpponentField;
    driveNumber += 1;
    safety += 1;
  }

  if (match.completedEpisodes.length === 0) {
    const gameClockSeconds = Math.max(1, next.gameClockSeconds);
    const clock = clockParts(gameClockSeconds);
    const fieldPosition = position === "K" ? 62 : 55;
    const driveStartFieldPosition = Math.max(1, fieldPosition - 8);
    return {
      ...next,
      possession: "hero",
      quarter: clock.quarter,
      clockSeconds: clock.clockSeconds,
      gameClockSeconds,
      driveDown: 4,
      driveDistance: position === "K" ? 6 : 8,
      driveFieldPosition: fieldPosition,
      driveNumber,
      currentDriveId: `${match.gameId}-drive-${driveNumber}`,
      driveStartQuarter: clock.quarter,
      driveStartClockSeconds: clock.clockSeconds,
      driveStartFieldPosition,
      drivePlays: 3,
      driveYards: fieldPosition - driveStartFieldPosition,
    };
  }

  return next;
}

export function finalizeScores(save: CareerSave, match: FootballMatchState): FootballMatchState {
  let gameClock = match.gameClockSeconds;
  let heroScore = match.heroScore;
  let opponentScore = match.opponentScore;
  const drives = [...match.drives];
  const controlledSide = controlledOffense(match);
  const currentDriveArchived = drives.some((drive) => drive.id === match.currentDriveId);

  if (gameClock > 0 && !currentDriveArchived && match.drivePlays > 0) {
    const remainder = backgroundDrive(
      save,
      controlledSide,
      gameClock,
      match.driveFieldPosition,
      match.driveNumber,
      `${save.meta.worldSeed}:${match.gameId}:closing-current:${match.driveNumber}`,
    );
    gameClock = remainder.gameClockSeconds;
    heroScore += remainder.heroScoreDelta;
    opponentScore += remainder.opponentScoreDelta;
    drives.push({
      ...remainder.summary,
      id: match.currentDriveId,
      startQuarter: match.driveStartQuarter,
      startClockSeconds: match.driveStartClockSeconds,
      startFieldPosition: match.driveStartFieldPosition,
      plays: match.drivePlays + remainder.summary.plays,
      yards: match.driveYards + remainder.summary.yards,
      description: `Остаток управляемого владения доигран штабом. ${remainder.summary.description}`,
      controlled: true,
    });
  }

  let offense: MatchTeamSide = currentDriveArchived ? otherSide(controlledSide) : controlledSide;
  if (match.drivePlays > 0 && !currentDriveArchived) offense = otherSide(controlledSide);
  let counter = match.driveNumber + 1;
  while (gameClock > 0) {
    const drive = backgroundDrive(save, offense, gameClock, 25, counter, `${save.meta.worldSeed}:${match.gameId}:closing:${counter}`);
    gameClock = drive.gameClockSeconds;
    heroScore += drive.heroScoreDelta;
    opponentScore += drive.opponentScoreDelta;
    drives.push(drive.summary);
    offense = otherSide(offense);
    counter += 1;
  }
  if (heroScore === opponentScore) {
    const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:overtime`);
    if (random.chance(.5)) heroScore += 3;
    else opponentScore += 3;
  }
  return { ...match, heroScore, opponentScore, gameClockSeconds: 0, quarter: 4, clockSeconds: 0, drives };
}

export function startControlledDrive(match: FootballMatchState, gameClockSeconds: number, fieldPosition: number, driveNumber: number): FootballMatchState {
  const clock = clockParts(gameClockSeconds);
  return {
    ...match,
    possession: controlledOffense(match),
    quarter: clock.quarter,
    clockSeconds: clock.clockSeconds,
    gameClockSeconds,
    playClockSeconds: 25,
    driveDown: 1,
    driveDistance: Math.min(10, 100 - fieldPosition),
    driveFieldPosition: fieldPosition,
    driveNumber,
    currentDriveId: `${match.gameId}-drive-${driveNumber}`,
    driveStartQuarter: clock.quarter,
    driveStartClockSeconds: clock.clockSeconds,
    driveStartFieldPosition: fieldPosition,
    drivePlays: 0,
    driveYards: 0,
  };
}
