import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition } from "../career/types";
import type {
  MatchHeroInvolvement,
  MatchPlayCall,
  MatchPlayerAssignment,
  MatchPoint,
  MatchTeamSide,
  MatchUnit,
} from "./types";

interface PlayDescriptor {
  id: string;
  formation: string;
  personnel: string;
  concept: string;
  playType: MatchPlayCall["playType"];
  strength: MatchPlayCall["strength"];
  aggression: number;
  primarySlot?: string;
  progression?: string[];
  runLane?: string;
  tags: string[];
}

export interface PlayCallContext {
  down: number;
  distance: number;
  fieldPosition: number;
  scoreMargin: number;
  quarter: number;
  clockSeconds: number;
  canCheck: boolean;
}

interface FormationPlayer {
  slot: string;
  position: string;
  label: string;
  start: MatchPoint;
}

const offenseCalls: readonly PlayDescriptor[] = [
  { id: "gun-trips-inside-zone", formation: "Gun Trips", personnel: "11", concept: "Inside Zone", playType: "run", strength: "right", aggression: 34, primarySlot: "RB", runLane: "A-right", tags: ["base", "zone", "early-down"] },
  { id: "gun-trips-rpo-glance", formation: "Gun Trips", personnel: "11", concept: "RPO Glance", playType: "play-action", strength: "right", aggression: 58, primarySlot: "X", progression: ["X", "H", "RB"], runLane: "B-right", tags: ["rpo", "box-count", "early-down"] },
  { id: "gun-doubles-mesh", formation: "Gun Doubles", personnel: "11", concept: "Mesh", playType: "pass", strength: "middle", aggression: 48, primarySlot: "H", progression: ["H", "Y", "RB", "X"], tags: ["man-beater", "short", "third-down"] },
  { id: "gun-doubles-four-verts", formation: "Gun Doubles", personnel: "11", concept: "Four Verticals", playType: "pass", strength: "middle", aggression: 84, primarySlot: "Z", progression: ["Z", "H", "X", "Y"], tags: ["shot", "two-high", "long-yardage"] },
  { id: "singleback-duo", formation: "Singleback Ace", personnel: "12", concept: "Duo", playType: "run", strength: "middle", aggression: 38, primarySlot: "RB", runLane: "A-middle", tags: ["base", "short-yardage", "light-box"] },
  { id: "singleback-counter", formation: "Singleback Ace", personnel: "12", concept: "Counter GT", playType: "run", strength: "left", aggression: 52, primarySlot: "RB", runLane: "C-left", tags: ["gap", "edge", "changeup"] },
  { id: "singleback-boot", formation: "Singleback Ace", personnel: "12", concept: "Boot Cross", playType: "play-action", strength: "left", aggression: 61, primarySlot: "Y", progression: ["Y", "Z", "RB"], tags: ["play-action", "move-pocket", "zone-beater"] },
  { id: "pistol-power-read", formation: "Pistol Strong", personnel: "21", concept: "Power Read", playType: "run", strength: "left", aggression: 59, primarySlot: "RB", runLane: "C-left", tags: ["option", "gap", "edge"] },
  { id: "pistol-split-zone", formation: "Pistol Strong", personnel: "21", concept: "Split Zone", playType: "run", strength: "right", aggression: 40, primarySlot: "RB", runLane: "B-right", tags: ["zone", "misdirection", "early-down"] },
  { id: "gun-trips-flood", formation: "Gun Trips", personnel: "11", concept: "Flood", playType: "pass", strength: "right", aggression: 66, primarySlot: "Z", progression: ["Z", "Y", "H", "RB"], tags: ["sideline", "zone-beater", "medium"] },
  { id: "gun-trips-stick", formation: "Gun Trips", personnel: "11", concept: "Stick", playType: "pass", strength: "right", aggression: 36, primarySlot: "Y", progression: ["Y", "H", "RB", "X"], tags: ["quick", "third-down", "safe"] },
  { id: "empty-spacing", formation: "Empty", personnel: "10", concept: "Spacing", playType: "pass", strength: "middle", aggression: 42, primarySlot: "H", progression: ["H", "Y", "Z", "X", "F"], tags: ["quick", "empty", "blitz-answer"] },
  { id: "empty-dagger", formation: "Empty", personnel: "10", concept: "Dagger", playType: "pass", strength: "left", aggression: 76, primarySlot: "X", progression: ["X", "H", "Z"], tags: ["deep", "middle-open", "long-yardage"] },
  { id: "gun-tunnel-screen", formation: "Gun Doubles", personnel: "11", concept: "Tunnel Screen", playType: "screen", strength: "right", aggression: 45, primarySlot: "Z", progression: ["Z"], tags: ["screen", "pressure-answer", "perimeter"] },
  { id: "gun-rb-screen", formation: "Gun Trips", personnel: "11", concept: "RB Slip Screen", playType: "screen", strength: "left", aggression: 40, primarySlot: "RB", progression: ["RB"], tags: ["screen", "pressure-answer", "middle"] },
  { id: "goal-line-power", formation: "Goal Line", personnel: "23", concept: "Power O", playType: "run", strength: "left", aggression: 64, primarySlot: "RB", runLane: "C-left", tags: ["goal-line", "short-yardage", "gap"] },
  { id: "goal-line-pop", formation: "Goal Line", personnel: "23", concept: "Tight End Pop", playType: "play-action", strength: "middle", aggression: 72, primarySlot: "Y", progression: ["Y", "U", "RB"], tags: ["goal-line", "play-action", "shot"] },
];

