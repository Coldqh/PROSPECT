import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import { createEmptyAdvancedMatchStats, createEmptyMatchStats } from "../createMatchState";
import type {
  MatchAdvancedStatLine,
  MatchEpisode,
  MatchOutcomeGrade,
  MatchPlayerAssignment,
  MatchStatLine,
} from "../types";
import type { SnapSimulation } from "./internalTypes";

function makeAdvancedDelta(hero: MatchPlayerAssignment, grade: MatchOutcomeGrade, involved: boolean, pressureOccurred: boolean): MatchAdvancedStatLine {
  const won = grade === "A" || grade === "B";
  const doubleTeam = (hero.position === "OG" || hero.position === "C" || hero.position === "DT") && (hero.kind === "run-block" || hero.kind === "rush");
  return {
    snaps: 1,
    assignmentWins: won ? 1 : 0,
    assignmentLosses: grade === "D" ? 1 : 0,
    routeWins: hero.kind === "route" && won ? 1 : 0,
    separationWins: hero.kind === "route" && grade === "A" ? 1 : 0,
    blocksWon: (hero.kind === "run-block" || hero.kind === "pass-protection" || hero.kind === "kick-protection") && won ? 1 : 0,
    pressures: hero.kind === "rush" && pressureOccurred && grade === "A" ? 1 : 0,
    coverageWins: (hero.kind === "zone-coverage" || hero.kind === "man-coverage") && won ? 1 : 0,
    missedTackles: matchDefender(hero) && involved && grade === "D" ? 1 : 0,
    passProtectionWins: hero.kind === "pass-protection" && won ? 1 : 0,
    runBlockWins: hero.kind === "run-block" && won ? 1 : 0,
    doubleTeamWins: doubleTeam && won ? 1 : 0,
    kickQuality: hero.kind === "kick" ? Math.round(({ A: 4, B: 3, C: 2, D: 1 } as const)[grade]) : 0,
    puntQuality: hero.kind === "punt" ? Math.round(({ A: 4, B: 3, C: 2, D: 1 } as const)[grade]) : 0,
  };
}

function matchDefender(hero: MatchPlayerAssignment): boolean {
  return hero.unit === "defense";
}

