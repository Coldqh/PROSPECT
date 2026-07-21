import type { FocusAllocation, TrainingIntensity, WeeklyPlanTemplateId } from "./types";

export interface WeeklyPlanTemplate {
  id: WeeklyPlanTemplateId;
  name: string;
  shortName: string;
  description: string;
  focus: FocusAllocation;
  risk: "low" | "medium" | "high";
  identity: string;
}

export interface IntensityDescriptor {
  id: TrainingIntensity;
  name: string;
  description: string;
  loadMultiplier: number;
}

export const weeklyPlanTemplates: readonly WeeklyPlanTemplate[] = [
  {
    id: "balanced",
    name: "Balanced Week",
    shortName: "Balance",
    description: "Стабильный прогресс без провала в учёбе и восстановлении.",
    focus: { training: 34, recovery: 25, study: 25, social: 16 },
    risk: "low",
    identity: "Надёжный режим",
  },
  {
    id: "breakout",
    name: "Breakout Push",
    shortName: "Breakout",
    description: "Максимум работы ради рывка в depth chart. Усталость накапливается быстрее.",
    focus: { training: 50, recovery: 16, study: 18, social: 16 },
    risk: "high",
    identity: "Давление на состав",
  },
  {
    id: "recovery",
    name: "Recovery Block",
    shortName: "Recovery",
    description: "Сон, медицина и разгрузка. Развитие замедляется, состояние стабилизируется.",
    focus: { training: 22, recovery: 44, study: 22, social: 12 },
    risk: "low",
    identity: "Вернуть тело",
  },
  {
    id: "academic",
    name: "Academic Lock",
    shortName: "Academic",
    description: "Учёба становится главным приоритетом. Спортивный прогресс остаётся контролируемым.",
    focus: { training: 24, recovery: 20, study: 44, social: 12 },
    risk: "medium",
    identity: "Защитить eligibility",
  },
  {
    id: "film-room",
    name: "Film Room",
    shortName: "Film",
    description: "Меньше физической нагрузки, больше тактики и подготовки к сопернику.",
    focus: { training: 34, recovery: 20, study: 30, social: 16 },
    risk: "medium",
    identity: "Играть умнее",
  },
] as const;

export const intensityDescriptors: readonly IntensityDescriptor[] = [
  {
    id: "controlled",
    name: "Controlled",
    description: "Низкий риск, умеренный темп развития.",
    loadMultiplier: 0.82,
  },
  {
    id: "standard",
    name: "Standard",
    description: "Рабочий режим команды.",
    loadMultiplier: 1,
  },
  {
    id: "aggressive",
    name: "Aggressive",
    description: "Больше прогресса и давления на организм.",
    loadMultiplier: 1.24,
  },
] as const;

export function getWeeklyPlanTemplate(id: WeeklyPlanTemplateId): WeeklyPlanTemplate {
  const template = weeklyPlanTemplates.find((item) => item.id === id);
  if (!template) {
    throw new Error(`Unknown weekly plan template: ${id}`);
  }
  return template;
}

export function getIntensityDescriptor(id: TrainingIntensity): IntensityDescriptor {
  const descriptor = intensityDescriptors.find((item) => item.id === id);
  if (!descriptor) {
    throw new Error(`Unknown training intensity: ${id}`);
  }
  return descriptor;
}
