import { getWeeklyPlanTemplate } from "./planCatalog";
import type { LifeState } from "./types";

export function createInitialLifeState(): LifeState {
  const template = getWeeklyPlanTemplate("balanced");
  return {
    moduleVersion: 1,
    weekNumber: 1,
    dayIndex: 0,
    completedDays: 0,
    weeklyPlan: {
      templateId: template.id,
      intensity: "standard",
      focus: { ...template.focus },
      revision: 1,
    },
    consistency: 58,
  };
}
