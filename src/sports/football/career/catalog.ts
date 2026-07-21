import type {
  FamilyIncomeTier,
  FamilyStructure,
  FamilySupport,
  MindsetPreset,
} from "../../../core/character/types";
import type { FootballPosition } from "./types";

export interface OriginPreset {
  id: string;
  city: string;
  stateCode: string;
  stateName: string;
  region: string;
  tagline: string;
  footballCulture: number;
  schoolQuality: number;
  trainingAccess: number;
  medicalAccess: number;
  neighborhoodSafety: number;
}

export interface PositionDescriptor {
  id: FootballPosition;
  name: string;
  unit: string;
  summary: string;
  numberRange: readonly [number, number];
}

export interface ArchetypeDescriptor {
  id: string;
  position: FootballPosition;
  name: string;
  label: string;
  summary: string;
  frame: "compact" | "balanced" | "long" | "powerful";
  height: readonly [number, number];
  weight: readonly [number, number];
  speed: number;
  strength: number;
  agility: number;
  stamina: number;
  explosiveness: number;
  technique: number;
  footballIq: number;
}

export const originPresets: readonly OriginPreset[] = [
  {
    id: "houston",
    city: "Houston",
    stateCode: "TX",
    stateName: "Texas",
    region: "Gulf Coast",
    tagline: "Глубокая конкуренция, жара и футбол круглый год.",
    footballCulture: 94,
    schoolQuality: 72,
    trainingAccess: 82,
    medicalAccess: 76,
    neighborhoodSafety: 58,
  },
  {
    id: "miami",
    city: "Miami",
    stateCode: "FL",
    stateName: "Florida",
    region: "South Florida",
    tagline: "Скорость, давление и постоянное внимание скаутов.",
    footballCulture: 91,
    schoolQuality: 67,
    trainingAccess: 86,
    medicalAccess: 78,
    neighborhoodSafety: 55,
  },
  {
    id: "atlanta",
    city: "Atlanta",
    stateCode: "GA",
    stateName: "Georgia",
    region: "Deep South",
    tagline: "Сильные программы и плотный рынок талантов.",
    footballCulture: 92,
    schoolQuality: 74,
    trainingAccess: 80,
    medicalAccess: 75,
    neighborhoodSafety: 62,
  },
  {
    id: "long-beach",
    city: "Long Beach",
    stateCode: "CA",
    stateName: "California",
    region: "Southern California",
    tagline: "Техника, медиа и дорогая спортивная среда.",
    footballCulture: 80,
    schoolQuality: 78,
    trainingAccess: 88,
    medicalAccess: 86,
    neighborhoodSafety: 66,
  },
  {
    id: "detroit",
    city: "Detroit",
    stateCode: "MI",
    stateName: "Michigan",
    region: "Great Lakes",
    tagline: "Жёсткий климат, физичный футбол и меньше шума.",
    footballCulture: 76,
    schoolQuality: 64,
    trainingAccess: 66,
    medicalAccess: 70,
    neighborhoodSafety: 48,
  },
  {
    id: "philadelphia",
    city: "Philadelphia",
    stateCode: "PA",
    stateName: "Pennsylvania",
    region: "Northeast",
    tagline: "Старые школы, требовательные тренеры и сильная пресса.",
    footballCulture: 82,
    schoolQuality: 73,
    trainingAccess: 74,
    medicalAccess: 82,
    neighborhoodSafety: 57,
  },
] as const;

export const positionDescriptors: readonly PositionDescriptor[] = [
  { id: "QB", name: "Quarterback", unit: "Offense", summary: "Чтение защиты, управление риском и ответственность за розыгрыш.", numberRange: [1, 19] },
  { id: "RB", name: "Running Back", unit: "Offense", summary: "Видение гэпов, контактный баланс и работа на ограниченном пространстве.", numberRange: [0, 49] },
  { id: "WR", name: "Wide Receiver", unit: "Offense", summary: "Маршруты, освобождение, скорость и спорные мячи.", numberRange: [0, 19] },
  { id: "LB", name: "Linebacker", unit: "Defense", summary: "Диагностика розыгрыша, физичность и контроль центра поля.", numberRange: [0, 59] },
  { id: "CB", name: "Cornerback", unit: "Defense", summary: "Изоляция против ресиверов, реакция и игра с мячом.", numberRange: [0, 49] },
] as const;

