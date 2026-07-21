import { advanceLifeDay } from "../../../core/life/advanceLifeDay";
import { getWeeklyPlanTemplate } from "../../../core/life/planCatalog";
import type { TrainingIntensity, WeeklyPlanTemplateId } from "../../../core/life/types";
import type { CareerSave } from "../../../storage/saves/schema";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function calculateOverall(ratings: CareerSave["football"]["ratings"]): number {
  return clamp(
    ratings.athleticism * 0.34 +
      ratings.technique * 0.31 +
      ratings.footballIq * 0.2 +
      ratings.competitiveness * 0.15,
    45,
    99,
  );
}

export function updateWeeklyPlan(
  save: CareerSave,
  templateId: WeeklyPlanTemplateId,
  intensity: TrainingIntensity,
): CareerSave {
  const template = getWeeklyPlanTemplate(templateId);
  return {
    ...save,
    life: {
      ...save.life,
      weeklyPlan: {
        templateId,
        intensity,
        focus: { ...template.focus },
        revision: save.life.weeklyPlan.revision + 1,
      },
    },
    history: [
      ...save.history,
      {
        id: `plan-${save.meta.id}-${save.life.weeklyPlan.revision + 1}`,
        occurredAt: save.meta.updatedAt,
        type: "weekly-plan-updated",
        title: `План недели: ${template.name}`,
        description: `${template.description} Интенсивность: ${intensity}.`,
      },
    ],
  };
}

export function advanceFootballCareerDay(save: CareerSave): CareerSave {
  const result = advanceLifeDay(save.character, save.life, save.meta.currentDate, save.meta.worldSeed);
  const weekday = save.life.dayIndex;
  const practiceFactor = [0.9, 1, 1.15, 1.05, 0.72, 0.95, 0.2][weekday] ?? 1;
  const plan = save.life.weeklyPlan;
  const filmBonus = plan.templateId === "film-room" ? 1.25 : 1;
  const trainingBonus = plan.templateId === "breakout" ? 1.16 : 1;
  const recoveryPenalty = result.character.condition.fatigue >= 72 ? 0.58 : result.character.condition.fatigue >= 58 ? 0.82 : 1;

  const techniqueGain = round((result.effects.trainingQuality / 560) * practiceFactor * trainingBonus * recoveryPenalty, 2);
  const athleticismGain = round((result.effects.trainingQuality / 760) * practiceFactor * trainingBonus * recoveryPenalty, 2);
  const footballIqGain = round(((result.effects.studyQuality + result.effects.trainingQuality * 0.35) / 850) * filmBonus, 2);
  const competitivenessGain = round((result.effects.trainingQuality / 1200) * (plan.intensity === "aggressive" ? 1.2 : 1), 2);

  const nextRatings = {
    ...save.football.ratings,
    technique: clamp(save.football.ratings.technique + techniqueGain),
    athleticism: clamp(save.football.ratings.athleticism + athleticismGain),
    footballIq: clamp(save.football.ratings.footballIq + footballIqGain),
    competitiveness: clamp(save.football.ratings.competitiveness + competitivenessGain),
  };
  const previousOverall = save.football.ratings.overall;
  nextRatings.overall = calculateOverall(nextRatings);
  const overallDelta = round(nextRatings.overall - previousOverall, 2);

  const coachTrustDelta = round(
    (result.effects.trainingQuality - 55) * 0.03 +
      (result.character.education.attendance - 85) * 0.008 -
      Math.max(0, result.character.condition.fatigue - 78) * 0.025,
    1,
  );
  const nextCoachTrust = clamp(save.football.depthChart.coachTrust + coachTrustDelta);

  const nextOutcome = {
    ...result.outcome,
    deltas: {
      ...result.outcome.deltas,
      coachTrust: coachTrustDelta,
      overall: overallDelta,
    },
  };

  return {
    ...save,
    meta: {
      ...save.meta,
      currentDate: result.nextDate,
    },
    character: result.character,
    life: {
      ...result.life,
      lastOutcome: nextOutcome,
    },
    football: {
      ...save.football,
      ratings: nextRatings,
      depthChart: {
        ...save.football.depthChart,
        coachTrust: nextCoachTrust,
        projectedRole:
          nextCoachTrust >= 68 && save.football.depthChart.rank === 1
            ? "starter"
            : nextCoachTrust >= 56
              ? "rotation"
              : save.football.depthChart.projectedRole,
      },
      season: {
        ...save.football.season,
        week: Math.max(0, result.life.weekNumber - 1),
      },
    },
    history: [
      ...save.history,
      {
        id: nextOutcome.id,
        occurredAt: save.meta.updatedAt,
        type: "day-completed",
        title: nextOutcome.title,
        description: nextOutcome.summary,
      },
    ],
  };
}