const defenseCalls: readonly PlayDescriptor[] = [
  { id: "43-cover3", formation: "4–3 Over", personnel: "Base", concept: "Cover 3 Buzz", playType: "coverage", strength: "right", aggression: 36, tags: ["base", "single-high", "run-support"] },
  { id: "43-sam-fire", formation: "4–3 Under", personnel: "Base", concept: "Sam Fire", playType: "blitz", strength: "left", aggression: 67, tags: ["pressure", "edge", "five-man"] },
  { id: "43-cover1", formation: "4–3 Over", personnel: "Base", concept: "Cover 1 Robber", playType: "coverage", strength: "middle", aggression: 56, tags: ["man", "single-high", "robber"] },
  { id: "nickel-quarters", formation: "Nickel 4–2–5", personnel: "Nickel", concept: "Quarters Match", playType: "coverage", strength: "middle", aggression: 39, tags: ["two-high", "match", "explosive-control"] },
  { id: "nickel-palms", formation: "Nickel 4–2–5", personnel: "Nickel", concept: "Palms", playType: "coverage", strength: "right", aggression: 48, tags: ["two-high", "trap", "quick-game"] },
  { id: "nickel-double-a", formation: "Nickel 4–2–5", personnel: "Nickel", concept: "Double A Mug", playType: "blitz", strength: "middle", aggression: 78, tags: ["pressure", "interior", "third-down"] },
  { id: "34-fire-zone", formation: "3–4 Odd", personnel: "Base", concept: "Fire Zone", playType: "blitz", strength: "right", aggression: 70, tags: ["pressure", "zone", "simulated"] },
  { id: "34-quarters", formation: "3–4 Odd", personnel: "Base", concept: "Quarters", playType: "coverage", strength: "middle", aggression: 35, tags: ["two-high", "run-fit", "base"] },
  { id: "dime-cover2man", formation: "Dime", personnel: "Dime", concept: "Cover 2 Man", playType: "coverage", strength: "middle", aggression: 52, tags: ["man", "long-yardage", "two-high"] },
  { id: "dime-cross-dog", formation: "Dime", personnel: "Dime", concept: "Cross Dog", playType: "blitz", strength: "middle", aggression: 82, tags: ["pressure", "long-yardage", "inside"] },
  { id: "bear-robber", formation: "Bear Front", personnel: "Heavy", concept: "Cover 1 Robber", playType: "coverage", strength: "left", aggression: 62, tags: ["heavy-box", "man", "short-yardage"] },
  { id: "bear-zero", formation: "Bear Front", personnel: "Heavy", concept: "Zero Pressure", playType: "blitz", strength: "middle", aggression: 90, tags: ["all-out", "short-yardage", "pressure"] },
  { id: "goal-zero", formation: "Goal Line", personnel: "Heavy", concept: "Goal Line Zero", playType: "blitz", strength: "middle", aggression: 92, tags: ["goal-line", "all-out", "run-commit"] },
];