export const archetypes: readonly ArchetypeDescriptor[] = [
  { id: "field-general", position: "QB", name: "Field General", label: "Контроль", summary: "Сильное чтение игры, точность и спокойствие под давлением.", frame: "balanced", height: [73, 76], weight: [205, 228], speed: 64, strength: 65, agility: 68, stamina: 73, explosiveness: 63, technique: 80, footballIq: 84 },
  { id: "gunslinger", position: "QB", name: "Gunslinger", label: "Вертикальная угроза", summary: "Большая рука, агрессивные окна и нестабильные решения.", frame: "powerful", height: [74, 77], weight: [215, 238], speed: 61, strength: 73, agility: 62, stamina: 72, explosiveness: 69, technique: 76, footballIq: 72 },
  { id: "dual-threat", position: "QB", name: "Dual Threat", label: "Динамика", summary: "Выход из кармана, импровизация и давление ногами.", frame: "balanced", height: [71, 75], weight: [195, 220], speed: 82, strength: 64, agility: 80, stamina: 78, explosiveness: 83, technique: 72, footballIq: 74 },
  { id: "power-back", position: "RB", name: "Power Back", label: "Контакт", summary: "Сила после контакта, защита мяча и короткие ярды.", frame: "powerful", height: [69, 72], weight: [215, 238], speed: 73, strength: 86, agility: 68, stamina: 81, explosiveness: 78, technique: 74, footballIq: 70 },
  { id: "slasher", position: "RB", name: "Slasher", label: "Открытое поле", summary: "Резкий первый шаг, смена направления и большие выносы.", frame: "compact", height: [67, 71], weight: [185, 210], speed: 87, strength: 66, agility: 88, stamina: 78, explosiveness: 89, technique: 72, footballIq: 68 },
  { id: "receiving-back", position: "RB", name: "Receiving Back", label: "Универсальность", summary: "Маршруты, пасовая защита и работа в пространстве.", frame: "balanced", height: [68, 72], weight: [195, 218], speed: 82, strength: 68, agility: 84, stamina: 80, explosiveness: 82, technique: 79, footballIq: 77 },
  { id: "route-technician", position: "WR", name: "Route Technician", label: "Точность", summary: "Чистые маршруты, чувство зон и стабильное разделение.", frame: "balanced", height: [70, 74], weight: [178, 205], speed: 81, strength: 62, agility: 87, stamina: 79, explosiveness: 80, technique: 86, footballIq: 79 },
  { id: "vertical-threat", position: "WR", name: "Vertical Threat", label: "Скорость", summary: "Растягивает поле, выигрывает старт и требует глубокой страховки.", frame: "long", height: [71, 75], weight: [180, 205], speed: 92, strength: 58, agility: 82, stamina: 76, explosiveness: 91, technique: 73, footballIq: 68 },
  { id: "contested-catch", position: "WR", name: "Contested Catch", label: "Физичность", summary: "Большой радиус ловли, контакт и работа в красной зоне.", frame: "powerful", height: [74, 78], weight: [205, 232], speed: 75, strength: 80, agility: 69, stamina: 76, explosiveness: 82, technique: 78, footballIq: 71 },
  { id: "run-stopper", position: "LB", name: "Run Stopper", label: "Силовой центр", summary: "Читает вынос, закрывает гэпы и выдерживает блоки.", frame: "powerful", height: [72, 75], weight: [225, 248], speed: 72, strength: 88, agility: 68, stamina: 82, explosiveness: 78, technique: 78, footballIq: 80 },
  { id: "coverage-linebacker", position: "LB", name: "Coverage Backer", label: "Пространство", summary: "Закрывает тайт-эндов, играет в зонах и быстро меняет направление.", frame: "balanced", height: [72, 75], weight: [215, 235], speed: 82, strength: 74, agility: 82, stamina: 83, explosiveness: 80, technique: 77, footballIq: 82 },
  { id: "edge-hunter", position: "LB", name: "Edge Hunter", label: "Давление", summary: "Первый шаг, изгиб края и атака квотербека.", frame: "long", height: [74, 77], weight: [225, 250], speed: 80, strength: 82, agility: 75, stamina: 78, explosiveness: 88, technique: 79, footballIq: 72 },
  { id: "press-corner", position: "CB", name: "Press Corner", label: "Контакт", summary: "Ломает релиз на линии и играет плотно по человеку.", frame: "balanced", height: [70, 74], weight: [185, 205], speed: 86, strength: 72, agility: 84, stamina: 80, explosiveness: 84, technique: 81, footballIq: 75 },
  { id: "ball-hawk", position: "CB", name: "Ball Hawk", label: "Перехваты", summary: "Читает глаза квотербека и рискует ради мяча.", frame: "long", height: [71, 75], weight: [180, 202], speed: 88, strength: 62, agility: 88, stamina: 78, explosiveness: 87, technique: 78, footballIq: 82 },
  { id: "shutdown-corner", position: "CB", name: "Shutdown Corner", label: "Изоляция", summary: "Баланс скорости, техники и дисциплины без лишнего риска.", frame: "balanced", height: [70, 74], weight: [182, 205], speed: 89, strength: 67, agility: 89, stamina: 82, explosiveness: 86, technique: 84, footballIq: 80 },
] as const;

