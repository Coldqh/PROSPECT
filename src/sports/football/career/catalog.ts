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
  { id: "TE", name: "Tight End", unit: "Offense", summary: "Маршруты из плотных формаций, блок и работа против лайнбекеров.", numberRange: [0, 89] },
  { id: "OT", name: "Offensive Tackle", unit: "Offense", summary: "Защита края кармана, работа против speed rush и движение в выносе.", numberRange: [50, 79] },
  { id: "OG", name: "Offensive Guard", unit: "Offense", summary: "Силовая работа внутри, pulls, double-team и защита A-gap.", numberRange: [50, 79] },
  { id: "C", name: "Center", unit: "Offense", summary: "Снэп, вызовы линии, идентификация давления и контроль центра.", numberRange: [50, 79] },
  { id: "EDGE", name: "Edge Rusher", unit: "Defense", summary: "Давление с края, contain и разрушение точки атаки.", numberRange: [0, 59] },
  { id: "DT", name: "Defensive Tackle", unit: "Defense", summary: "Контроль внутренних гэпов, penetration и борьба с double-team.", numberRange: [50, 99] },
  { id: "LB", name: "Linebacker", unit: "Defense", summary: "Диагностика розыгрыша, физичность и контроль центра поля.", numberRange: [0, 59] },
  { id: "CB", name: "Cornerback", unit: "Defense", summary: "Изоляция против ресиверов, реакция и игра с мячом.", numberRange: [0, 49] },
  { id: "S", name: "Safety", unit: "Defense", summary: "Глубокое покрытие, помощь против выноса и управление secondary.", numberRange: [0, 49] },
  { id: "K", name: "Kicker", unit: "Special Teams", summary: "Точность, сила ноги и удары под давлением.", numberRange: [0, 19] },
  { id: "P", name: "Punter", unit: "Special Teams", summary: "Дальность, hang time, направление и контроль позиции поля.", numberRange: [0, 19] },
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
  { id: "inline-blocker", position: "TE", name: "Inline Blocker", label: "Плотная формация", summary: "Держит край, работает в duo и остаётся угрозой на коротком маршруте.", frame: "powerful", height: [75, 79], weight: [240, 272], speed: 68, strength: 87, agility: 63, stamina: 80, explosiveness: 72, technique: 81, footballIq: 78 },
  { id: "seam-threat", position: "TE", name: "Seam Threat", label: "Вертикаль", summary: "Атакует швы зон и выигрывает мячи против safety.", frame: "long", height: [76, 80], weight: [228, 252], speed: 82, strength: 72, agility: 76, stamina: 78, explosiveness: 82, technique: 82, footballIq: 77 },
  { id: "move-tight-end", position: "TE", name: "Move Tight End", label: "Универсальность", summary: "Смещается по формации, читает leverage и создаёт mismatch.", frame: "balanced", height: [74, 78], weight: [222, 248], speed: 80, strength: 74, agility: 82, stamina: 79, explosiveness: 80, technique: 84, footballIq: 82 },
  { id: "blindside-anchor", position: "OT", name: "Blindside Anchor", label: "Pass Pro", summary: "Сохраняет ширину кармана и гасит силовой перевод.", frame: "long", height: [77, 81], weight: [295, 340], speed: 55, strength: 88, agility: 70, stamina: 84, explosiveness: 68, technique: 86, footballIq: 80 },
  { id: "zone-tackle", position: "OT", name: "Zone Tackle", label: "Движение", summary: "Берёт reach-блоки и работает на втором уровне.", frame: "balanced", height: [76, 80], weight: [285, 325], speed: 64, strength: 82, agility: 78, stamina: 85, explosiveness: 72, technique: 83, footballIq: 79 },
  { id: "power-tackle", position: "OT", name: "Power Tackle", label: "Сила", summary: "Двигает край в gap-схемах и выдерживает bull rush.", frame: "powerful", height: [76, 80], weight: [310, 350], speed: 50, strength: 94, agility: 61, stamina: 82, explosiveness: 74, technique: 80, footballIq: 75 },
  { id: "pull-guard", position: "OG", name: "Pull Guard", label: "Мобильность", summary: "Выходит из линии и находит цель в пространстве.", frame: "balanced", height: [74, 78], weight: [290, 330], speed: 62, strength: 85, agility: 75, stamina: 84, explosiveness: 76, technique: 83, footballIq: 80 },
  { id: "phone-booth-guard", position: "OG", name: "Phone Booth Guard", label: "Контакт", summary: "Закрывает внутренний rush и создаёт движение в коротких ярдах.", frame: "powerful", height: [73, 77], weight: [305, 350], speed: 47, strength: 95, agility: 58, stamina: 82, explosiveness: 72, technique: 82, footballIq: 76 },
  { id: "zone-guard", position: "OG", name: "Zone Guard", label: "Комбинации", summary: "Быстро передаёт double-team и выходит к лайнбекеру.", frame: "balanced", height: [73, 77], weight: [285, 325], speed: 60, strength: 84, agility: 76, stamina: 85, explosiveness: 71, technique: 85, footballIq: 82 },
  { id: "line-caller", position: "C", name: "Line Caller", label: "Команды", summary: "Определяет фронт, меняет protection и стабильно делает снэп.", frame: "balanced", height: [72, 76], weight: [285, 325], speed: 55, strength: 86, agility: 70, stamina: 86, explosiveness: 68, technique: 87, footballIq: 90 },
  { id: "reach-center", position: "C", name: "Reach Center", label: "Зона", summary: "Достаёт shaded tackle и запускает наружную зону.", frame: "compact", height: [72, 75], weight: [275, 315], speed: 62, strength: 82, agility: 78, stamina: 87, explosiveness: 71, technique: 86, footballIq: 84 },
  { id: "power-center", position: "C", name: "Power Center", label: "Якорь", summary: "Выдерживает nose tackle и создаёт вертикальное движение.", frame: "powerful", height: [72, 76], weight: [300, 335], speed: 48, strength: 94, agility: 60, stamina: 84, explosiveness: 72, technique: 82, footballIq: 82 },
  { id: "speed-rusher", position: "EDGE", name: "Speed Rusher", label: "Первый шаг", summary: "Выигрывает край скоростью и заставляет tackle раскрывать плечи.", frame: "long", height: [74, 78], weight: [235, 270], speed: 82, strength: 78, agility: 82, stamina: 82, explosiveness: 91, technique: 82, footballIq: 75 },
  { id: "power-rusher", position: "EDGE", name: "Power Rusher", label: "Сила", summary: "Сжимает карман bull rush и конвертирует скорость в контакт.", frame: "powerful", height: [74, 78], weight: [255, 290], speed: 72, strength: 92, agility: 68, stamina: 83, explosiveness: 86, technique: 83, footballIq: 76 },
  { id: "edge-setter", position: "EDGE", name: "Edge Setter", label: "Contain", summary: "Держит внешнее плечо и закрывает вынос до развития.", frame: "balanced", height: [74, 78], weight: [250, 285], speed: 74, strength: 88, agility: 72, stamina: 86, explosiveness: 80, technique: 86, footballIq: 84 },
  { id: "nose-anchor", position: "DT", name: "Nose Anchor", label: "Центр", summary: "Поглощает double-team и не отдаёт A-gap.", frame: "powerful", height: [72, 76], weight: [310, 360], speed: 45, strength: 96, agility: 55, stamina: 78, explosiveness: 76, technique: 84, footballIq: 82 },
  { id: "interior-penetrator", position: "DT", name: "Interior Penetrator", label: "Проникновение", summary: "Выигрывает первый шаг и ломает pocket изнутри.", frame: "balanced", height: [73, 77], weight: [280, 320], speed: 65, strength: 86, agility: 73, stamina: 80, explosiveness: 88, technique: 84, footballIq: 77 },
  { id: "three-technique", position: "DT", name: "Three Technique", label: "Баланс", summary: "Сочетает rush внутри и контроль B-gap.", frame: "powerful", height: [73, 77], weight: [290, 330], speed: 59, strength: 91, agility: 67, stamina: 82, explosiveness: 84, technique: 86, footballIq: 80 },
  { id: "run-stopper", position: "LB", name: "Run Stopper", label: "Силовой центр", summary: "Читает вынос, закрывает гэпы и выдерживает блоки.", frame: "powerful", height: [72, 75], weight: [225, 248], speed: 72, strength: 88, agility: 68, stamina: 82, explosiveness: 78, technique: 78, footballIq: 80 },
  { id: "coverage-linebacker", position: "LB", name: "Coverage Backer", label: "Пространство", summary: "Закрывает тайт-эндов, играет в зонах и быстро меняет направление.", frame: "balanced", height: [72, 75], weight: [215, 235], speed: 82, strength: 74, agility: 82, stamina: 83, explosiveness: 80, technique: 77, footballIq: 82 },
  { id: "edge-hunter", position: "LB", name: "Edge Hunter", label: "Давление", summary: "Первый шаг, изгиб края и атака квотербека.", frame: "long", height: [74, 77], weight: [225, 250], speed: 80, strength: 82, agility: 75, stamina: 78, explosiveness: 88, technique: 79, footballIq: 72 },
  { id: "press-corner", position: "CB", name: "Press Corner", label: "Контакт", summary: "Ломает релиз на линии и играет плотно по человеку.", frame: "balanced", height: [70, 74], weight: [185, 205], speed: 86, strength: 72, agility: 84, stamina: 80, explosiveness: 84, technique: 81, footballIq: 75 },
  { id: "ball-hawk", position: "CB", name: "Ball Hawk", label: "Перехваты", summary: "Читает глаза квотербека и рискует ради мяча.", frame: "long", height: [71, 75], weight: [180, 202], speed: 88, strength: 62, agility: 88, stamina: 78, explosiveness: 87, technique: 78, footballIq: 82 },
  { id: "shutdown-corner", position: "CB", name: "Shutdown Corner", label: "Изоляция", summary: "Баланс скорости, техники и дисциплины без лишнего риска.", frame: "balanced", height: [70, 74], weight: [182, 205], speed: 89, strength: 67, agility: 89, stamina: 82, explosiveness: 86, technique: 84, footballIq: 80 },
  { id: "box-safety", position: "S", name: "Box Safety", label: "Контакт", summary: "Входит в коробку, закрывает alley и играет против tight end.", frame: "powerful", height: [71, 75], weight: [205, 225], speed: 80, strength: 83, agility: 79, stamina: 84, explosiveness: 84, technique: 81, footballIq: 82 },
  { id: "center-fielder", position: "S", name: "Center Fielder", label: "Глубина", summary: "Держит середину поля и перекрывает вертикальные маршруты.", frame: "long", height: [71, 75], weight: [190, 215], speed: 88, strength: 68, agility: 86, stamina: 84, explosiveness: 86, technique: 84, footballIq: 88 },
  { id: "match-safety", position: "S", name: "Match Safety", label: "Чтение", summary: "Меняет ответственность после релиза и закрывает slot.", frame: "balanced", height: [71, 75], weight: [195, 220], speed: 85, strength: 74, agility: 87, stamina: 85, explosiveness: 83, technique: 86, footballIq: 90 },
  { id: "accuracy-kicker", position: "K", name: "Accuracy Kicker", label: "Точность", summary: "Стабильная механика и повторяемый контакт с мячом.", frame: "balanced", height: [69, 74], weight: [170, 205], speed: 60, strength: 64, agility: 72, stamina: 76, explosiveness: 70, technique: 92, footballIq: 82 },
  { id: "power-kicker", position: "K", name: "Power Kicker", label: "Дальность", summary: "Сильная нога расширяет диапазон филд-голов.", frame: "powerful", height: [71, 76], weight: [190, 225], speed: 58, strength: 82, agility: 66, stamina: 77, explosiveness: 87, technique: 82, footballIq: 75 },
  { id: "clutch-kicker", position: "K", name: "Clutch Kicker", label: "Давление", summary: "Сохраняет ритм в концовках и после тайм-аутов.", frame: "balanced", height: [69, 75], weight: [175, 215], speed: 59, strength: 72, agility: 70, stamina: 79, explosiveness: 78, technique: 88, footballIq: 88 },
  { id: "directional-punter", position: "P", name: "Directional Punter", label: "Направление", summary: "Уводит возврат к боковой линии и сокращает свободное поле.", frame: "balanced", height: [71, 76], weight: [185, 225], speed: 62, strength: 72, agility: 70, stamina: 79, explosiveness: 77, technique: 90, footballIq: 84 },
  { id: "hangtime-punter", position: "P", name: "Hangtime Punter", label: "Зависание", summary: "Даёт coverage время закрыть returner.", frame: "long", height: [73, 78], weight: [195, 235], speed: 59, strength: 78, agility: 67, stamina: 80, explosiveness: 84, technique: 87, footballIq: 79 },
  { id: "field-position-punter", position: "P", name: "Field Position Punter", label: "Контроль", summary: "Ставит мяч внутри двадцати и избегает touchback.", frame: "balanced", height: [71, 77], weight: [185, 225], speed: 60, strength: 73, agility: 69, stamina: 81, explosiveness: 79, technique: 92, footballIq: 88 },
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