function weightedPick<T>(random: SeededRandom, items: readonly T[], weight: (item: T) => number): T {
  const values = items.map((item) => Math.max(0.01, weight(item)));
  const total = values.reduce((sum, value) => sum + value, 0);
  let cursor = random.next() * total;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= values[index] ?? 0;
    if (cursor <= 0) return items[index] ?? items[0]!;
  }
  return items[items.length - 1] ?? items[0]!;
}

function offenseWeight(play: PlayDescriptor, context: PlayCallContext): number {
  let weight = 1;
  const { down, distance, fieldPosition, scoreMargin, quarter, clockSeconds } = context;
  const passLike = play.playType === "pass" || play.playType === "play-action" || play.playType === "screen";
  if (distance >= 8) weight *= passLike ? 2.6 : 0.24;
  if (distance <= 3) weight *= play.playType === "run" || play.tags.includes("quick") ? 2.3 : 0.62;
  if (down === 1 && play.tags.includes("early-down")) weight *= 1.7;
  if (down === 3 && play.tags.includes("third-down")) weight *= 2.2;
  if (down === 3 && distance >= 7 && play.tags.includes("long-yardage")) weight *= 2.3;
  if (fieldPosition >= 88) weight *= play.tags.includes("goal-line") ? 4 : 0.45;
  if (fieldPosition < 12 && play.aggression >= 75) weight *= 0.45;
  if (quarter === 4 && clockSeconds < 180 && scoreMargin < 0) weight *= passLike ? 2.5 : 0.2;
  if (quarter === 4 && clockSeconds < 180 && scoreMargin > 0) weight *= play.playType === "run" ? 2.4 : 0.45;
  if (scoreMargin <= -10) weight *= play.aggression >= 60 ? 1.7 : 0.7;
  if (scoreMargin >= 10) weight *= play.aggression <= 55 ? 1.7 : 0.7;
  return weight;
}

function defenseWeight(play: PlayDescriptor, context: PlayCallContext): number {
  let weight = 1;
  const { down, distance, fieldPosition, scoreMargin, quarter, clockSeconds } = context;
  if (distance >= 8) weight *= play.tags.includes("long-yardage") || play.tags.includes("two-high") ? 2.7 : 0.45;
  if (distance <= 3) weight *= play.tags.includes("short-yardage") || play.tags.includes("heavy-box") ? 3 : 0.48;
  if (down === 3 && play.tags.includes("third-down")) weight *= 2.2;
  if (fieldPosition >= 90) weight *= play.tags.includes("goal-line") ? 4.4 : 0.32;
  if (quarter === 4 && clockSeconds < 150 && scoreMargin > 0) weight *= play.tags.includes("two-high") ? 2.2 : 0.55;
  if (quarter === 4 && clockSeconds < 150 && scoreMargin < 0) weight *= play.playType === "blitz" ? 1.8 : 0.75;
  return weight;
}

export function callPlay(
  seed: string,
  unit: MatchUnit,
  down: number,
  distance: number,
  fieldPosition: number,
  canCheck: boolean,
  scoreMargin = 0,
  quarter = 1,
  clockSeconds = 720,
): MatchPlayCall {
  const random = new SeededRandom(seed);
  const context: PlayCallContext = { down, distance, fieldPosition, scoreMargin, quarter, clockSeconds, canCheck };
  const catalog = unit === "offense" ? offenseCalls : defenseCalls;
  const selected = weightedPick(random, catalog, (play) => unit === "offense" ? offenseWeight(play, context) : defenseWeight(play, context));
  return {
    id: selected.id,
    formation: selected.formation,
    personnel: selected.personnel,
    concept: selected.concept,
    playType: selected.playType,
    strength: selected.strength,
    calledBy: unit === "offense" ? "offensive-coordinator" : "defensive-coordinator",
    canCheck,
    aggression: selected.aggression,
    primarySlot: selected.primarySlot,
    progression: [...(selected.progression ?? [])],
    runLane: selected.runLane,
    tags: [...selected.tags],
  };
}

