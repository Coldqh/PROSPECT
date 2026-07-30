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
  const corrections = [...criteria]
    .sort((left, right) => left.score - right.score)
    .filter((item) => item.score < 68)
    .slice(0, 2)
    .map((item) => item.label);
  const passProtectionFailure = ["OT", "OG", "C"].includes(input.position)
    && (input.episode.playCall.playType === "pass" || input.episode.playCall.playType === "play-action" || input.episode.playCall.playType === "screen")
    && (input.statDelta.pressuresAllowed > 0 || input.statDelta.sacksAllowed > 0);
  if (passProtectionFailure && !corrections.includes("Protection")) {
    corrections.unshift("Protection");
    corrections.splice(2);
  }
  return {
    score,
    grade: gradeFromPerformanceScore(score),
    summary: `${strongest?.label ?? "Исполнение"}: ${Math.round(strongest?.score ?? score)}. ${weakest && weakest.score < 68 ? `Исправить: ${weakest.label.toLowerCase()}.` : "Критических ошибок нет."}`,
    criteria,
    strengths: sorted.filter((item) => item.score >= 78).slice(0, 2).map((item) => item.label),
    corrections,
  };
}

function averageCriterion(
  criteria: MatchEvaluationCriterion[],
  id: string,
  fallback = 68,
): number {
  return criteria.find((item) => item.id === id)?.score ?? fallback;
}

function blend(base: number, production: number, productionWeight: number): number {
  return clamp(base * (1 - productionWeight) + production * productionWeight);
}