export const mindsetLabels: Record<MindsetPreset, { name: string; summary: string }> = {
  obsessed: { name: "Одержимый", summary: "Высокая дисциплина и амбиция, но больше давления на себя." },
  composed: { name: "Хладнокровный", summary: "Стабильность, обучаемость и контроль в сложных ситуациях." },
  electric: { name: "Электрический", summary: "Уверенность, риск и яркие решения с перепадами формы." },
  underdog: { name: "Недооценённый", summary: "Адаптивность, терпение и сильная реакция на конкуренцию." },
};

export const familyIncomeLabels: Record<FamilyIncomeTier, string> = {
  strained: "Денег постоянно не хватает",
  working: "Рабочая семья",
  comfortable: "Стабильный средний класс",
  wealthy: "Обеспеченная семья",
};

export const familyStructureLabels: Record<FamilyStructure, string> = {
  "two-parent": "Два родителя",
  "single-parent": "Один родитель",
  "extended-family": "Большая семья",
};

export const familySupportLabels: Record<FamilySupport, string> = {
  demanding: "Высокие требования",
  supportive: "Активная поддержка",
  "hands-off": "Свобода решений",
};

export function getArchetypesForPosition(position: FootballPosition): readonly ArchetypeDescriptor[] {
  return archetypes.filter((item) => item.position === position);
}

export function getArchetype(id: string): ArchetypeDescriptor {
  const archetype = archetypes.find((item) => item.id === id);
  if (!archetype) {
    throw new Error(`Unknown football archetype: ${id}`);
  }
  return archetype;
}

export function getOriginPreset(id: string): OriginPreset {
  const origin = originPresets.find((item) => item.id === id);
  if (!origin) {
    throw new Error(`Unknown origin preset: ${id}`);
  }
  return origin;
}

export function getPositionDescriptor(position: FootballPosition): PositionDescriptor {
  const descriptor = positionDescriptors.find((item) => item.id === position);
  if (!descriptor) {
    throw new Error(`Unknown football position: ${position}`);
  }
  return descriptor;
}
