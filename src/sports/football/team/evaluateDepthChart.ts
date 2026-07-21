import type { CharacterState } from "../../../core/character/types";
import type { GameDate } from "../../../core/calendar/types";
import type { FootballCareerState } from "../career/types";
import { scoreHeroForDepthChart, scoreRosterPlayer } from "./generateTeam";
import type { DepthChartDecision, DepthChartEvaluation, FootballRosterPlayer } from "./types";

function dateKey(date: GameDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function reasonsFor(
  football: FootballCareerState,
  character: CharacterState,
  directRival: FootballRosterPlayer | undefined,
): string[] {
  const reasons: string[] = [];
  if (football.depthChart.coachTrust >= 68) reasons.push("Штаб доверяет выполнению задания и подготовке.");
  if (football.depthChart.coachTrust < 55) reasons.push("Доверия штаба пока недостаточно для стабильных первых повторений.");
  if (character.condition.fatigue >= 65) reasons.push("Накопленная усталость снижает качество тренировочных повторений.");
  if (character.condition.health < 82) reasons.push("Медицинская готовность ограничивает нагрузку и роль.");
  if (football.ratings.footballIq >= 72) reasons.push("Понимание схемы усиливает позицию в решениях тренеров.");
  if (directRival) {
    if (football.ratings.technique >= directRival.overall) reasons.push("Техника героя уже выдерживает сравнение с ближайшим конкурентом.");
    else reasons.push(`Ближайший конкурент сильнее в текущей оценке: ${directRival.overall} OVR.`);
  }
  return reasons.slice(0, 3);
}

export function evaluateDepthChart(
  football: FootballCareerState,
  character: CharacterState,
  date: GameDate,
): Pick<FootballCareerState["depthChart"], "rank" | "projectedRole" | "directRival" | "evaluation" | "lastDecision"> {
  const room = football.roster
    .filter((player) => player.position === football.position)
    .map((player) => ({ player, score: scoreRosterPlayer(player) }))
    .sort((left, right) => right.score - left.score);
  const heroScore = scoreHeroForDepthChart(football.ratings, character, football.depthChart.coachTrust);
  const combined = [
    { id: "hero", score: heroScore, player: undefined as FootballRosterPlayer | undefined },
    ...room.map((entry) => ({ id: entry.player.id, score: entry.score, player: entry.player })),
  ].sort((left, right) => right.score - left.score);
  const rank = combined.findIndex((entry) => entry.id === "hero") + 1;
  const nearest = rank > 1 ? combined[rank - 2] : combined[1];
  const directRival = nearest?.player ?? room[0]?.player;
  if (!directRival) {
    throw new Error("Position room has no rival");
  }
  const comparisonScore = nearest?.score ?? heroScore;
  const gap = round(rank === 1 ? heroScore - comparisonScore : comparisonScore - heroScore);
  const previousRank = football.depthChart.rank;
  const trend: DepthChartEvaluation["trend"] = rank < previousRank ? "rising" : rank > previousRank ? "falling" : "stable";
  const projectedRole: FootballCareerState["depthChart"]["projectedRole"] = rank === 1
    ? "starter"
    : rank <= 3
      ? "rotation"
      : football.depthChart.coachTrust >= 54
        ? "special-teams"
        : "developmental";
  const summary = rank === 1
    ? `Герой удерживает первое место. Запас над ближайшим игроком: ${Math.abs(gap).toFixed(1)}.`
    : `До позиции #${rank - 1} не хватает ${Math.abs(gap).toFixed(1)} пункта тренерской оценки.`;
  const decisionType: DepthChartDecision["type"] = rank < previousRank ? "promoted" : rank > previousRank ? "demoted" : "held";
  const lastDecision: DepthChartDecision = {
    type: decisionType,
    title: decisionType === "promoted" ? "Подъём в depth chart" : decisionType === "demoted" ? "Позиция потеряна" : "Роль сохранена",
    description: decisionType === "promoted"
      ? `Штаб поднял героя на место #${rank} после новой оценки тренировок и готовности.`
      : decisionType === "demoted"
        ? `Герой опустился на место #${rank}: штаб выбрал более готового игрока.`
        : `Штаб оставил героя на месте #${rank}. ${summary}`,
    occurredOn: dateKey(date),
  };
  return {
    rank,
    projectedRole,
    directRival: {
      id: directRival.id,
      name: directRival.name,
      year: directRival.year,
      overall: directRival.overall,
      style: directRival.style,
    },
    evaluation: {
      heroScore: round(heroScore),
      comparisonScore: round(comparisonScore),
      gap: Math.abs(gap),
      trend,
      summary,
      reasons: reasonsFor(football, character, directRival),
      updatedOn: dateKey(date),
    },
    lastDecision,
  };
}
