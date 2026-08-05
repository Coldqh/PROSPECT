import type { CareerSave } from "../../../../storage/saves/schema";
import type { FootballPosition } from "../../career/types";
import { aggregateMatchEvaluation } from "../performanceEvaluation";
import type {
  FootballMatchState,
  MatchEpisode,
  MatchEpisodeResult,
  MatchFinalResult,
  MatchOutcomeGrade,
} from "../types";
import type { SnapSimulation } from "./internalTypes";
import { round } from "./matchMath";

export function resultCopy(episode: MatchEpisode, simulation: SnapSimulation, grade: MatchOutcomeGrade, involved: boolean): Pick<MatchEpisodeResult, "headline" | "description"> {
  if (simulation.snapResult === "field-goal") return { headline: "Удар реализован", description: simulation.description };
  if (simulation.snapResult === "missed-field-goal") return { headline: "Промах", description: simulation.description };
  if (simulation.snapResult === "punt") return { headline: grade === "A" || grade === "B" ? "Поле перевёрнуто" : "Пант без преимущества", description: simulation.description };
  if (simulation.snapResult === "touchdown") return { headline: "Тачдаун", description: simulation.description };
  if (simulation.snapResult === "defensive-touchdown") return { headline: "Тачдаун защиты", description: simulation.description };
  if (simulation.turnover) return { headline: "Смена владения", description: simulation.description };
  if (simulation.snapResult === "sack") return { headline: "Сэк", description: simulation.description };
  if (simulation.snapResult === "penalty") return { headline: "Флаг", description: simulation.description };
  if (!involved) {
    return grade === "A" || grade === "B"
      ? { headline: "Назначение выполнено", description: `Мяч идёт в другую часть поля. ${episode.heroRole}. ${simulation.description}` }
      : { headline: "Ошибка без статистики", description: `Ты не касаешься мяча, но штаб фиксирует проблему в назначении. ${simulation.description}` };
  }
  if (episode.unit === "offense") {
    return simulation.yards >= episode.distance
      ? { headline: "Цепи двигаются", description: simulation.description }
      : simulation.yards > 0
        ? { headline: "Положительный снэп", description: simulation.description }
        : { headline: "Снэп проигран", description: simulation.description };
  }
  return simulation.yards <= 0
    ? { headline: "Защита выигрывает снэп", description: simulation.description }
    : simulation.yards < episode.distance
      ? { headline: "Атака остановлена до маркера", description: simulation.description }
      : { headline: "Защита отдаёт first down", description: simulation.description };
}

export function finalResult(match: FootballMatchState, save: CareerSave): MatchFinalResult {
  const evaluation = aggregateMatchEvaluation(
    save.football.position,
    match.completedEpisodes.map((item) => item.evaluation).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    match.stats,
    match.advancedStats,
  );
  const grade = evaluation.grade;
  const won = match.heroScore > match.opponentScore;
  const assignmentRate = match.advancedStats.snaps > 0
    ? Math.round(match.advancedStats.assignmentWins / match.advancedStats.snaps * 100)
    : 0;
  const spotlightByPosition: Record<FootballPosition, string> = {
    QB: `${match.stats.completions}/${match.stats.passingAttempts}, ${match.stats.passingYards} ярдов, задания ${assignmentRate}%`,
    RB: `${match.stats.rushingYards} ярдов, ${match.stats.receptions} приёмов, задания ${assignmentRate}%`,
    WR: `${match.stats.receptions}/${match.stats.targets}, ${match.stats.receivingYards} ярдов, OPEN ${match.usageStats.openWindows}, MISSED ${match.usageStats.missedOpenWindows}`,
    TE: `${match.stats.receptions}/${match.stats.targets}, ${match.stats.receivingYards} ярдов, OPEN ${match.usageStats.openWindows}, MISSED ${match.usageStats.missedOpenWindows}`,
    OT: `${match.advancedStats.passProtectionWins} побед в pass pro, sacks allowed ${match.stats.sacksAllowed}, pancakes ${match.stats.pancakes}`,
    OG: `${match.advancedStats.runBlockWins} побед в выносе, pressures allowed ${match.stats.pressuresAllowed}, pancakes ${match.stats.pancakes}`,
    C: `${match.advancedStats.passProtectionWins + match.advancedStats.runBlockWins} выигранных блоков, pressures allowed ${match.stats.pressuresAllowed}, задания ${assignmentRate}%`,
    EDGE: `${match.stats.sacks} sacks, ${match.stats.hurries} hurries, ${match.stats.runStops} run stops`,
    DT: `${match.stats.tacklesForLoss} TFL, ${match.stats.hurries} hurries, ${match.stats.runStops} run stops`,
    LB: `${match.stats.tackles} захватов, ${match.stats.sacks} sacks, pressures ${match.advancedStats.pressures}`,
    CB: `${match.stats.tackles} захватов, ${match.stats.passBreakups} PBU, coverage wins ${match.advancedStats.coverageWins}`,
    S: `${match.stats.tackles} захватов, ${match.stats.interceptions} INT, coverage wins ${match.advancedStats.coverageWins}`,
    K: `${match.stats.fieldGoalsMade}/${match.stats.fieldGoalsAttempted} FG, дальний ${match.stats.longestFieldGoal} ярдов`,
    P: `${match.stats.punts} пантов, ${match.stats.puntYards} net yards, inside 20: ${match.stats.puntsInside20}`,
  };
  const spotlight = spotlightByPosition[save.football.position];
  const coachTrustDelta = round((evaluation.score - 68) * .08, 1);
  const visibilityDelta = round(Math.max(0, (evaluation.score - 62) * .07) + (won ? .8 : 0), 1);
  return {
    won,
    heroScore: match.heroScore,
    opponentScore: match.opponentScore,
    grade,
    headline: won ? "ПОБЕДА" : "ПОРАЖЕНИЕ",
    summary: `${Math.round(evaluation.score)}`,
    spotlight,
    coachTrustDelta,
    visibilityDelta,
    score: evaluation.score,
    evaluation,
    usage: { ...match.usageStats },
  };
}