function gameCriteria(
  position: FootballPosition,
  average: MatchEvaluationCriterion[],
  stats: MatchStatLine,
  advanced: MatchAdvancedStatLine,
): MatchEvaluationCriterion[] {
  const snaps = Math.max(1, advanced.snaps);
  const assignmentRate = advanced.assignmentWins / snaps;
  const assignmentBase = clamp(50 + assignmentRate * 50 - advanced.assignmentLosses / snaps * 28);
  const impactDetail = (parts: Array<string | undefined>) => parts.filter(Boolean).join(" · ");

  if (position === "QB") {
    const attempts = Math.max(1, stats.passingAttempts);
    const completionRate = stats.completions / attempts;
    const yardsPerAttempt = stats.passingYards / attempts;
    const decision = clamp(58 + completionRate * 25 + Math.min(18, yardsPerAttempt * 1.8) + stats.touchdowns * 7 - stats.turnovers * 24);
    const accuracy = clamp(42 + completionRate * 55 + Math.min(10, yardsPerAttempt) - stats.turnovers * 18);
    const impact = clamp(48 + stats.passingYards / 8 + stats.rushingYards / 10 + stats.touchdowns * 12 - stats.turnovers * 22);
    return [
      criterion("read", "Чтение защиты", "decision", blend(averageCriterion(average, "read"), decision, .62), 34, impactDetail([`${stats.completions}/${stats.passingAttempts}`, `${stats.turnovers} TO`])),
      criterion("timing", "Тайминг", "technique", blend(averageCriterion(average, "timing"), assignmentBase, .38), 20, `${advanced.assignmentWins}/${snaps}`),
      criterion("accuracy", "Точность", "execution", blend(averageCriterion(average, "accuracy"), accuracy, .72), 26, `${Math.round(completionRate * 100)}% · ${yardsPerAttempt.toFixed(1)} Y/A`),
      criterion("impact", "Результат", "impact", blend(averageCriterion(average, "impact"), impact, .76), 20, impactDetail([`${stats.passingYards} YD`, `${stats.touchdowns} TD`])),
    ];
  }

  if (position === "RB") {
    const touches = Math.max(1, stats.rushingAttempts + stats.receptions);
    const yards = stats.rushingYards + stats.receivingYards;
    const yardsPerTouch = yards / touches;
    const lane = clamp(50 + assignmentRate * 35 + Math.min(15, yardsPerTouch * 2));
    const burst = clamp(48 + Math.min(36, yardsPerTouch * 6) + stats.touchdowns * 8);
    const security = stats.turnovers > 0 ? clamp(55 - stats.turnovers * 25) : 88;
    const impact = clamp(45 + yards / 4 + stats.touchdowns * 15 - stats.turnovers * 24);
    return [
      criterion("lane", "Чтение блока", "decision", blend(averageCriterion(average, "lane"), lane, .58), 28, `${yardsPerTouch.toFixed(1)} Y/T`),
      criterion("burst", "Разгон и срез", "technique", blend(averageCriterion(average, "burst"), burst, .66), 24, `${yards} YD`),
      criterion("security", "Контроль мяча", "discipline", blend(averageCriterion(average, "security"), security, .72), 22, `${stats.turnovers} TO`),
      criterion("impact", "Результат", "impact", blend(averageCriterion(average, "impact"), impact, .76), 26, impactDetail([`${touches} TOUCH`, `${stats.touchdowns} TD`])),
    ];
  }

  if (position === "WR" || position === "TE") {
    const targets = Math.max(1, stats.targets);
    const catchRate = stats.receptions / targets;
    const yardsPerTarget = stats.receivingYards / targets;
    const routeRate = advanced.routeWins / snaps;
    const separationRate = advanced.separationWins / snaps;
    const route = clamp(46 + assignmentRate * 24 + routeRate * 30);
    const separation = clamp(48 + separationRate * 38 + Math.min(14, yardsPerTarget * 1.2));
    const finish = clamp(38 + catchRate * 50 + Math.min(12, yardsPerTarget) + stats.touchdowns * 10);
    const impact = clamp(45 + stats.receivingYards / 4 + stats.touchdowns * 16 + stats.receptions * 2);
    return [
      criterion("route", "Маршрут", "assignment", blend(averageCriterion(average, "route"), route, .56), 30, `${advanced.routeWins}/${snaps}`),
      criterion("separation", "Отрыв", "technique", blend(averageCriterion(average, "separation"), separation, .62), 26, `${advanced.separationWins}/${snaps}`),
      criterion("finish", "Мяч", "execution", blend(averageCriterion(average, "finish"), finish, .72), 22, `${stats.receptions}/${stats.targets}`),
      criterion("impact", "Результат", "impact", blend(averageCriterion(average, "impact"), impact, .76), 22, impactDetail([`${stats.receivingYards} YD`, `${stats.touchdowns} TD`])),
    ];
  }

  if (position === "OT" || position === "OG" || position === "C") {
    const passWinRate = advanced.passProtectionWins / snaps;
    const runWinRate = advanced.runBlockWins / snaps;
    const cleanRate = clamp(1 - (stats.pressuresAllowed + stats.sacksAllowed * 2) / snaps, 0, 1);
    const assignment = clamp(46 + assignmentRate * 38 + Math.max(passWinRate, runWinRate) * 16);
    const leverage = clamp(42 + cleanRate * 45 + (passWinRate + runWinRate) * 9);
    const finish = clamp(50 + (advanced.blocksWon / snaps) * 35 + stats.pancakes * 5 - stats.sacksAllowed * 22);
    const discipline = clamp(86 - stats.pressuresAllowed * 5 - stats.sacksAllowed * 18);
    return [
      criterion("assignment", "Задание", "assignment", blend(averageCriterion(average, "assignment"), assignment, .62), 30, `${advanced.assignmentWins}/${snaps}`),
      criterion("leverage", "Блок", "technique", blend(averageCriterion(average, "leverage"), leverage, .7), 32, impactDetail([`${stats.pressuresAllowed} PRESS ALW`, `${stats.sacksAllowed} SACK ALW`])),
      criterion("finish", "Завершение", "execution", blend(averageCriterion(average, "finish"), finish, .66), 22, `${advanced.blocksWon} WIN`),
      criterion("discipline", "Дисциплина", "discipline", blend(averageCriterion(average, "discipline"), discipline, .7), 16, `${stats.pancakes} PAN`),
    ];
  }

  if (position === "EDGE" || position === "DT" || position === "LB") {
    const pressures = Math.max(advanced.pressures, stats.sacks + stats.hurries);
    const runFit = clamp(52 + stats.tacklesForLoss * 7 + stats.runStops * 4 + stats.tackles * 1.7 - advanced.missedTackles * 10);
    const rush = clamp(50 + stats.sacks * 12 + stats.hurries * 3 + pressures * 2.5);
    const finish = clamp(54 + stats.tackles * 4 + stats.tacklesForLoss * 3 + stats.sacks * 2 - advanced.missedTackles * 14);
    const impact = clamp(48 + stats.sacks * 10 + stats.tacklesForLoss * 6 + stats.interceptions * 16 + stats.passBreakups * 5 + stats.runStops * 3);
    return [
      criterion("gap", "Своя зона", "assignment", blend(averageCriterion(average, "gap"), runFit, .74), 28, impactDetail([`${stats.tacklesForLoss} TFL`, `${stats.runStops} STOP`])),
      criterion("rush", "Pass rush", "technique", blend(averageCriterion(average, "rush"), rush, .8), 30, impactDetail([`${stats.sacks} SACK`, `${pressures} PRESS`])),
      criterion("finish", "Захват", "execution", blend(averageCriterion(average, "finish"), finish, .76), 22, impactDetail([`${stats.tackles} TKL`, `${advanced.missedTackles} MISS`])),
      criterion("impact", "Влияние", "impact", blend(averageCriterion(average, "impact"), impact, .84), 20, impactDetail([`${stats.tacklesForLoss} TFL`, `${stats.interceptions} INT`])),
    ];
  }

  if (position === "CB" || position === "S") {
    const coverageSnaps = Math.max(1, stats.coverageSnaps);
    const coverageWinRate = advanced.coverageWins / coverageSnaps;
    const positionScore = clamp(48 + coverageWinRate * 42 + assignmentRate * 12);
    const eyes = clamp(52 + stats.interceptions * 16 + stats.passBreakups * 7 + coverageWinRate * 24);
    const ball = clamp(50 + stats.interceptions * 20 + stats.passBreakups * 9 - advanced.missedTackles * 8);
    const limit = clamp(52 + stats.tackles * 3 + advanced.coverageWins * 2 - advanced.missedTackles * 14);
    return [
      criterion("leverage", "Позиция", "assignment", blend(averageCriterion(average, "leverage"), positionScore, .68), 32, `${advanced.coverageWins}/${coverageSnaps}`),
      criterion("eyes", "Чтение QB", "decision", blend(averageCriterion(average, "eyes"), eyes, .62), 22, `${stats.interceptions} INT`),
      criterion("ball", "Мяч", "execution", blend(averageCriterion(average, "ball"), ball, .76), 26, `${stats.passBreakups} PBU`),
      criterion("limit", "Захват", "impact", blend(averageCriterion(average, "limit"), limit, .68), 20, impactDetail([`${stats.tackles} TKL`, `${advanced.missedTackles} MISS`])),
    ];
  }

  if (position === "K") {
    const attempts = Math.max(1, stats.fieldGoalsAttempted);
    const rate = stats.fieldGoalsMade / attempts;
    const accuracy = clamp(30 + rate * 58 + Math.min(12, stats.longestFieldGoal / 5));
    const impact = clamp(45 + stats.fieldGoalsMade * 12 + stats.longestFieldGoal / 3);
    return [
      criterion("operation", "Операция", "assignment", averageCriterion(average, "operation"), 25, `${attempts} ATT`),
      criterion("accuracy", "Точность", "technique", blend(averageCriterion(average, "accuracy"), accuracy, .78), 35, `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted}`),
      criterion("power", "Дальность", "execution", blend(averageCriterion(average, "power"), clamp(50 + stats.longestFieldGoal), .7), 20, `${stats.longestFieldGoal} YD`),
      criterion("impact", "Очки", "impact", blend(averageCriterion(average, "impact"), impact, .75), 20, `${stats.fieldGoalsMade * 3} PTS`),
    ];
  }

  const punts = Math.max(1, stats.punts);
  const net = stats.puntYards / punts;
  const accuracy = clamp(45 + stats.puntsInside20 * 10 - stats.returnYardsAllowed / punts * 1.5);
  const power = clamp(35 + net);
  const impact = clamp(45 + net * .7 + stats.puntsInside20 * 8 - stats.returnYardsAllowed / punts);
  return [
    criterion("operation", "Операция", "assignment", averageCriterion(average, "operation"), 25, `${punts} PUNT`),
    criterion("accuracy", "Направление", "technique", blend(averageCriterion(average, "accuracy"), accuracy, .7), 30, `${stats.puntsInside20} I20`),
    criterion("power", "Дальность", "execution", blend(averageCriterion(average, "power"), power, .72), 20, `${net.toFixed(1)} NET`),
    criterion("impact", "Позиция поля", "impact", blend(averageCriterion(average, "impact"), impact, .76), 25, `${stats.returnYardsAllowed} RET`),
  ];
}

