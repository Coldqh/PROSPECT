import type { FootballPosition } from "../career/types";
import type { TrainingFocusId } from "./types";

export interface TrainingFocusDescriptor {
  id: TrainingFocusId;
  name: string;
  shortName: string;
  summary: string;
  coachValue: string;
  load: number;
  multipliers: {
    technique: number;
    athleticism: number;
    footballIq: number;
    competitiveness: number;
    recovery: number;
  };
}

const POSITION_CRAFT_NAMES: Record<FootballPosition, string> = {
  QB: "Механика и тайминг",
  RB: "Видение гэпа",
  WR: "Маршруты и релиз",
  LB: "Чтение и захват",
  CB: "Футворк и покрытие",
};

const POSITION_CRAFT_SUMMARIES: Record<FootballPosition, string> = {
  QB: "Работа ног, точка выпуска и синхронизация с маршрутами.",
  RB: "Первый шаг, чтение блоков и смена направления без потери скорости.",
  WR: "Выход со старта, вершина маршрута и чистое разделение с защитником.",
  LB: "Диагностика розыгрыша, занятие гэпа и завершение захвата.",
  CB: "Стойка, разворот бёдер и сохранение позиции против маршрута.",
};

export function getTrainingFocusCatalog(position: FootballPosition): readonly TrainingFocusDescriptor[] {
  return [
    {
      id: "position-craft",
      name: POSITION_CRAFT_NAMES[position],
      shortName: "Техника",
      summary: POSITION_CRAFT_SUMMARIES[position],
      coachValue: "TEC",
      load: 62,
      multipliers: { technique: 1.65, athleticism: 0.45, footballIq: 0.8, competitiveness: 0.55, recovery: 0 },
    },
    {
      id: "explosive-power",
      name: "Скорость и взрыв",
      shortName: "Атлетизм",
      summary: "Ускорение, мощность первого шага и работа под высокой интенсивностью.",
      coachValue: "ATH",
      load: 82,
      multipliers: { technique: 0.35, athleticism: 1.75, footballIq: 0.15, competitiveness: 0.9, recovery: -0.1 },
    },
    {
      id: "film-install",
      name: "Видео и схема",
      shortName: "Football IQ",
      summary: "Football IQ",
      coachValue: "IQ",
      load: 34,
      multipliers: { technique: 0.55, athleticism: 0.08, footballIq: 1.9, competitiveness: 0.35, recovery: 0.25 },
    },
    {
      id: "recovery-reset",
      name: "Восстановительный блок",
      shortName: "Восстановление",
      summary: "Мобильность, контролируемая работа и снижение накопленной боли.",
      coachValue: "REC",
      load: 18,
      multipliers: { technique: 0.18, athleticism: 0.08, footballIq: 0.35, competitiveness: 0.15, recovery: 1.65 },
    },
  ] as const;
}

export function getTrainingFocus(position: FootballPosition, focusId: TrainingFocusId): TrainingFocusDescriptor {
  const focus = getTrainingFocusCatalog(position).find((item) => item.id === focusId);
  if (!focus) throw new Error(`Unknown training focus: ${focusId}`);
  return focus;
}