function point(x: number, y: number): MatchPoint {
  return { x, y };
}

function offenseFormation(formation: string): FormationPlayer[] {
  const line: FormationPlayer[] = [
    { slot: "LT", position: "OT", label: "LT", start: point(36, 62) },
    { slot: "LG", position: "OG", label: "LG", start: point(43, 61) },
    { slot: "C", position: "C", label: "C", start: point(50, 60) },
    { slot: "RG", position: "OG", label: "RG", start: point(57, 61) },
    { slot: "RT", position: "OT", label: "RT", start: point(64, 62) },
  ];
  const skill: Record<string, FormationPlayer[]> = {
    "Gun Trips": [
      { slot: "X", position: "WR", label: "X", start: point(10, 53) },
      { slot: "Y", position: "TE", label: "Y", start: point(69, 55) },
      { slot: "H", position: "WR", label: "H", start: point(78, 50) },
      { slot: "Z", position: "WR", label: "Z", start: point(91, 53) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, 73) },
      { slot: "RB", position: "RB", label: "RB", start: point(42, 82) },
    ],
    "Gun Doubles": [
      { slot: "X", position: "WR", label: "X", start: point(9, 52) },
      { slot: "H", position: "WR", label: "H", start: point(24, 49) },
      { slot: "Y", position: "TE", label: "Y", start: point(76, 49) },
      { slot: "Z", position: "WR", label: "Z", start: point(91, 52) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, 73) },
      { slot: "RB", position: "RB", label: "RB", start: point(58, 82) },
    ],
    "Singleback Ace": [
      { slot: "X", position: "WR", label: "X", start: point(10, 53) },
      { slot: "Y", position: "TE", label: "Y", start: point(69, 56) },
      { slot: "U", position: "TE", label: "U", start: point(31, 56) },
      { slot: "Z", position: "WR", label: "Z", start: point(90, 53) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, 68) },
      { slot: "RB", position: "RB", label: "RB", start: point(50, 84) },
    ],
    "Pistol Strong": [
      { slot: "X", position: "WR", label: "X", start: point(9, 53) },
      { slot: "Z", position: "WR", label: "Z", start: point(91, 53) },
      { slot: "Y", position: "TE", label: "Y", start: point(71, 56) },
      { slot: "FB", position: "RB", label: "FB", start: point(40, 78) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, 73) },
      { slot: "RB", position: "RB", label: "RB", start: point(50, 88) },
    ],
    Empty: [
      { slot: "X", position: "WR", label: "X", start: point(7, 52) },
      { slot: "H", position: "WR", label: "H", start: point(22, 48) },
      { slot: "F", position: "RB", label: "F", start: point(34, 51) },
      { slot: "Y", position: "WR", label: "Y", start: point(78, 48) },
      { slot: "Z", position: "WR", label: "Z", start: point(93, 52) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, 74) },
    ],
    "Goal Line": [
      { slot: "Y", position: "TE", label: "Y", start: point(69, 57) },
      { slot: "U", position: "TE", label: "U", start: point(31, 57) },
      { slot: "W", position: "TE", label: "W", start: point(76, 61) },
      { slot: "FB", position: "RB", label: "FB", start: point(44, 76) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, 68) },
      { slot: "RB", position: "RB", label: "RB", start: point(50, 84) },
    ],
  };
  return [...line, ...(skill[formation] ?? skill["Gun Doubles"]!)];
}