export function aggregateMatchEvaluation(
  position: FootballPosition,
  snaps: MatchSnapEvaluation[],
  stats?: MatchStatLine,
  advanced?: MatchAdvancedStatLine,
): MatchGameEvaluation {
  if (snaps.length === 0) {
    return { score: 0, grade: "D", snapCount: 0, roleLabel: position, criteria: [], bestSnapIds: [], worstSnapIds: [], summary: "0" };
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
  const averages = [...categories.entries()].map(([id, value]) => criterion(id, value.label, value.category, value.total / value.samples, value.weight, `${value.samples}`));
  const criteria = stats && advanced ? gameCriteria(position, averages, stats, advanced) : averages;
  const totalWeight = criteria.reduce((sum, item) => sum + item.weight, 0) || 1;
  const score = round(criteria.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight, 1);
  const ranked = snaps.map((snap, index) => ({ index, score: snap.score })).sort((left, right) => right.score - left.score);
  const grade = gradeFromPerformanceScore(score);
  return {
    score,
    grade,
    snapCount: snaps.length,
    roleLabel: position,
    criteria,
    bestSnapIds: ranked.slice(0, 3).map((entry) => String(entry.index)),
    worstSnapIds: ranked.slice(-3).reverse().map((entry) => String(entry.index)),
    summary: `${grade} · ${Math.round(score)}`,
  };
}
