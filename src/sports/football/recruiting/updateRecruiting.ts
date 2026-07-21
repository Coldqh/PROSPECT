import type { GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import type { FootballMatchState } from "../matches/types";
import type {
  FootballRecruitingState,
  ProjectedCollegeRole,
  RecruitingActionId,
  RecruitingActivity,
  RecruitingProgram,
  RecruitingStage,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function gameDateKey(date: GameDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function roleFor(program: RecruitingProgram): ProjectedCollegeRole {
  const score = program.interest * 0.45 + program.positionNeed * 0.42 + program.youthOpportunity * 0.18 - program.depthCompetition * 0.31;
  if (score >= 50) return "immediate-competition";
  if (score >= 34) return "rotation-path";
  if (score >= 18) return "developmental";
  return "long-shot";
}

function stageRank(stage: RecruitingStage): number {
  return { unaware: 0, watchlist: 1, evaluating: 2, contact: 3, priority: 4, offered: 5, cooled: -1 }[stage];
}

function maxStage(left: RecruitingStage, right: RecruitingStage): RecruitingStage {
  return stageRank(left) >= stageRank(right) ? left : right;
}

function stageFromEvaluation(program: RecruitingProgram): RecruitingStage {
  if (program.offer) return "offered";
  if (!program.academicEligible && program.interest < 70) return program.interest >= 35 ? "evaluating" : "watchlist";
  if (program.interest >= 76 && program.scoutingConfidence >= 62) return "priority";
  if (program.interest >= 60 && program.scoutingConfidence >= 46) return "contact";
  if (program.interest >= 43 && program.scoutingConfidence >= 28) return "evaluating";
  if (program.interest >= 26) return "watchlist";
  return program.stage === "unaware" ? "unaware" : "cooled";
}

function evaluationText(program: RecruitingProgram): string {
  if (program.offer) return `Штаб готов вложить полную стипендию. Проектируемая роль: ${roleLabel(program.offer.projectedRole)}.`;
  if (!program.academicEligible) return "Футбольная оценка положительная, но текущий академический профиль не проходит внутренний порог.";
  if (program.medicalConcern) return "Скауты видят талант, но медицинская служба требует стабильной готовности и чистой недели без боли.";
  if (program.stage === "priority") return "Герой входит в короткий список позиции. Следующий шаг зависит от контакта и проверки состава.";
  if (program.depthCompetition >= 82) return "Талант признают, но позиционная комната переполнена и ранняя роль не гарантируется.";
  if (program.positionNeed >= 78 && program.fit >= 70) return "Позиция нужна в этом наборе, а игровой профиль хорошо совпадает со схемой.";
  if (program.fit >= 75) return "Схема подходит, но штаб хочет больше плёнки против сильных соперников.";
  return "Оценка продолжается. Решение пока опирается на ограниченный объём плёнки.";
}

function roleLabel(role: ProjectedCollegeRole): string {
  return {
    "immediate-competition": "борьба за ротацию сразу",
    "rotation-path": "путь в ротацию",
    developmental: "развитие без обещаний",
    "long-shot": "дальний проект",
  }[role];
}

function completedGrades(save: CareerSave): number[] {
  return save.football.season.schedule
    .filter((game) => game.status === "complete" && game.heroGrade)
    .map((game) => ({ A: 94, B: 80, C: 66, D: 48 })[game.heroGrade ?? "C"]);
}

function mean(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function activity(
  save: CareerSave,
  kind: RecruitingActivity["kind"],
  title: string,
  detail: string,
  programId?: string,
): RecruitingActivity {
  return {
    id: `${save.meta.worldSeed}:recruiting:${save.life.completedDays}:${kind}:${programId ?? "global"}:${title}`,
    week: save.football.season.week,
    ...(programId ? { programId } : {}),
    date: save.meta.currentDate,
    kind,
    title,
    detail,
  };
}

function calculateMetrics(save: CareerSave, match?: FootballMatchState): Pick<FootballRecruitingState, "visibility" | "filmGrade" | "consistency" | "healthConfidence" | "academicClearance" | "coachRecommendation" | "competitionLevel" | "regionalRankLabel"> {
  const current = save.football.recruitment;
  const grades = completedGrades(save);
  const latestGrade = match?.finalResult ? ({ A: 94, B: 80, C: 66, D: 48 } as const)[match.finalResult.grade] : mean(grades, current.filmGrade);
  const filmGrade = clamp(current.filmGrade * 0.62 + latestGrade * 0.38 + save.football.ratings.technique * 0.08);
  const consistency = clamp(mean(grades, current.consistency) * 0.72 + save.character.personality.discipline * 0.18 + save.character.personality.composure * 0.1);
  const healthConfidence = clamp(
    save.character.condition.health * 0.43 +
      save.football.training.body.readiness * 0.34 -
      save.football.training.body.pain * 0.28 -
      (save.football.training.body.activeIssue ? 13 : 0) + 18,
  );
  const academicClearance = clamp(save.character.education.gpa * 25 * 0.72 + save.character.education.attendance * 0.28);
  const coachRecommendation = clamp(
    save.football.depthChart.coachTrust * 0.6 +
      save.football.staff.headCoach.relationship * 0.18 +
      save.character.personality.coachability * 0.22,
  );
  const completedRatings = save.football.season.schedule
    .filter((game) => game.status === "complete")
    .map((game) => game.opponentRating);
  const competitionLevel = clamp(mean(completedRatings, save.football.school.prestige) * 0.75 + save.football.school.prestige * 0.25);
  const visibilityGain = match?.finalResult
    ? Math.max(0, match.finalResult.visibilityDelta + (match.finalResult.grade === "A" ? 2.2 : match.finalResult.grade === "B" ? 0.8 : 0))
    : 0;
  const visibility = clamp(current.visibility + visibilityGain);
  const rankScore = visibility * 0.28 + filmGrade * 0.28 + competitionLevel * 0.13 + save.football.ratings.overall * 0.2 + consistency * 0.11;
  const regionalRankLabel = rankScore >= 82 ? "regional top prospect" : rankScore >= 72 ? "regional contender" : rankScore >= 61 ? "regional watchlist" : rankScore >= 51 ? "local prospect" : "unrated";
  return { visibility, filmGrade, consistency, healthConfidence, academicClearance, coachRecommendation, competitionLevel, regionalRankLabel };
}

function updateProgram(
  save: CareerSave,
  program: RecruitingProgram,
  metrics: ReturnType<typeof calculateMetrics>,
  match: FootballMatchState,
  random: SeededRandom,
): RecruitingProgram {
  const fitScore = program.fit * 0.17 + program.positionNeed * 0.18 + metrics.filmGrade * 0.23 + metrics.visibility * 0.14 + metrics.coachRecommendation * 0.1 + metrics.competitionLevel * 0.08 + metrics.consistency * 0.1;
  const prestigePenalty = Math.max(0, program.prestige - save.football.ratings.overall) * 0.24;
  const depthPenalty = Math.max(0, program.depthCompetition - program.positionNeed) * 0.08;
  const academicPenalty = metrics.academicClearance < program.academicStandard ? 7 : 0;
  const medicalPenalty = metrics.healthConfidence < 60 ? 6 : 0;
  const latestPerformance = match.finalResult ? ({ A: 7, B: 3, C: -1, D: -6 } as const)[match.finalResult.grade] : 0;
  const desiredInterest = clamp(fitScore - prestigePenalty - depthPenalty - academicPenalty - medicalPenalty + latestPerformance + random.integer(-3, 3));
  const observed = program.stage === "unaware" ? metrics.visibility >= 37 || desiredInterest >= 34 : true;
  const nextInterest = observed ? clamp(program.interest * 0.68 + desiredInterest * 0.32) : program.interest;
  const confidenceGain = observed ? 4 + metrics.visibility * 0.035 + (match.finalResult?.grade === "A" ? 3 : 0) : 0;
  const scoutingConfidence = clamp(program.scoutingConfidence + confidenceGain);
  const academicEligible = metrics.academicClearance >= program.academicStandard - 6;
  const medicalConcern = metrics.healthConfidence < 63;
  let next: RecruitingProgram = {
    ...program,
    interest: nextInterest,
    scoutingConfidence,
    academicEligible,
    medicalConcern,
    projectedRole: roleFor({ ...program, interest: nextInterest }),
    lastUpdate: `После недели ${match.scheduledWeek}: ${match.finalResult?.grade ?? "—"} на плёнке, ${Math.round(metrics.filmGrade)} film grade.`,
  };
  next = { ...next, stage: maxStage(program.stage, stageFromEvaluation(next)) };
  if (!next.offer && observed && match.finalResult?.grade === "D" && next.interest < 34 && program.stage !== "unaware") {
    next = { ...next, stage: "cooled", lastUpdate: "После слабой плёнки программа переключила внимание на других игроков." };
  }

  const offerEligible =
    !next.offer &&
    next.stage === "priority" &&
    next.interest >= 84 &&
    next.scoutingConfidence >= 68 &&
    next.academicEligible &&
    !next.medicalConcern &&
    next.positionNeed >= 55;
  if (offerEligible && random.chance(next.tier === "national" ? 0.18 : next.tier === "power" ? 0.32 : 0.55)) {
    const offer = {
      id: `${next.id}:offer:${match.scheduledWeek}`,
      issuedWeek: match.scheduledWeek,
      scholarship: "full" as const,
      projectedRole: next.projectedRole,
      expiresAfterWeek: Math.max(match.scheduledWeek + 3, 8),
    };
    next = { ...next, stage: "offered", offer };
  }
  return { ...next, evaluation: evaluationText(next) };
}

export function updateRecruitingAfterMatch(save: CareerSave, match: FootballMatchState): FootballRecruitingState {
  if (!match.finalResult) return save.football.recruitment;
  const metrics = calculateMetrics(save, match);
  const activities: RecruitingActivity[] = [];
  const programs = save.football.recruitment.programs.map((program) => {
    const before = program.stage;
    const next = updateProgram(save, program, metrics, match, new SeededRandom(`${program.seed}:week:${match.scheduledWeek}`));
    if (next.stage !== before) {
      const kind: RecruitingActivity["kind"] = next.stage === "offered" ? "offer" : next.stage === "cooled" ? "cooling" : next.stage === "contact" || next.stage === "priority" ? "contact" : "evaluation";
      activities.push(activity(
        save,
        kind,
        next.stage === "offered" ? `${next.shortName} предложил стипендию` : `${next.shortName}: ${stageTitle(next.stage)}`,
        next.evaluation,
        next.id,
      ));
    }
    return next;
  });
  const interestedPrograms = programs.filter((program) => !["unaware", "cooled"].includes(program.stage)).length;
  const offers = programs.filter((program) => Boolean(program.offer)).length;
  return {
    ...save.football.recruitment,
    ...metrics,
    programs,
    interestedPrograms,
    offers,
    activity: [...activities, ...save.football.recruitment.activity].slice(0, 40),
  };
}

function stageTitle(stage: RecruitingStage): string {
  return {
    unaware: "не знает игрока",
    watchlist: "добавил в watchlist",
    evaluating: "изучает плёнку",
    contact: "вышел на контакт",
    priority: "сделал приоритетом",
    offered: "предложил стипендию",
    cooled: "остыл",
  }[stage];
}

export function performRecruitingAction(save: CareerSave, programId: string, actionId: RecruitingActionId): CareerSave {
  const state = save.football.recruitment;
  const currentWeek = save.football.season.week;
  const used = state.actionWeek === currentWeek ? state.actionsUsed : 0;
  if (used >= 2) throw new Error("No recruiting actions remaining this week");
  const target = state.programs.find((program) => program.id === programId);
  if (!target) throw new Error("Unknown recruiting program");
  if (target.stage === "unaware" && actionId !== "send-film") throw new Error("Program has no active evaluation");

  let program = { ...target };
  let title = "";
  let detail = "";
  let coachRecommendation = state.coachRecommendation;
  const random = new SeededRandom(`${target.seed}:action:${currentWeek}:${actionId}:${used}`);
  switch (actionId) {
    case "send-film": {
      const quality = state.filmGrade * 0.55 + state.consistency * 0.2 + state.competitionLevel * 0.15 + random.integer(-3, 4);
      program.interest = clamp(program.interest + Math.max(2, (quality - 55) * 0.12));
      program.scoutingConfidence = clamp(program.scoutingConfidence + 9);
      program.stage = maxStage(program.stage, "evaluating");
      title = `Плёнка отправлена в ${program.shortName}`;
      detail = `Штаб получил нарезку. Текущая оценка материала: ${Math.round(state.filmGrade)}.`;
      break;
    }
    case "coach-call": {
      coachRecommendation = clamp(coachRecommendation + 2.5);
      program.interest = clamp(program.interest + 4 + state.coachRecommendation * 0.025);
      program.scoutingConfidence = clamp(program.scoutingConfidence + 5);
      program.stage = maxStage(program.stage, "contact");
      title = `${save.football.staff.headCoach.name} позвонил в ${program.shortName}`;
      detail = "Школьный тренер подтвердил роль, дисциплину и прогресс игрока.";
      break;
    }
    case "send-transcript": {
      program.academicEligible = state.academicClearance >= program.academicStandard - 6;
      program.scoutingConfidence = clamp(program.scoutingConfidence + 4);
      program.interest = clamp(program.interest + (program.academicEligible ? 3 : -2));
      title = `Транскрипт отправлен в ${program.shortName}`;
      detail = program.academicEligible ? "Академическая служба предварительно допустила игрока." : "Текущий GPA пока ниже внутреннего порога программы.";
      break;
    }
    case "declare-interest": {
      program.interest = clamp(program.interest + (program.stage === "contact" || program.stage === "priority" ? 5 : 2));
      program.stage = maxStage(program.stage, "contact");
      title = `${program.shortName} получил сигнал о серьёзном интересе`;
      detail = "Рекрутер понимает, что программа рассматривается всерьёз, но это не создаёт обещаний игрового времени.";
      break;
    }
  }

  program.projectedRole = roleFor(program);
  program.stage = maxStage(program.stage, stageFromEvaluation(program));
  program.lastUpdate = detail;
  program.evaluation = evaluationText(program);
  const programs = state.programs.map((candidate) => candidate.id === programId ? program : candidate);
  const interestedPrograms = programs.filter((candidate) => !["unaware", "cooled"].includes(candidate.stage)).length;
  const offers = programs.filter((candidate) => Boolean(candidate.offer)).length;
  const actionRecord = activity(save, "action", title, detail, program.id);

  return {
    ...save,
    football: {
      ...save.football,
      recruitment: {
        ...state,
        coachRecommendation,
        programs,
        interestedPrograms,
        offers,
        actionWeek: currentWeek,
        actionsUsed: used + 1,
        activity: [actionRecord, ...state.activity].slice(0, 40),
      },
    },
    history: [
      ...save.history,
      {
        id: actionRecord.id,
        occurredAt: save.meta.updatedAt,
        type: "recruiting-action",
        title,
        description: detail,
      },
    ],
  };
}

export function recruitingActionsRemaining(state: FootballRecruitingState, currentWeek: number): number {
  const used = state.actionWeek === currentWeek ? state.actionsUsed : 0;
  return Math.max(0, 2 - used);
}

export function recruitingStageLabel(stage: RecruitingStage): string {
  return stageTitle(stage);
}

export function recruitingRoleLabel(role: ProjectedCollegeRole): string {
  return roleLabel(role);
}

export function recruitingDateLabel(date: GameDate): string {
  return gameDateKey(date);
}