function defenseFormation(formation: string): FormationPlayer[] {
  if (formation === "3–4 Odd") {
    return [
      { slot: "LE", position: "EDGE", label: "DE", start: point(39, 42) },
      { slot: "NT", position: "DT", label: "NT", start: point(50, 40) },
      { slot: "RE", position: "EDGE", label: "DE", start: point(61, 42) },
      { slot: "WILL", position: "LB", label: "W", start: point(28, 30) },
      { slot: "MIKE", position: "LB", label: "M", start: point(44, 28) },
      { slot: "SAM", position: "LB", label: "S", start: point(56, 28) },
      { slot: "JACK", position: "LB", label: "J", start: point(72, 30) },
      { slot: "LCB", position: "CB", label: "CB", start: point(9, 22) },
      { slot: "RCB", position: "CB", label: "CB", start: point(91, 22) },
      { slot: "FS", position: "S", label: "FS", start: point(39, 10) },
      { slot: "SS", position: "S", label: "SS", start: point(61, 10) },
    ];
  }
  if (formation === "Nickel 4–2–5") {
    return [
      { slot: "LE", position: "EDGE", label: "DE", start: point(35, 42) },
      { slot: "DT1", position: "DT", label: "DT", start: point(45, 40) },
      { slot: "DT2", position: "DT", label: "DT", start: point(55, 40) },
      { slot: "RE", position: "EDGE", label: "DE", start: point(65, 42) },
      { slot: "WILL", position: "LB", label: "W", start: point(42, 27) },
      { slot: "MIKE", position: "LB", label: "M", start: point(58, 27) },
      { slot: "LCB", position: "CB", label: "CB", start: point(8, 21) },
      { slot: "NB", position: "CB", label: "NB", start: point(28, 23) },
      { slot: "RCB", position: "CB", label: "CB", start: point(92, 21) },
      { slot: "FS", position: "S", label: "FS", start: point(41, 9) },
      { slot: "SS", position: "S", label: "SS", start: point(63, 10) },
    ];
  }
  if (formation === "Dime") {
    return [
      { slot: "LE", position: "EDGE", label: "DE", start: point(35, 42) },
      { slot: "DT1", position: "DT", label: "DT", start: point(45, 40) },
      { slot: "DT2", position: "DT", label: "DT", start: point(55, 40) },
      { slot: "RE", position: "EDGE", label: "DE", start: point(65, 42) },
      { slot: "MIKE", position: "LB", label: "M", start: point(50, 27) },
      { slot: "LCB", position: "CB", label: "CB", start: point(7, 21) },
      { slot: "SCB", position: "CB", label: "DB", start: point(27, 22) },
      { slot: "NB", position: "CB", label: "NB", start: point(73, 22) },
      { slot: "RCB", position: "CB", label: "CB", start: point(93, 21) },
      { slot: "FS", position: "S", label: "FS", start: point(39, 9) },
      { slot: "SS", position: "S", label: "SS", start: point(61, 9) },
    ];
  }
  if (formation === "Bear Front" || formation === "Goal Line") {
    return [
      { slot: "LE", position: "EDGE", label: "DE", start: point(31, 42) },
      { slot: "DT1", position: "DT", label: "DT", start: point(40, 40) },
      { slot: "NT", position: "DT", label: "NT", start: point(50, 39) },
      { slot: "DT2", position: "DT", label: "DT", start: point(60, 40) },
      { slot: "RE", position: "EDGE", label: "DE", start: point(69, 42) },
      { slot: "WILL", position: "LB", label: "W", start: point(38, 27) },
      { slot: "MIKE", position: "LB", label: "M", start: point(50, 25) },
      { slot: "SAM", position: "LB", label: "S", start: point(62, 27) },
      { slot: "LCB", position: "CB", label: "CB", start: point(9, 22) },
      { slot: "RCB", position: "CB", label: "CB", start: point(91, 22) },
      { slot: "FS", position: "S", label: "S", start: point(50, 10) },
    ];
  }
  return [
    { slot: "LE", position: "EDGE", label: "DE", start: point(35, 42) },
    { slot: "DT1", position: "DT", label: "DT", start: point(45, 40) },
    { slot: "DT2", position: "DT", label: "DT", start: point(55, 40) },
    { slot: "RE", position: "EDGE", label: "DE", start: point(65, 42) },
    { slot: "WILL", position: "LB", label: "W", start: point(31, 28) },
    { slot: "MIKE", position: "LB", label: "M", start: point(50, 25) },
    { slot: "SAM", position: "LB", label: "S", start: point(69, 28) },
    { slot: "LCB", position: "CB", label: "CB", start: point(9, 21) },
    { slot: "RCB", position: "CB", label: "CB", start: point(91, 21) },
    { slot: "FS", position: "S", label: "FS", start: point(39, 9) },
    { slot: "SS", position: "S", label: "SS", start: point(61, 10) },
  ];
}

