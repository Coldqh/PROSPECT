import type { FootballPosition } from "../career/types";
import type {
  MatchAdvancedStatLine,
  MatchEpisode,
  MatchEvaluationCategory,
  MatchEvaluationCriterion,
  MatchGameEvaluation,
  MatchLiveEvaluationSignals,
  MatchOutcomeGrade,
  MatchSnapEvaluation,
  MatchSnapResult,
  MatchStatLine,
} from "./types";

interface SnapEvaluationInput {
  position: FootballPosition;
  episode: MatchEpisode;
  assignmentScore: number;
  teamExecutionScore: number;
  snapResult: MatchSnapResult;
  yards: number;
  involved: boolean;
  pressureOccurred: boolean;
  statDelta: MatchStatLine;
  advancedDelta: MatchAdvancedStatLine;
  liveSignals?: MatchLiveEvaluationSignals | undefined;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 0) => Number(value.toFixed(digits));

export function gradeFromPerformanceScore(score: number): MatchOutcomeGrade {
  if (score >= 86) return "A";
  if (score >= 72) return "B";
  if (score >= 58) return "C";
  return "D";
}

function criterion(
  id: string,
  label: string,
  category: MatchEvaluationCategory,
  score: number,
  weight: number,
  detail: string,
): MatchEvaluationCriterion {
  const normalized = clamp(score);
  return {
    id,
    label,
    category,
    score: round(normalized, 1),
    weight,
    delta: round((normalized - 70) * weight / 100, 1),
    detail,
  };
}

function resultImpact(input: SnapEvaluationInput): number {
  let score = 64 + clamp(input.yards, -12, 25) * 1.1;
  if (input.snapResult === "touchdown" || input.snapResult === "defensive-touchdown") score += 25;
  if (input.snapResult === "turnover") score -= 32;
  if (input.snapResult === "sack") score += ["EDGE", "DT", "LB"].includes(input.position) ? 24 : -24;
  if (input.snapResult === "incomplete") score += ["CB", "S", "LB"].includes(input.position) ? 6 : -4;
  return clamp(score);
}

function routeCriteria(input: SnapEvaluationInput): MatchEvaluationCriterion[] {
  const signals = input.liveSignals;
  const adherence = signals?.routeAdherence ?? input.assignmentScore;
  const separation = signals?.separationScore
    ?? clamp(58 + input.advancedDelta.separationWins * 26 + input.advancedDelta.routeWins * 15 + (input.involved ? 4 : 0));
  const catchExecution = clamp(
    60
      + input.statDelta.receptions * 28
      + input.statDelta.receivingYards * 0.55
      + input.statDelta.touchdowns * 18
      - Math.max(0, input.statDelta.targets - input.statDelta.receptions) * 14,
  );
  const routeDetail = adherence >= 82
    ? "Траектория выдержана по глубине и таймингу."
    : adherence >= 65
      ? "Маршрут рабочий, но точка излома или глубина неточны."
      : separation >= 78
        ? "Маршрут нарушен, но импровизация создала отрыв."
        : "Отклонение от маршрута сломало тайминг розыгрыша.";
  return [
    criterion("route", "Маршрут", "assignment", adherence, 34, routeDetail),
    criterion("separation", "Отрыв", "technique", separation, 28, separation >= 78 ? "Защитник потерял рычаг и дистанцию." : "Защитник удержал рабочую дистанцию."),
    criterion("finish", "Работа с мячом", "execution", input.involved ? catchExecution : 68, 22, input.involved ? "Оценены ловля, контроль и ярды после приёма." : "Мяч ушёл в другую часть поля."),
    criterion("impact", "Влияние", "impact", resultImpact(input), 16, "Учитывается итог снэпа без подмены качества маршрута результатом команды."),
  ];
}

function qbCriteria(input: SnapEvaluationInput): MatchEvaluationCriterion[] {
  const signals = input.liveSignals;
  const decision = signals?.decisionQuality ?? clamp(input.assignmentScore + (input.snapResult === "turnover" ? -24 : 0));
  const timing = signals?.timingScore ?? clamp(72 - Math.max(0, (signals?.timeToThrow ?? 2.7) - 3.2) * 14 - Math.max(0, 1.7 - (signals?.timeToThrow ?? 2.7)) * 9);
  const accuracy = clamp(58 + input.statDelta.completions * 28 - input.statDelta.turnovers * 34 + input.statDelta.passingYards * 0.35);
  return [
    criterion("read", "Чтение защиты", "decision", decision, 36, decision >= 78 ? "QB нашёл лучший доступный коридор." : "Решение не соответствовало окну и риску передачи."),
    criterion("timing", "Тайминг", "technique", timing, 22, `Время до решения: ${(signals?.timeToThrow ?? 0).toFixed(1)} сек.`),
    criterion("accuracy", "Точность", "execution", accuracy, 26, input.snapResult === "completion" || input.snapResult === "touchdown" ? "Мяч доставлен в рабочую точку." : "Передача не завершена."),
    criterion("impact", "Результат", "impact", resultImpact(input), 16, "Учитываются ярды, first down, давление и потери."),
  ];
}