export function makeStatDelta(
  save: CareerSave,
  episode: MatchEpisode,
  simulation: SnapSimulation,
  grade: MatchOutcomeGrade,
  random: SeededRandom,
): { stats: MatchStatLine; advanced: MatchAdvancedStatLine; involved: boolean } {
  const stats = createEmptyMatchStats();
  const hero = episode.assignments.find((assignment) => assignment.isHero);
  if (!hero) return { stats, advanced: createEmptyAdvancedMatchStats(), involved: false };
  const success = simulation.snapResult === "completion" || simulation.snapResult === "touchdown";
  let involved = false;

  if (save.football.position === "K") {
    involved = true;
    stats.fieldGoalsAttempted = 1;
    stats.fieldGoalsMade = simulation.snapResult === "field-goal" ? 1 : 0;
    stats.longestFieldGoal = stats.fieldGoalsMade ? simulation.kickDistance ?? episode.distance : 0;
  } else if (save.football.position === "P") {
    involved = true;
    stats.punts = 1;
    stats.puntYards = simulation.yards;
    stats.puntsInside20 = episode.fieldPosition + simulation.yards >= 80 ? 1 : 0;
    stats.returnYardsAllowed = simulation.puntReturnYards ?? 0;
  } else if (save.football.position === "QB") {
    if (simulation.ballCarrierSlot === hero.slot) {
      involved = true; stats.rushingAttempts = 1; stats.rushingYards = simulation.yards;
    } else if (episode.playCall.playType !== "run") {
      involved = true; stats.passingAttempts = 1; stats.completions = success ? 1 : 0; stats.passingYards = success ? Math.max(0, simulation.yards) : 0; stats.turnovers = simulation.turnover ? 1 : 0;
    }
  } else if (save.football.position === "RB") {
    if (simulation.ballCarrierSlot === hero.slot) {
      involved = true; stats.rushingAttempts = 1; stats.rushingYards = simulation.yards; stats.turnovers = simulation.turnover ? 1 : 0;
    }
    if (simulation.targetSlot === hero.slot) {
      involved = true; stats.targets = 1; stats.receptions = success ? 1 : 0; stats.receivingYards = success ? Math.max(0, simulation.yards) : 0;
    }
  } else if (save.football.position === "WR" || save.football.position === "TE") {
    if (simulation.targetSlot === hero.slot) {
      involved = true; stats.targets = 1; stats.receptions = success ? 1 : 0; stats.receivingYards = success ? Math.max(0, simulation.yards) : 0;
    }
    if (hero.kind === "run-block" || hero.kind === "pass-protection") {
      involved = true;
      stats.pancakes = grade === "A" && random.chance(.28) ? 1 : 0;
      stats.pressuresAllowed = hero.kind === "pass-protection" && simulation.pressureOccurred && (grade === "C" || grade === "D") ? 1 : 0;
    }
  } else if (save.football.position === "OT" || save.football.position === "OG" || save.football.position === "C") {
    involved = true;
    const passSnap = hero.kind === "pass-protection";
    stats.sacksAllowed = passSnap && simulation.snapResult === "sack" && (grade === "C" || grade === "D") ? 1 : 0;
    stats.pressuresAllowed = passSnap && simulation.pressureOccurred && (grade === "C" || grade === "D") ? 1 : 0;
    stats.pancakes = hero.kind === "run-block" && grade === "A" && random.chance(.35) ? 1 : 0;
  } else if (save.football.position === "EDGE" || save.football.position === "DT" || save.football.position === "LB") {
    const runContact = simulation.ballCarrierSlot !== undefined && (hero.kind === "run-fit" || hero.kind === "rush") && random.chance(grade === "A" ? .72 : grade === "B" ? .48 : .23);
    const sackShare = save.football.position === "EDGE" ? .34 : save.football.position === "DT" ? .22 : .16;
    const gradeShare = grade === "A" ? .18 : grade === "B" ? .08 : 0;
    const involvementShare = episode.heroInvolvement === "primary" ? .08 : episode.heroInvolvement === "secondary" ? .03 : 0;
    const pressureContact = simulation.snapResult === "sack"
      && hero.kind === "rush"
      && random.chance(Math.min(.68, sackShare + gradeShare + involvementShare));
    const targetContact = simulation.targetSlot !== undefined && hero.matchupSlot === simulation.targetSlot;
    involved = runContact || pressureContact || targetContact || hero.kind === "rush";
    stats.tackles = runContact || pressureContact ? 1 : targetContact && simulation.snapResult === "completion" ? 1 : 0;
    stats.tacklesForLoss = stats.tackles > 0 && simulation.yards < 0 ? 1 : 0;
    stats.sacks = pressureContact ? 1 : 0;
    stats.hurries = hero.kind === "rush" && simulation.pressureOccurred && stats.sacks === 0 && (grade === "A" || grade === "B") ? 1 : 0;
    stats.runStops = runContact && simulation.yards <= 2 ? 1 : 0;
    stats.passBreakups = targetContact && simulation.snapResult === "incomplete" && (grade === "A" || grade === "B") ? 1 : 0;
    stats.interceptions = targetContact && simulation.turnover && grade === "A" ? 1 : 0;
    stats.coverageSnaps = simulation.targetSlot !== undefined && (hero.kind === "zone-coverage" || hero.kind === "man-coverage") ? 1 : 0;
  } else {
    const targetContact = simulation.targetSlot !== undefined && hero.matchupSlot === simulation.targetSlot;
    const runContact = simulation.ballCarrierSlot !== undefined && random.chance(grade === "A" ? .32 : grade === "B" ? .18 : .08);
    involved = targetContact || runContact;
    stats.tackles = (targetContact && simulation.snapResult === "completion") || runContact ? 1 : 0;
    stats.passBreakups = targetContact && simulation.snapResult === "incomplete" && (grade === "A" || grade === "B") ? 1 : 0;
    stats.interceptions = targetContact && simulation.turnover && grade === "A" ? 1 : 0;
    stats.coverageSnaps = simulation.targetSlot !== undefined ? 1 : 0;
    stats.runStops = runContact && simulation.yards <= 2 ? 1 : 0;
  }

  if (simulation.points === 7 && simulation.scoringSide === "hero") {
    const directOffensiveScore = episode.possession === "hero" && (
      simulation.ballCarrierSlot === hero.slot || simulation.targetSlot === hero.slot || save.football.position === "QB" && episode.playCall.playType !== "run"
    );
    const directDefensiveScore = episode.possession === "opponent" && stats.interceptions > 0;
    if (directOffensiveScore || directDefensiveScore) stats.touchdowns = 1;
  }

  return { stats, advanced: makeAdvancedDelta(hero, grade, involved, Boolean(simulation.pressureOccurred)), involved };
}
