import type { FootballRosterPosition, RosterUnit } from "./types";

export const FOOTBALL_ROSTER_POSITIONS = [
  "QB", "RB", "WR", "TE", "OT", "OG", "C", "EDGE", "DT", "LB", "CB", "S", "K", "P",
] as const satisfies readonly FootballRosterPosition[];

export const OFFENSE_ROSTER_POSITIONS = ["QB", "RB", "WR", "TE", "OT", "OG", "C"] as const satisfies readonly FootballRosterPosition[];
export const DEFENSE_ROSTER_POSITIONS = ["EDGE", "DT", "LB", "CB", "S"] as const satisfies readonly FootballRosterPosition[];
export const SPECIAL_TEAMS_POSITIONS = ["K", "P"] as const satisfies readonly FootballRosterPosition[];

export type FootballPositionGroup = "backfield" | "receiver" | "offensive-line" | "defensive-front" | "second-level" | "secondary" | "specialists";

export const POSITION_LABELS: Record<FootballRosterPosition, string> = {
  QB: "Квотербек",
  RB: "Раннинбек",
  WR: "Ресивер",
  TE: "Тайт-энд",
  OT: "Оффенсив тэкл",
  OG: "Оффенсив гард",
  C: "Центр",
  EDGE: "Эдж-рашер",
  DT: "Дефенсив тэкл",
  LB: "Лайнбекер",
  CB: "Корнербек",
  S: "Сэйфти",
  K: "Кикер",
  P: "Пантер",
};

export const POSITION_GROUPS: Record<FootballRosterPosition, FootballPositionGroup> = {
  QB: "backfield",
  RB: "backfield",
  WR: "receiver",
  TE: "receiver",
  OT: "offensive-line",
  OG: "offensive-line",
  C: "offensive-line",
  EDGE: "defensive-front",
  DT: "defensive-front",
  LB: "second-level",
  CB: "secondary",
  S: "secondary",
  K: "specialists",
  P: "specialists",
};

export const POSITION_ROOM_TARGETS: Record<"high-school" | "college", Record<FootballRosterPosition, number>> = {
  "high-school": {
    QB: 3,
    RB: 4,
    WR: 7,
    TE: 3,
    OT: 5,
    OG: 5,
    C: 2,
    EDGE: 4,
    DT: 4,
    LB: 6,
    CB: 7,
    S: 5,
    K: 1,
    P: 1,
  },
  college: {
    QB: 4,
    RB: 6,
    WR: 9,
    TE: 5,
    OT: 6,
    OG: 6,
    C: 4,
    EDGE: 7,
    DT: 7,
    LB: 8,
    CB: 9,
    S: 7,
    K: 2,
    P: 2,
  },
};

export const POSITION_STARTER_TARGETS: Record<FootballRosterPosition, number> = {
  QB: 1,
  RB: 1,
  WR: 3,
  TE: 1,
  OT: 2,
  OG: 2,
  C: 1,
  EDGE: 2,
  DT: 2,
  LB: 2,
  CB: 3,
  S: 2,
  K: 1,
  P: 1,
};

export const POSITION_CHANGE_OPTIONS: Record<FootballRosterPosition, readonly FootballRosterPosition[]> = {
  QB: ["WR", "TE"],
  RB: ["WR", "LB"],
  WR: ["TE", "CB", "RB"],
  TE: ["WR", "OT", "EDGE"],
  OT: ["OG", "TE"],
  OG: ["C", "OT", "DT"],
  C: ["OG"],
  EDGE: ["LB", "DT", "TE"],
  DT: ["EDGE", "OG"],
  LB: ["EDGE", "S", "RB"],
  CB: ["S", "WR"],
  S: ["CB", "LB"],
  K: ["P"],
  P: ["K"],
};

export function rosterUnitForPosition(position: FootballRosterPosition): RosterUnit {
  if ((OFFENSE_ROSTER_POSITIONS as readonly string[]).includes(position)) return "offense";
  if ((DEFENSE_ROSTER_POSITIONS as readonly string[]).includes(position)) return "defense";
  return "special";
}

export function positionRoomTarget(position: FootballRosterPosition, level: "high-school" | "college"): number {
  return POSITION_ROOM_TARGETS[level][position];
}

export function positionLabel(position: FootballRosterPosition): string {
  return POSITION_LABELS[position];
}

export function normalizeLegacyRosterPosition(position: FootballRosterPosition | "OL" | "DL", seed: string): FootballRosterPosition {
  if (position === "OL") {
    const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
    return (["OT", "OG", "C", "OG", "OT"] as const)[index]!;
  }
  if (position === "DL") {
    const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
    return (["EDGE", "DT", "DT", "EDGE"] as const)[index]!;
  }
  return position;
}
