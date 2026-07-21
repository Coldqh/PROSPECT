import type { CharacterState } from "../character/types";
import type { GameDate } from "../calendar/types";
import { SeededRandom } from "../random/SeededRandom";
import { getIntensityDescriptor } from "./planCatalog";
import type { DayGrade, DayOutcome, LifeDayEffects, LifeState } from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

const dayLoadFactor = [0.86, 1, 1.14, 1.08, 0.72, 0.92, 0.18] as const;
const dayStudyFactor = [0.78, 0.88, 1.15, 0.92, 0.74, 0.28, 0.22] as const;

function gradeForScore(score: number): DayGrade {
  if (score >= 78) return "A";
  if (score >= 63) return "B";
  if (score >= 48) return "C";
  return "D";
}

function makeTitle(grade: DayGrade, trainingQuality: number, recoveryQuality: number): string {
  if (grade === "A" && trainingQuality >= 72) return "Сильный рабочий день";
  if (grade === "A") return "Режим выдержан";
  if (grade === "B" && recoveryQuality >= 68) return "Состояние стабилизировано";
  if (grade === "B") return "День закрыт чисто";
  if (grade === "C") return "Нагрузка прошла тяжело";
  return "Режим дал сбой";
}

export interface AdvanceLifeDayResult {
  character: CharacterState;
  life: LifeState;
  nextDate: GameDate;
  effects: LifeDayEffects;
  outcome: DayOutcome;
}

function addOneDay(date: GameDate): GameDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