function routeEnd(slot: string, call: MatchPlayCall, start: MatchPoint, random: SeededRandom): MatchPoint {
  const strength = call.strength === "left" ? -1 : call.strength === "right" ? 1 : 0;
  const concept = call.concept;
  if (concept.includes("Vertical")) return point(Math.max(5, Math.min(95, start.x + (start.x < 50 ? -3 : 3))), 10 + random.integer(-2, 4));
  if (concept === "Mesh") return point(slot === "H" ? 67 : slot === "Y" ? 33 : Math.max(7, Math.min(93, start.x + strength * 12)), 35 + random.integer(-3, 3));
  if (concept === "Flood") return point(Math.max(7, Math.min(93, start.x + (start.x < 50 ? 14 : -14))), slot === "Z" ? 17 : slot === "Y" ? 31 : 43);
  if (concept === "Stick" || concept === "Spacing") return point(Math.max(7, Math.min(93, start.x + (start.x < 50 ? 8 : -8))), 39 + random.integer(-3, 3));
  if (concept === "Dagger") return point(slot === "X" ? 50 : Math.max(7, Math.min(93, start.x + strength * 8)), slot === "X" ? 20 : 30);
  if (concept.includes("Screen")) return point(call.strength === "left" ? 28 : call.strength === "right" ? 72 : 50, 43);
  if (concept.includes("Boot")) return point(slot === "Y" ? 50 : Math.max(7, Math.min(93, start.x - strength * 18)), slot === "Y" ? 25 : 37);
  if (concept.includes("Pop")) return point(50, 28);
  if (concept.includes("Glance")) return point(slot === "X" ? 48 : start.x, slot === "X" ? 30 : 39);
  return point(Math.max(6, Math.min(94, start.x + strength * 8)), 31 + random.integer(-5, 5));
}

function offenseAssignment(player: FormationPlayer, call: MatchPlayCall, side: MatchTeamSide, isHero: boolean, random: SeededRandom): MatchPlayerAssignment {
  const direction = call.strength === "left" ? -1 : call.strength === "right" ? 1 : 0;
  let kind: MatchPlayerAssignment["kind"] = "route";
  let task = "Выполнить маршрут по таймингу";
  let end = routeEnd(player.slot, call, player.start, random);

  if (["OT", "OG", "C"].includes(player.position)) {
    const run = call.playType === "run";
    kind = run ? "run-block" : "pass-protection";
    task = run ? `Сместить фронт в ${call.runLane ?? "назначенный гэп"}` : "Сохранить глубину кармана";
    end = point(player.start.x + direction * (run ? 5 : 1), player.start.y - (run ? 9 : 4));
  } else if (player.position === "QB") {
    if (call.playType === "run") {
      kind = "handoff";
      task = call.concept.includes("Read") ? "Прочитать edge и решить mesh" : "Передать мяч и держать backside";
      end = point(player.start.x + direction * 4, player.start.y - 2);
    } else {
      kind = "pass-read";
      task = `Пройти progression: ${call.progression.join(" → ") || "по структуре"}`;
      end = point(player.start.x - direction * 4, Math.min(88, player.start.y + 10));
    }
  } else if (player.slot === call.primarySlot && (call.playType === "run" || player.position === "RB" && call.playType === "screen")) {
    kind = "carry";
    task = call.playType === "screen" ? "Продать protection и выйти за блоками" : `Атаковать ${call.runLane ?? "назначенный гэп"}`;
    end = point(Math.max(8, Math.min(92, player.start.x + direction * 20)), 30);
  } else if (call.playType === "run") {
    kind = "run-block";
    task = player.position === "WR" ? "Закрыть защитника на периметре" : "Вести блок к точке атаки";
    end = point(player.start.x + direction * 10, player.start.y - 12);
  } else if (player.position === "RB" && !call.progression.includes(player.slot)) {
    kind = "pass-protection";
    task = "Проверить blitz и подобрать свободного rusher";
    end = point(player.start.x + direction * 3, player.start.y - 10);
  }

  return {
    id: `${side}-offense-${player.slot}`,
    side,
    unit: "offense",
    slot: player.slot,
    position: player.position,
    label: player.label,
    isHero,
    kind,
    task,
    start: player.start,
    end,
    delayMs: random.integer(20, 180),
  };
}

