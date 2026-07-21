import type { CharacterState } from "../../../core/character/types";
import type { GameDate } from "../../../core/calendar/types";
import type { LifeDayEffects, TrainingIntensity } from "../../../core/life/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballCareerState, FootballRatings } from "../career/types";
import { getTrainingFocus } from "./catalog";
import type { ActiveHealthIssue, BodyStatus, FootballTrainingState, MedicalStatus, TrainingSessionResult } from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function dateKey(date: GameDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function intensityMultiplier(intensity: TrainingIntensity): number {
  return { controlled: 0.72, standard: 1, aggressive: 1.28 }[intensity];
}

function plateauFactor(rating: number): number {
  if (rating >= 88) return 0.38;
  if (rating >= 82) return 0.55;
  if (rating >= 76) return 0.74;
  return 1;
}

function gradeFor(score: number): TrainingSessionResult["grade"] {
  if (score >= 80) return "A";
  if (score >= 68) return "B";
  if (score >= 54) return "C";
  return "D";
}

function issuePool(position: FootballCareerState["position"]): readonly Omit<ActiveHealthIssue, "id" | "daysRemaining" | "recurrenceRisk" | "startedOn">[] {
  const common = [
    { diagnosis: "Перегрузка задней поверхности бедра", area: "lower-body", severity: "minor" },
    { diagnosis: "Растяжение голеностопа", area: "lower-body", severity: "minor" },
    { diagnosis: "Спазм поясницы", area: "back-core", severity: "minor" },
  ] as const;
  const positional = {
    QB: [{ diagnosis: "Раздражение броскового плеча", area: "upper-body", severity: "moderate" }],
    RB: [{ diagnosis: "Ушиб колена после контакта", area: "lower-body", severity: "moderate" }],
    WR: [{ diagnosis: "Растяжение задней поверхности бедра", area: "lower-body", severity: "moderate" }],
    LB: [{ diagnosis: "Растяжение плечевого пояса", area: "upper-body", severity: "moderate" }],
    CB: [{ diagnosis: "Растяжение паховой мышцы", area: "lower-body", severity: "moderate" }],
  }[position] as readonly Omit<ActiveHealthIssue, "id" | "daysRemaining" | "recurrenceRisk" | "startedOn">[];
  return [...common, ...positional];
}

function medicalStatusFor(body: Pick<BodyStatus, "readiness" | "pain" | "injuryRisk" | "activeIssue">): { status: MedicalStatus; restriction: string } {
  if (body.activeIssue?.severity === "moderate" && body.activeIssue.daysRemaining > 0) {
    return { status: "out", restriction: `Без контактной работы. ${body.activeIssue.daysRemaining} дн. до повторной оценки.` };
  }
  if (body.activeIssue || body.pain >= 62) {
    return { status: "limited", restriction: "Ограничить контакт и взрывную нагрузку." };
  }
  if (body.readiness < 46 || body.injuryRisk >= 58) {
    return { status: "questionable", restriction: "Допуск после проверки перед тренировкой." };
  }
  return { status: "cleared", restriction: "Полный тренировочный допуск." };
}

export interface TrainingDayResolution {
  training: FootballTrainingState;
  ratings: FootballRatings;
  character: CharacterState;
  coachTrustDelta: number;
  session: TrainingSessionResult;
  injuryOccurred: boolean;
}

export function resolveTrainingDay(
  football: FootballCareerState,
  character: CharacterState,
  effects: LifeDayEffects,
  date: GameDate,
  worldSeed: string,
  practiceFactor: number,
): TrainingDayResolution {
  const training = football.training;
  const focus = getTrainingFocus(football.position, training.plan.focusId);
  const random = new SeededRandom(worldSeed).fork(`training-day:${dateKey(date)}:${training.plan.revision}`);
  const intensity = intensityMultiplier(training.plan.intensity);
  const recoveryFocus = focus.multipliers.recovery;
  const existingIssue = training.body.activeIssue;
  const healingIssue = existingIssue
    ? { ...existingIssue, daysRemaining: Math.max(0, existingIssue.daysRemaining - 1) }
    : undefined;
  const activeIssue = healingIssue?.daysRemaining === 0 ? undefined : healingIssue;

  const readinessBefore = training.body.readiness;
  const availabilityFactor = training.body.medicalStatus === "out" ? 0.12 : training.body.medicalStatus === "limited" ? 0.58 : 1;
  const quality = clamp(
    effects.trainingQuality * 0.68 +
      readinessBefore * 0.27 +
      character.personality.discipline * 0.08 +
      random.integer(-5, 5) -
      training.body.pain * 0.18,
  );
  const sessionLoad = clamp(
    focus.load * intensity * practiceFactor * availabilityFactor + effects.load * 0.22 - recoveryFocus * 18,
    4,
    100,
  );

  const recoveryCapacity = clamp(
    effects.recoveryQuality * 0.48 +
      character.physical.stamina * 0.22 +
      character.condition.sleepHours * 4.2 +
      football.school.medicine * 0.08,
  );
  const sorenessDelta = round(sessionLoad * 0.15 - recoveryCapacity * 0.09 - recoveryFocus * 11 + random.integer(-2, 2), 1);
  const painDelta = round(
    Math.max(0, sessionLoad - 58) * 0.06 + Math.max(0, training.body.soreness - 60) * 0.035 - recoveryFocus * 5.5,
    1,
  );
  const acuteLoad = clamp(training.body.acuteLoad * 0.58 + sessionLoad * 0.62);
  const chronicLoad = clamp(training.body.chronicLoad * 0.88 + sessionLoad * 0.12);
  const soreness = clamp(training.body.soreness + sorenessDelta);
  const pain = clamp(training.body.pain + painDelta);
  const loadSpike = Math.max(0, acuteLoad - chronicLoad * 1.28);
  let injuryRisk = clamp(
    7 +
      loadSpike * 0.72 +
      soreness * 0.23 +
      pain * 0.31 +
      character.condition.fatigue * 0.17 -
      football.school.medicine * 0.1 -
      recoveryFocus * 12,
  );

  const injuryProbability = Math.min(0.09, Math.max(0, (injuryRisk - 42) / 850 + (training.plan.intensity === "aggressive" ? 0.012 : 0)));
  let nextIssue = activeIssue;
  let issueOccurred: string | undefined;
  if (!nextIssue && random.chance(injuryProbability)) {
    const selected = random.pick(issuePool(football.position));
    nextIssue = {
      ...selected,
      id: `issue-${dateKey(date)}-${random.integer(100, 999)}`,
      daysRemaining: selected.severity === "moderate" ? random.integer(7, 16) : random.integer(2, 6),
      recurrenceRisk: selected.severity === "moderate" ? random.integer(28, 48) : random.integer(12, 28),
      startedOn: dateKey(date),
    };
    issueOccurred = nextIssue.diagnosis;
    injuryRisk = clamp(injuryRisk + 18);
  }

  const readinessAfter = clamp(
    100 -
      character.condition.fatigue * 0.3 -
      soreness * 0.29 -
      pain * 0.27 +
      character.condition.energy * 0.18 +
      character.condition.health * 0.16 -
      (nextIssue ? 18 : 0),
  );
  const medical = medicalStatusFor({ readiness: readinessAfter, pain, injuryRisk, ...(nextIssue ? { activeIssue: nextIssue } : {}) });

  const gainBase = quality / 620 * practiceFactor * availabilityFactor;
  const gains = {
    technique: round(gainBase * focus.multipliers.technique * plateauFactor(football.ratings.technique), 2),
    athleticism: round(gainBase * focus.multipliers.athleticism * plateauFactor(football.ratings.athleticism), 2),
    footballIq: round(gainBase * focus.multipliers.footballIq * plateauFactor(football.ratings.footballIq), 2),
    competitiveness: round(gainBase * focus.multipliers.competitiveness * plateauFactor(football.ratings.competitiveness), 2),
  };

  const nextRatings: FootballRatings = {
    ...football.ratings,
    technique: clamp(football.ratings.technique + gains.technique),
    athleticism: clamp(football.ratings.athleticism + gains.athleticism),
    footballIq: clamp(football.ratings.footballIq + gains.footballIq),
    competitiveness: clamp(football.ratings.competitiveness + gains.competitiveness),
  };

  const body: BodyStatus = {
    readiness: readinessAfter,
    acuteLoad,
    chronicLoad,
    soreness,
    pain,
    injuryRisk,
    medicalStatus: medical.status,
    restriction: medical.restriction,
    ...(nextIssue ? { activeIssue: nextIssue } : {}),
  };
  const score = quality * 0.55 + readinessAfter * 0.25 + (100 - injuryRisk) * 0.2;
  const grade = gradeFor(score);
  const session: TrainingSessionResult = {
    id: `training-${dateKey(date)}`,
    date,
    focusId: focus.id,
    focusName: focus.name,
    intensity: training.plan.intensity,
    grade,
    load: sessionLoad,
    readinessBefore,
    readinessAfter,
    sorenessDelta,
    riskAfter: injuryRisk,
    gains,
    note: issueOccurred
      ? `Сессия остановлена: ${issueOccurred}. Медицинский штаб изменил допуск.`
      : grade === "A"
        ? "Техника и темп удержаны до конца сессии. Штаб отметил качество работы."
        : grade === "D"
          ? "Нагрузка превысила качество. Следующая сессия требует коррекции."
          : "Рабочая сессия без резкого прорыва. Изменения накопятся со временем.",
    ...(issueOccurred ? { issueOccurred } : {}),
  };

  const healthPenalty = nextIssue ? (nextIssue.severity === "moderate" ? 8 : 4) : Math.max(0, pain - 55) * 0.025;
  const nextCharacter: CharacterState = {
    ...character,
    condition: {
      ...character.condition,
      health: clamp(character.condition.health - healthPenalty),
    },
  };

  return {
    training: {
      ...training,
      body,
      momentum: {
        technique: clamp(training.momentum.technique * 0.72 + gains.technique * 24),
        athleticism: clamp(training.momentum.athleticism * 0.72 + gains.athleticism * 24),
        footballIq: clamp(training.momentum.footballIq * 0.72 + gains.footballIq * 24),
        competitiveness: clamp(training.momentum.competitiveness * 0.72 + gains.competitiveness * 24),
      },
      lastSession: session,
    },
    ratings: nextRatings,
    character: nextCharacter,
    coachTrustDelta: round((quality - 58) * 0.025 + (focus.id === "position-craft" ? 0.35 : 0) - (issueOccurred ? 0.5 : 0), 1),
    session,
    injuryOccurred: Boolean(issueOccurred),
  };
}