function runnerCriteria(input: SnapEvaluationInput): MatchEvaluationCriterion[] {
  const vision = input.liveSignals?.decisionQuality ?? input.assignmentScore;
  const ballSecurity = input.statDelta.turnovers > 0 ? 18 : 84;
  return [
    criterion("lane", "Чтение блока", "decision", vision, 30, vision >= 75 ? "Выбрана свободная дорожка." : "Раннер вошёл в закрытый коридор."),
    criterion("burst", "Разгон и срез", "technique", clamp(62 + input.yards * 2.1), 24, "Оценены выход в линию и смена направления."),
    criterion("security", "Контроль мяча", "discipline", ballSecurity, 22, ballSecurity > 50 ? "Мяч защищён." : "Потеря резко снижает оценку."),
    criterion("impact", "Ярды после контакта", "impact", resultImpact(input), 24, "Оценивается созданный раннером результат."),
  ];
}

function lineCriteria(input: SnapEvaluationInput): MatchEvaluationCriterion[] {
  const passSnap = input.episode.playCall.playType === "pass" || input.episode.playCall.playType === "play-action" || input.episode.playCall.playType === "screen";
  const protection = clamp(input.assignmentScore + input.advancedDelta.passProtectionWins * 15 - input.statDelta.pressuresAllowed * 24 - input.statDelta.sacksAllowed * 36);
  const runBlock = clamp(input.assignmentScore + input.advancedDelta.runBlockWins * 15 + input.statDelta.pancakes * 18);
  return [
    criterion("assignment", passSnap ? "Protection" : "Run fit", "assignment", input.assignmentScore, 30, "Правильная цель блока и ответственность по схеме."),
    criterion("leverage", "Рычаг и руки", "technique", passSnap ? protection : runBlock, 34, passSnap ? "Удержание глубины кармана." : "Создание и удержание дорожки."),
    criterion("finish", "Завершение блока", "execution", clamp(66 + input.statDelta.pancakes * 25 - input.statDelta.sacksAllowed * 30), 20, "Оценивается удержание до ухода мяча."),
    criterion("discipline", "Дисциплина", "discipline", input.snapResult === "penalty" ? 25 : 78, 16, "Флаги и пропущенные задания снижают балл."),
  ];
}

function frontSevenCriteria(input: SnapEvaluationInput): MatchEvaluationCriterion[] {
  const pressure = clamp(55 + input.statDelta.sacks * 38 + input.statDelta.hurries * 18 + input.advancedDelta.pressures * 12);
  const runFit = clamp(input.assignmentScore + input.statDelta.runStops * 18 + input.statDelta.tacklesForLoss * 16);
  return [
    criterion("gap", "Своя зона", "assignment", runFit, 30, "Сохранение gap integrity и края защиты."),
    criterion("rush", "Pass rush", "technique", pressure, 28, "Давление оценивается даже без сэка."),
    criterion("finish", "Захват", "execution", clamp(60 + input.statDelta.tackles * 16 - input.advancedDelta.missedTackles * 28), 22, "Завершение контакта и ограничение ярдов."),
    criterion("impact", "Влияние", "impact", resultImpact(input), 20, "TFL, sack, hurry и остановка выноса."),
  ];
}

function coverageCriteria(input: SnapEvaluationInput): MatchEvaluationCriterion[] {
  const signals = input.liveSignals;
  const coverage = signals?.coverageScore ?? clamp(input.assignmentScore + input.advancedDelta.coverageWins * 18 + input.statDelta.passBreakups * 18 + input.statDelta.interceptions * 30);
  const finish = clamp(62 + input.statDelta.tackles * 14 + input.statDelta.passBreakups * 20 + input.statDelta.interceptions * 30 - input.advancedDelta.missedTackles * 28);
  return [
    criterion("leverage", "Позиция и рычаг", "assignment", coverage, 34, coverage >= 76 ? "Маршрут закрыт правильным плечом." : "Защитник потерял leverage или глубину."),
    criterion("eyes", "Чтение QB", "decision", signals?.decisionQuality ?? input.assignmentScore, 22, "Оцениваются ключи, реакция и передача угрозы."),
    criterion("ball", "Игра по мячу", "execution", finish, 26, "PBU и перехват ценятся, промахи по мячу штрафуются."),
    criterion("limit", "Ограничение ярдов", "impact", resultImpact({ ...input, yards: -input.yards }), 18, "После приёма нужно остановить продвижение."),
  ];
}