function coverageMatchup(slot: string): string | undefined {
  return {
    LCB: "X",
    RCB: "Z",
    NB: "H",
    SCB: "Y",
    WILL: "RB",
    MIKE: "Y",
    SAM: "Y",
    FS: "Z",
    SS: "H",
  }[slot];
}

function defenseAssignment(player: FormationPlayer, call: MatchPlayCall, side: MatchTeamSide, isHero: boolean, random: SeededRandom): MatchPlayerAssignment {
  const blitz = call.playType === "blitz";
  const isFront = player.position === "EDGE" || player.position === "DT";
  const isLinebacker = player.position === "LB";
  const man = call.concept.includes("Man") || call.concept.includes("Cover 1") || call.concept.includes("Zero");
  let kind: MatchPlayerAssignment["kind"] = "zone-coverage";
  let task = "Сохранить глубину зоны и читать QB";
  let end = point(player.start.x, Math.max(8, player.start.y - 8));
  let matchupSlot = coverageMatchup(player.slot);

  if (isFront) {
    kind = "rush";
    task = call.tags.includes("run-commit") ? "Разрушить назначенный гэп" : "Сжать карман и удержать rush lane";
    end = point(player.start.x + random.integer(-3, 3), player.start.y + 20);
  } else if (isLinebacker && blitz && (player.slot === "MIKE" || player.slot === "SAM" || player.slot === "JACK")) {
    kind = "rush";
    task = `Атаковать ${call.strength === "middle" ? "A-gap" : `${call.strength} edge`}`;
    end = point(50 + random.integer(-7, 7), 53);
  } else if (isLinebacker && call.tags.includes("heavy-box")) {
    kind = "run-fit";
    task = "Закрыть свой гэп и не потерять cutback";
    end = point(player.start.x + (player.start.x < 50 ? 8 : -8), player.start.y + 15);
  } else if (player.position === "CB" && man) {
    kind = "man-coverage";
    task = `Держать ${matchupSlot ?? "своего ресивера"} с правильным leverage`;
    end = point(player.start.x + (player.start.x < 50 ? -3 : 3), Math.max(9, player.start.y - 14));
  } else if (player.slot === "FS" && call.concept.includes("Robber")) {
    kind = "zone-coverage";
    task = "Читать глаза QB и закрыть внутреннее окно";
    end = point(50, 29);
    matchupSlot = "H";
  } else if (player.slot === "MIKE" && call.concept.includes("Quarters")) {
    kind = "zone-coverage";
    task = "Закрыть hook и не отпустить crosser";
    end = point(50, 31);
  }

  return {
    id: `${side}-defense-${player.slot}`,
    side,
    unit: "defense",
    slot: player.slot,
    position: player.position,
    label: player.label,
    isHero,
    kind,
    task,
    start: player.start,
    end,
    delayMs: random.integer(20, 180),
    matchupSlot,
  };
}

function heroSlotForPosition(position: FootballPosition, players: FormationPlayer[]): string {
  if (position === "QB") return "QB";
  if (position === "RB") return players.some((player) => player.slot === "RB") ? "RB" : players.find((player) => player.position === "RB")?.slot ?? "RB";
  if (position === "WR") return players.find((player) => player.position === "WR")?.slot ?? "X";
  if (position === "LB") return players.some((player) => player.slot === "MIKE") ? "MIKE" : players.find((player) => player.position === "LB")?.slot ?? "MIKE";
  return players.some((player) => player.slot === "LCB") ? "LCB" : players.find((player) => player.position === "CB")?.slot ?? "LCB";
}

