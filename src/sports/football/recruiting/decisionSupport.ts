import type { CareerSave } from "../../../storage/saves/schema";
import type { ProjectedCollegeRole, RecruitingProgram } from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function roleValue(role: ProjectedCollegeRole): number {
  return {
    "immediate-competition": 94,
    "rotation-path": 76,
    developmental: 55,
    "long-shot": 28,
  }[role];
}

function familyDistanceScore(program: RecruitingProgram): number {
  if (program.officialVisit?.familyComfort !== undefined) return program.officialVisit.familyComfort;
  return clamp(100 - program.distanceMiles / 18);
}

function promiseReliability(program: RecruitingProgram): number {
  if (program.promises.length === 0) return 42;
  return program.promises.reduce((sum, promise) => sum + promise.credibility, 0) / program.promises.length;
}

export interface RecruitingDecisionSnapshot {
  programId: string;
  role: number;
  development: number;
  academics: number;
  health: number;
  family: number;
  staffTrust: number;
  promiseReliability: number;
  overall: number;
  risk: string;
}

export function recruitingDecisionSnapshot(program: RecruitingProgram): RecruitingDecisionSnapshot {
  const role = roleValue(program.projectedRole);
  const development = clamp(program.facilities * 0.25 + program.youthOpportunity * 0.34 + program.fit * 0.24 + program.staffTrust * 0.17);
  const academics = clamp(100 - Math.max(0, program.academicStandard - 62) * 0.65 + program.prestige * 0.15);
  const health = clamp(program.medicine * 0.78 + (program.medicalConcern ? -16 : 12));
  const family = familyDistanceScore(program);
  const reliability = promiseReliability(program);
  const visitBoost = program.officialVisit?.overallImpression ?? 48;
  const overall = clamp(
    role * 0.22 +
      development * 0.2 +
      academics * 0.12 +
      health * 0.14 +
      family * 0.11 +
      program.staffTrust * 0.1 +
      reliability * 0.06 +
      visitBoost * 0.05,
  );
  const risk =
    program.depthCompetition >= 82
      ? "Позиционная комната перегружена. Обещанная роль может исчезнуть после лагеря."
      : program.medicalConcern
        ? "Медицинская служба пока не закрыла вопросы по здоровью."
        : reliability < 48
          ? "Часть обещаний звучит сильнее, чем подтверждают состав и ситуация штаба."
          : program.academicEligible === false
            ? "Без роста GPA предложение может не пережить академическую проверку."
            : program.distanceMiles > 1300
              ? "Большое расстояние усложнит поддержку семьи и адаптацию."
              : "Явного красного флага нет, но роль всё равно придётся подтверждать в лагере.";
  return {
    programId: program.id,
    role,
    development,
    academics,
    health,
    family,
    staffTrust: program.staffTrust,
    promiseReliability: reliability,
    overall,
    risk,
  };
}

export interface RecruitingAdviserOpinion {
  npcId: string;
  name: string;
  programId?: string | undefined;
  title: string;
  detail: string;
}

export function getRecruitingAdvice(save: CareerSave): { guardian: RecruitingAdviserOpinion; coach: RecruitingAdviserOpinion } {
  const offered = save.football.recruitment.programs.filter((program) => Boolean(program.offer));
  const guardianNpc = save.relationships.npcs.find((npc) => npc.role === "guardian");
  const coachNpc = save.relationships.npcs.find((npc) => npc.role === "head-coach");

  const guardianChoice = [...offered].sort((left, right) => {
    const leftScore = familyDistanceScore(left) * 0.32 + left.medicine * 0.2 + (left.academicEligible ? 16 : -18) + left.prestige * 0.12 + roleValue(left.projectedRole) * 0.12;
    const rightScore = familyDistanceScore(right) * 0.32 + right.medicine * 0.2 + (right.academicEligible ? 16 : -18) + right.prestige * 0.12 + roleValue(right.projectedRole) * 0.12;
    return rightScore - leftScore;
  })[0];

  const coachChoice = [...offered].sort((left, right) => {
    const leftScore = left.fit * 0.27 + left.positionNeed * 0.22 + left.youthOpportunity * 0.18 + left.prestige * 0.14 + left.staffTrust * 0.13 - left.depthCompetition * 0.12;
    const rightScore = right.fit * 0.27 + right.positionNeed * 0.22 + right.youthOpportunity * 0.18 + right.prestige * 0.14 + right.staffTrust * 0.13 - right.depthCompetition * 0.12;
    return rightScore - leftScore;
  })[0];

  return {
    guardian: {
      npcId: guardianNpc?.id ?? "guardian",
      name: guardianNpc?.name ?? "Семья",
      ...(guardianChoice ? { programId: guardianChoice.id } : {}),
      title: guardianChoice ? `${guardianChoice.shortName} выглядит безопаснее` : "Сначала нужны реальные предложения",
      detail: guardianChoice
        ? `${guardianChoice.distanceMiles} миль от дома, медицина ${Math.round(guardianChoice.medicine)}, академический допуск ${guardianChoice.academicEligible ? "есть" : "не закрыт"}.`
        : "Семья не хочет строить решение на интересе без письменной стипендии.",
    },
    coach: {
      npcId: coachNpc?.id ?? "head-coach",
      name: coachNpc?.name ?? save.football.staff.headCoach.name,
      ...(coachChoice ? { programId: coachChoice.id } : {}),
      title: coachChoice ? `${coachChoice.shortName} лучше использует твой профиль` : "Штаб ждёт офферы после плёнки",
      detail: coachChoice
        ? `Схема ${coachChoice.scheme}, потребность ${Math.round(coachChoice.positionNeed)}, конкуренция ${Math.round(coachChoice.depthCompetition)}.`
        : "Тренер пока не видит программы, где интерес, схема и свободное место совпали одновременно.",
    },
  };
}

export function credibilityLabel(value: number): string {
  if (value >= 76) return "Высокая";
  if (value >= 58) return "Умеренная";
  if (value >= 42) return "Неясная";
  return "Низкая";
}