function specialistCriteria(input: SnapEvaluationInput): MatchEvaluationCriterion[] {
  const made = input.snapResult === "field-goal" || input.snapResult === "punt";
  return [
    criterion("operation", "Операция", "assignment", input.assignmentScore, 30, "Тайминг снэпа, холда и контакта."),
    criterion("accuracy", "Направление", "technique", made ? 88 : 38, 30, made ? "Мяч отправлен в заданную зону." : "Направление или высота удара потеряны."),
    criterion("power", "Дальность", "execution", clamp(58 + Math.abs(input.yards) * .8), 20, "Оценивается достаточная сила без потери контроля."),
    criterion("impact", "Полевое преимущество", "impact", resultImpact(input), 20, "Очки или качество смены позиции поля."),
  ];
}

export function evaluateSnapPerformance(input: SnapEvaluationInput): MatchSnapEvaluation {
  let criteria: MatchEvaluationCriterion[];
  if (input.position === "QB") criteria = qbCriteria(input);
  else if (input.position === "RB") criteria = runnerCriteria(input);
  else if (input.position === "WR" || input.position === "TE") criteria = routeCriteria(input);
  else if (input.position === "OT" || input.position === "OG" || input.position === "C") criteria = lineCriteria(input);
  else if (input.position === "EDGE" || input.position === "DT" || input.position === "LB") criteria = frontSevenCriteria(input);
  else if (input.position === "CB" || input.position === "S") criteria = coverageCriteria(input);
  else criteria = specialistCriteria(input);

  const totalWeight = criteria.reduce((sum, item) => sum + item.weight, 0) || 1;
  const score = round(criteria.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight, 1);
  const sorted = [...criteria].sort((left, right) => right.score - left.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  return {
    score,
    grade: gradeFromPerformanceScore(score),
    summary: `${strongest?.label ?? "Исполнение"}: ${Math.round(strongest?.score ?? score)}. ${weakest && weakest.score < 68 ? `Исправить: ${weakest.label.toLowerCase()}.` : "Критических ошибок нет."}`,
    criteria,
    strengths: sorted.filter((item) => item.score >= 78).slice(0, 2).map((item) => item.label),
    corrections: [...criteria].sort((left, right) => left.score - right.score).filter((item) => item.score < 68).slice(0, 2).map((item) => item.label),
  };
}

export function aggregateMatchEvaluation(position: FootballPosition, snaps: MatchSnapEvaluation[]): MatchGameEvaluation {
  if (snaps.length === 0) {
    return { score: 60, grade: "C", snapCount: 0, roleLabel: position, criteria: [], bestSnapIds: [], worstSnapIds: [], summary: "Игровых снэпов для оценки не было." };
  }
  const categories = new Map<string, { label: string; category: MatchEvaluationCategory; total: number; weight: number; samples: number }>();
  for (const snap of snaps) {
    for (const item of snap.criteria) {
      const current = categories.get(item.id) ?? { label: item.label, category: item.category, total: 0, weight: item.weight, samples: 0 };
      current.total += item.score;
      current.samples += 1;
      categories.set(item.id, current);
    }
  }
  const criteria = [...categories.entries()].map(([id, value]) => criterion(id, value.label, value.category, value.total / value.samples, value.weight, `Средняя оценка за ${value.samples} снэпов.`));
  const score = round(snaps.reduce((sum, snap) => sum + snap.score, 0) / snaps.length, 1);
  const ranked = snaps.map((snap, index) => ({ index, score: snap.score })).sort((left, right) => right.score - left.score);
  const weakest = [...criteria].sort((left, right) => left.score - right.score)[0];
  return {
    score,
    grade: gradeFromPerformanceScore(score),
    snapCount: snaps.length,
    roleLabel: position,
    criteria,
    bestSnapIds: ranked.slice(0, 3).map((entry) => String(entry.index)),
    worstSnapIds: ranked.slice(-3).reverse().map((entry) => String(entry.index)),
    summary: weakest && weakest.score < 68
      ? `Итог ${Math.round(score)}. Главная зона роста: ${weakest.label.toLowerCase()}.`
      : `Итог ${Math.round(score)}. Исполнение роли стабильно по основным критериям.`,
  };
}