export function buildSnapAssignments(
  offenseCall: MatchPlayCall,
  defenseCall: MatchPlayCall,
  offenseSide: MatchTeamSide,
  heroUnit: MatchUnit,
  heroPosition: FootballPosition,
  seed: string,
): MatchPlayerAssignment[] {
  const random = new SeededRandom(seed);
  const defenseSide: MatchTeamSide = offenseSide === "hero" ? "opponent" : "hero";
  const offensePlayers = offenseFormation(offenseCall.formation);
  const defensePlayers = defenseFormation(defenseCall.formation);
  const heroPool = heroUnit === "offense" ? offensePlayers : defensePlayers;
  const heroSlot = heroSlotForPosition(heroPosition, heroPool);
  const offense = offensePlayers.map((player) => offenseAssignment(
    player,
    offenseCall,
    offenseSide,
    heroUnit === "offense" && offenseSide === "hero" && player.slot === heroSlot,
    random,
  ));
  const defense = defensePlayers.map((player) => defenseAssignment(
    player,
    defenseCall,
    defenseSide,
    heroUnit === "defense" && defenseSide === "hero" && player.slot === heroSlot,
    random,
  ));
  return [...defense, ...offense];
}

export function describeHeroAssignment(
  position: FootballPosition,
  heroUnit: MatchUnit,
  assignments: MatchPlayerAssignment[],
  offenseCall: MatchPlayCall,
  defenseCall: MatchPlayCall,
): { involvement: MatchHeroInvolvement; role: string; heroSlot: string } {
  const hero = assignments.find((assignment) => assignment.isHero);
  const heroSlot = hero?.slot ?? position;
  if (!hero) return { involvement: "assignment-only", role: "Выполнить назначение штаба", heroSlot };

  if (heroUnit === "offense") {
    if (position === "QB") return { involvement: "primary", role: hero.task, heroSlot };
    if (heroSlot === offenseCall.primarySlot && (offenseCall.playType === "run" || offenseCall.playType === "screen")) {
      return { involvement: "primary", role: hero.task, heroSlot };
    }
    const progressionIndex = offenseCall.progression.indexOf(heroSlot);
    if (progressionIndex === 0) return { involvement: "primary", role: `${hero.task}. Первое чтение QB`, heroSlot };
    if (progressionIndex > 0) return { involvement: "secondary", role: `${hero.task}. Чтение №${progressionIndex + 1}`, heroSlot };
    return { involvement: "assignment-only", role: hero.task, heroSlot };
  }

  if (hero.kind === "rush" || hero.kind === "run-fit") return { involvement: "primary", role: hero.task, heroSlot };
  const primaryTarget = offenseCall.primarySlot;
  if (hero.matchupSlot && hero.matchupSlot === primaryTarget) return { involvement: "primary", role: hero.task, heroSlot };
  if (hero.kind === "man-coverage" || hero.matchupSlot && offenseCall.progression.includes(hero.matchupSlot)) {
    return { involvement: "secondary", role: hero.task, heroSlot };
  }
  return { involvement: "assignment-only", role: hero.task, heroSlot };
}

export function heroAssignment(position: FootballPosition, play: MatchPlayCall, seed: string): { involvement: MatchHeroInvolvement; role: string } {
  const random = new SeededRandom(seed);
  if (position === "QB") return { involvement: "primary", role: play.playType === "run" ? "Управлять mesh и backside read" : "Пройти progression и управлять карманом" };
  if (position === "RB") {
    if (play.playType === "run" || play.primarySlot === "RB") return { involvement: "primary", role: play.playType === "run" ? `Атаковать ${play.runLane ?? "назначенный гэп"}` : "Выйти за блоками" };
    return random.chance(.35) ? { involvement: "secondary", role: "Проверить blitz и выйти в checkdown" } : { involvement: "assignment-only", role: "Pass protection" };
  }
  if (position === "WR") {
    if (play.playType === "run") return { involvement: "assignment-only", role: "Закрыть периметр" };
    return play.progression[0] === "X" ? { involvement: "primary", role: "Первое чтение progression" } : play.progression.includes("X") ? { involvement: "secondary", role: "Второе или третье чтение" } : { involvement: "assignment-only", role: "Clear-out и работа без мяча" };
  }
  if (position === "LB") return play.playType === "blitz" ? { involvement: "primary", role: "Выполнить pressure assignment" } : { involvement: "secondary", role: "Закрыть run fit или hook zone" };
  return { involvement: "secondary", role: "Сохранить leverage в coverage" };
}