export function advanceLifeDay(
  character: CharacterState,
  life: LifeState,
  date: GameDate,
  worldSeed: string,
): AdvanceLifeDayResult {
  const random = new SeededRandom(`${worldSeed}:life:${date.year}-${date.month}-${date.day}`);
  const intensity = getIntensityDescriptor(life.weeklyPlan.intensity);
  const focus = life.weeklyPlan.focus;
  const dayIndex = life.dayIndex;
  const loadFactor = dayLoadFactor[dayIndex] ?? 1;
  const studyFactor = dayStudyFactor[dayIndex] ?? 1;
  const weekday = dayIndex < 5;

  const trainingQuality = clamp(
    34 + focus.training * 0.48 + character.personality.discipline * 0.13 + character.condition.energy * 0.12 - character.condition.fatigue * 0.18 + random.integer(-7, 7),
  );
  const recoveryQuality = clamp(
    28 + focus.recovery * 0.62 + character.personality.discipline * 0.08 - character.condition.stress * 0.12 + random.integer(-6, 6),
  );
  const studyQuality = clamp(
    28 + focus.study * 0.55 + character.education.academicAbility * 0.15 + character.personality.discipline * 0.08 - character.condition.fatigue * 0.1 + random.integer(-6, 6),
  );
  const socialQuality = clamp(32 + focus.social * 0.72 + character.personality.confidence * 0.08 + random.integer(-7, 7));
  const load = clamp((focus.training * 0.58 + 25) * intensity.loadMultiplier * loadFactor, 5, 100);

  const sleepHours = clamp(
    6.2 + focus.recovery * 0.026 + character.personality.discipline * 0.006 - Math.max(0, intensity.loadMultiplier - 1) * 0.8 + random.integer(-4, 5) / 10,
    5.2,
    9.6,
  );
  const sleepEffect = (sleepHours - 7) * 3.2;
  const energyDelta = round(sleepEffect + recoveryQuality * 0.035 - load * 0.08 - (weekday ? 1.5 : 0) + random.integer(-2, 2));
  const fatigueDelta = round(load * 0.09 - recoveryQuality * 0.052 - sleepEffect * 0.45 + random.integer(-1, 2));
  const stressDelta = round(
    load * 0.025 + (weekday ? 2.1 : -1.4) - recoveryQuality * 0.024 - socialQuality * 0.015 + (focus.study < 18 && weekday ? 1.8 : 0) + random.integer(-2, 2),
  );
  const confidenceDelta = round((trainingQuality - 55) * 0.035 + (studyQuality - 55) * 0.012 - Math.max(0, character.condition.stress - 70) * 0.025);
  const healthDelta = round(
    recoveryQuality * 0.018 - load * 0.025 - Math.max(0, character.condition.fatigue - 65) * 0.03,
  );
  const attendanceDelta = weekday ? round((studyQuality - 52) * 0.015, 2) : 0;
  const gpaDelta = weekday ? round((studyQuality - 55) * 0.0008 * studyFactor, 3) : 0;

  const nextCharacter: CharacterState = {
    ...character,
    education: {
      ...character.education,
      gpa: Math.max(0, Math.min(4, round(character.education.gpa + gpaDelta, 3))),
      attendance: clamp(character.education.attendance + attendanceDelta),
      eligibilityStatus:
        character.education.gpa + gpaDelta < 2.05 || character.education.attendance + attendanceDelta < 72
          ? "at-risk"
          : character.education.gpa + gpaDelta < 2.45 || character.education.attendance + attendanceDelta < 82
            ? "watch"
            : "clear",
    },
    condition: {
      ...character.condition,
      energy: clamp(character.condition.energy + energyDelta),
      fatigue: clamp(character.condition.fatigue + fatigueDelta),
      stress: clamp(character.condition.stress + stressDelta),
      confidence: clamp(character.condition.confidence + confidenceDelta),
      health: clamp(character.condition.health + healthDelta),
      sleepHours,
    },
  };

  const dayScore = trainingQuality * 0.35 + recoveryQuality * 0.25 + studyQuality * 0.24 + socialQuality * 0.08 + nextCharacter.condition.energy * 0.08;
  const grade = gradeForScore(dayScore);
  const highlights: string[] = [];
  if (trainingQuality >= 72) highlights.push("Тренировочная работа прошла выше ожиданий.");
  if (recoveryQuality >= 72) highlights.push("Восстановление удержало нагрузку под контролем.");
  if (studyQuality >= 72) highlights.push("Учебные обязательства закрыты уверенно.");
  if (nextCharacter.condition.fatigue >= 68) highlights.push("Усталость стала заметным ограничением.");
  if (nextCharacter.condition.stress >= 68) highlights.push("Стресс начинает влиять на режим.");
  if (highlights.length === 0) highlights.push("День прошёл без резких изменений.");

  const nextDayIndex = (dayIndex + 1) % 7;
  const nextDate = addOneDay(date);
  const nextLifeBase: LifeState = {
    ...life,
    dayIndex: nextDayIndex,
    weekNumber: nextDayIndex === 0 ? life.weekNumber + 1 : life.weekNumber,
    completedDays: life.completedDays + 1,
    consistency: clamp(life.consistency + (grade === "A" ? 2.4 : grade === "B" ? 1.1 : grade === "C" ? -0.6 : -2.2)),
  };

  const outcome: DayOutcome = {
    id: `day-${date.year}-${date.month}-${date.day}`,
    date,
    grade,
    title: makeTitle(grade, trainingQuality, recoveryQuality),
    summary: `Нагрузка ${Math.round(load)}. Качество работы ${Math.round(trainingQuality)}, восстановление ${Math.round(recoveryQuality)}, учёба ${Math.round(studyQuality)}.`,
    highlights,
    deltas: {
      energy: energyDelta,
      fatigue: fatigueDelta,
      stress: stressDelta,
      confidence: confidenceDelta,
      health: healthDelta,
      gpa: gpaDelta,
      coachTrust: 0,
      overall: 0,
    },
  };

  return {
    character: nextCharacter,
    life: { ...nextLifeBase, lastOutcome: outcome },
    nextDate,
    effects: { trainingQuality, recoveryQuality, studyQuality, socialQuality, load },
    outcome,
  };
}
