import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition } from "../career/types";
import type {
  MatchHeroInvolvement,
  MatchPlayCall,
  MatchPlayerAssignment,
  MatchPoint,
  MatchTeamSide,
  MatchUnit,
  MatchTacticalCall,
  MatchTacticalProfile,
  MatchUsageRole,
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


export interface PlayCallStrategy {
  profile?: MatchTacticalProfile | undefined;
  recentOffense?: readonly MatchTacticalCall[] | undefined;
  featuredRole?: MatchUsageRole | undefined;
  featuredPriority?: number | undefined;
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

function offenseWeight(play: PlayDescriptor, context: PlayCallContext, strategy?: PlayCallStrategy): number {
  const { down, distance, fieldPosition, scoreMargin, quarter, clockSeconds } = context;
  const passLike = play.playType === "pass" || play.playType === "play-action" || play.playType === "screen";
  let weight = passLike ? 0.72 : 1.35;
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
  const profile = strategy?.profile;
  const featuredRole = strategy?.featuredRole;
  const featuredStrength = Math.max(0, Math.min(1, (strategy?.featuredPriority ?? 0) / 100));
  if (featuredRole === "deep-threat" && (play.tags.includes("shot") || play.tags.includes("deep") || play.tags.includes("long-yardage"))) weight *= 1 + featuredStrength * .85;
  if (featuredRole === "slot-option" && (play.tags.includes("quick") || play.tags.includes("man-beater") || play.tags.includes("third-down"))) weight *= 1 + featuredStrength * .58;
  if (featuredRole === "possession-target" && (play.tags.includes("medium") || play.tags.includes("third-down") || play.tags.includes("safe"))) weight *= 1 + featuredStrength * .5;
  if (featuredRole === "red-zone-target" && fieldPosition >= 76 && (play.tags.includes("goal-line") || play.playType === "play-action")) weight *= 1 + featuredStrength * .75;
  if (featuredRole === "receiving-back" && (play.playType === "screen" || play.tags.includes("pressure-answer"))) weight *= 1 + featuredStrength * .7;
  if (featuredRole === "lead-runner" && play.playType === "run") weight *= 1 + featuredStrength * .7;
  if (profile) {
    if (play.playType === "run") weight *= Math.max(.35, profile.runRate / 48);
    else weight *= Math.max(.45, (100 - profile.runRate) / 52);
    if (play.playType === "play-action") weight *= Math.max(.45, profile.playActionRate / 18);
    if (play.playType === "screen") weight *= Math.max(.45, profile.screenRate / 12);
    if (play.tags.includes("shot") || play.tags.includes("deep")) weight *= Math.max(.45, profile.deepShotRate / 20);
    if (profile.offenseSystem === "air-raid") weight *= play.formation === "Empty" || play.formation.startsWith("Gun") ? 1.42 : .78;
    if (profile.offenseSystem === "west-coast") weight *= play.tags.includes("quick") || play.playType === "screen" ? 1.42 : 1;
    if (profile.offenseSystem === "power-run") weight *= play.formation === "Singleback Ace" || play.formation === "Goal Line" || play.tags.includes("gap") ? 1.52 : .72;
    if (profile.offenseSystem === "spread-option") weight *= play.tags.includes("option") || play.tags.includes("rpo") || play.formation === "Pistol Strong" ? 1.58 : .82;
  }
  const recent = strategy?.recentOffense ?? [];
  const sameConcept = recent.slice(-4).filter((item) => item.concept === play.concept).length;
  if (sameConcept > 0) weight *= Math.max(.28, 1 - sameConcept * .24);
  const recentSuccess = recent.slice(-6).filter((item) => item.concept === play.concept && item.success).length;
  if (recentSuccess > 0 && (profile?.adaptation ?? 50) >= 65) weight *= 1 + Math.min(.28, recentSuccess * .09);
  return weight;
}

function defenseWeight(play: PlayDescriptor, context: PlayCallContext, strategy?: PlayCallStrategy): number {
  let weight = play.playType === "blitz" ? 0.65 : 1.25;
  const { down, distance, fieldPosition, scoreMargin, quarter, clockSeconds } = context;
  if (distance >= 8) weight *= play.tags.includes("long-yardage") || play.tags.includes("two-high") ? 2.7 : 0.45;
  if (distance <= 3) weight *= play.tags.includes("short-yardage") || play.tags.includes("heavy-box") ? 3 : 0.48;
  if (down === 3 && play.tags.includes("third-down")) weight *= 2.2;
  if (fieldPosition >= 90) weight *= play.tags.includes("goal-line") ? 4.4 : 0.32;
  if (quarter === 4 && clockSeconds < 150 && scoreMargin > 0) weight *= play.tags.includes("two-high") ? 2.2 : 0.55;
  if (quarter === 4 && clockSeconds < 150 && scoreMargin < 0) weight *= play.playType === "blitz" ? 1.8 : 0.75;
  const profile = strategy?.profile;
  if (profile) {
    if (play.playType === "blitz") weight *= Math.max(.35, profile.blitzRate / 34);
    if (play.tags.includes("man")) weight *= Math.max(.45, profile.manCoverageRate / 42);
    if (play.tags.includes("two-high") || play.tags.includes("zone")) weight *= Math.max(.55, (100 - profile.manCoverageRate) / 58);
    if (profile.defenseSystem === "quarters-425") weight *= play.formation === "Nickel 4–2–5" || play.tags.includes("two-high") ? 1.48 : .84;
    if (profile.defenseSystem === "multiple-34") weight *= play.formation === "3–4 Odd" || play.tags.includes("pressure") ? 1.46 : .86;
    if (profile.defenseSystem === "over-43") weight *= play.formation.startsWith("4–3") ? 1.5 : .86;
    if (profile.defenseSystem === "nickel-match") weight *= play.formation === "Nickel 4–2–5" || play.formation === "Dime" ? 1.46 : .84;
    if (profile.defenseSystem === "man-pressure") weight *= play.tags.includes("man") || play.playType === "blitz" ? 1.55 : .78;
  }
  const recent = strategy?.recentOffense ?? [];
  if (recent.length > 0 && (profile?.adaptation ?? 50) >= 45) {
    const sample = recent.slice(-8);
    const runRate = sample.filter((item) => item.playType === "run").length / sample.length;
    const deepRate = sample.filter((item) => item.tags.includes("shot") || item.tags.includes("deep")).length / sample.length;
    const quickRate = sample.filter((item) => item.tags.includes("quick") || item.playType === "screen").length / sample.length;
    const strength = .55 + (profile?.adaptation ?? 50) / 100;
    if (runRate >= .58 && (play.tags.includes("heavy-box") || play.tags.includes("run-support") || play.tags.includes("run-fit"))) weight *= 1 + .42 * strength;
    if (deepRate >= .28 && play.tags.includes("two-high")) weight *= 1 + .38 * strength;
    if (quickRate >= .45 && (play.tags.includes("quick-game") || play.tags.includes("trap"))) weight *= 1 + .34 * strength;
  }
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
  strategy?: PlayCallStrategy,
): MatchPlayCall {
  const random = new SeededRandom(seed);
  const context: PlayCallContext = { down, distance, fieldPosition, scoreMargin, quarter, clockSeconds, canCheck };
  const catalog = unit === "offense" ? offenseCalls : defenseCalls;
  const selected = weightedPick(random, catalog, (play) => unit === "offense" ? offenseWeight(play, context, strategy) : defenseWeight(play, context, strategy));
  return {
    id: selected.id,
    formation: selected.formation,
    personnel: selected.personnel,
    concept: selected.concept,
    playType: selected.playType,
    strength: selected.strength,
    calledBy: unit === "offense" ? "offensive-coordinator" : "defensive-coordinator",
    canCheck,
    aggression: Math.max(0, Math.min(100, Math.round(selected.aggression + ((strategy?.profile?.adaptation ?? 50) - 50) * .05))),
    primarySlot: selected.primarySlot,
    progression: [...(selected.progression ?? [])],
    runLane: selected.runLane,
    tags: [...selected.tags],
  };
}

function point(x: number, y: number): MatchPoint {
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

const PLAY_LOS_Y = 60;

function offenseY(yardsBehindLine: number): number {
  return PLAY_LOS_Y + yardsBehindLine;
}

function defenseY(yardsBeyondLine: number): number {
  return PLAY_LOS_Y - yardsBeyondLine;
}

function offenseFormation(formation: string): FormationPlayer[] {
  const line: FormationPlayer[] = [
    { slot: "LT", position: "OT", label: "LT", start: point(36, offenseY(0.25)) },
    { slot: "LG", position: "OG", label: "LG", start: point(43, offenseY(0.12)) },
    { slot: "C", position: "C", label: "C", start: point(50, offenseY(0)) },
    { slot: "RG", position: "OG", label: "RG", start: point(57, offenseY(0.12)) },
    { slot: "RT", position: "OT", label: "RT", start: point(64, offenseY(0.25)) },
  ];
  const skill: Record<string, FormationPlayer[]> = {
    "Gun Trips": [
      { slot: "X", position: "WR", label: "X", start: point(10, offenseY(0)) },
      { slot: "Y", position: "TE", label: "Y", start: point(69, offenseY(0.45)) },
      { slot: "H", position: "WR", label: "H", start: point(78, offenseY(1.2)) },
      { slot: "Z", position: "WR", label: "Z", start: point(91, offenseY(0)) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, offenseY(5)) },
      { slot: "RB", position: "RB", label: "RB", start: point(42, offenseY(6.5)) },
    ],
    "Gun Doubles": [
      { slot: "X", position: "WR", label: "X", start: point(9, offenseY(0)) },
      { slot: "H", position: "WR", label: "H", start: point(24, offenseY(1.1)) },
      { slot: "Y", position: "TE", label: "Y", start: point(76, offenseY(1.1)) },
      { slot: "Z", position: "WR", label: "Z", start: point(91, offenseY(0)) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, offenseY(5)) },
      { slot: "RB", position: "RB", label: "RB", start: point(58, offenseY(6.5)) },
    ],
    "Singleback Ace": [
      { slot: "X", position: "WR", label: "X", start: point(10, offenseY(0)) },
      { slot: "Y", position: "TE", label: "Y", start: point(69, offenseY(0.35)) },
      { slot: "U", position: "TE", label: "U", start: point(31, offenseY(0.35)) },
      { slot: "Z", position: "WR", label: "Z", start: point(90, offenseY(0)) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, offenseY(0.9)) },
      { slot: "RB", position: "RB", label: "RB", start: point(50, offenseY(7)) },
    ],
    "Pistol Strong": [
      { slot: "X", position: "WR", label: "X", start: point(9, offenseY(0)) },
      { slot: "Z", position: "WR", label: "Z", start: point(91, offenseY(0)) },
      { slot: "Y", position: "TE", label: "Y", start: point(71, offenseY(0.4)) },
      { slot: "FB", position: "RB", label: "FB", start: point(40, offenseY(5.5)) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, offenseY(4)) },
      { slot: "RB", position: "RB", label: "RB", start: point(50, offenseY(7.2)) },
    ],
    Empty: [
      { slot: "X", position: "WR", label: "X", start: point(7, offenseY(0)) },
      { slot: "H", position: "WR", label: "H", start: point(22, offenseY(1.2)) },
      { slot: "F", position: "RB", label: "F", start: point(34, offenseY(1.2)) },
      { slot: "Y", position: "WR", label: "Y", start: point(78, offenseY(1.2)) },
      { slot: "Z", position: "WR", label: "Z", start: point(93, offenseY(0)) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, offenseY(5)) },
    ],
    "Goal Line": [
      { slot: "Y", position: "TE", label: "Y", start: point(69, offenseY(0.3)) },
      { slot: "U", position: "TE", label: "U", start: point(31, offenseY(0.3)) },
      { slot: "W", position: "TE", label: "W", start: point(76, offenseY(0.7)) },
      { slot: "FB", position: "RB", label: "FB", start: point(44, offenseY(3.2)) },
      { slot: "QB", position: "QB", label: "QB", start: point(50, offenseY(0.8)) },
      { slot: "RB", position: "RB", label: "RB", start: point(50, offenseY(5.3)) },
    ],
  };
  return [...line, ...(skill[formation] ?? skill["Gun Doubles"]!)];
}

function defenseFormation(formation: string): FormationPlayer[] {
  if (formation === "3–4 Odd") {
    return [
      { slot: "LE", position: "EDGE", label: "DE", start: point(39, defenseY(0.8)) },
      { slot: "NT", position: "DT", label: "NT", start: point(50, defenseY(0.65)) },
      { slot: "RE", position: "EDGE", label: "DE", start: point(61, defenseY(0.8)) },
      { slot: "WILL", position: "LB", label: "W", start: point(28, defenseY(4.3)) },
      { slot: "MIKE", position: "LB", label: "M", start: point(44, defenseY(5.1)) },
      { slot: "SAM", position: "LB", label: "S", start: point(56, defenseY(5.1)) },
      { slot: "JACK", position: "LB", label: "J", start: point(72, defenseY(4.3)) },
      { slot: "LCB", position: "CB", label: "CB", start: point(9, defenseY(2.2)) },
      { slot: "RCB", position: "CB", label: "CB", start: point(91, defenseY(2.2)) },
      { slot: "FS", position: "S", label: "FS", start: point(39, defenseY(13.5)) },
      { slot: "SS", position: "S", label: "SS", start: point(61, defenseY(12.5)) },
    ];
  }
  if (formation === "Nickel 4–2–5") {
    return [
      { slot: "LE", position: "EDGE", label: "DE", start: point(35, defenseY(0.85)) },
      { slot: "DT1", position: "DT", label: "DT", start: point(45, defenseY(0.65)) },
      { slot: "DT2", position: "DT", label: "DT", start: point(55, defenseY(0.65)) },
      { slot: "RE", position: "EDGE", label: "DE", start: point(65, defenseY(0.85)) },
      { slot: "WILL", position: "LB", label: "W", start: point(42, defenseY(5.1)) },
      { slot: "MIKE", position: "LB", label: "M", start: point(58, defenseY(5.1)) },
      { slot: "LCB", position: "CB", label: "CB", start: point(8, defenseY(2)) },
      { slot: "NB", position: "CB", label: "NB", start: point(28, defenseY(4.2)) },
      { slot: "RCB", position: "CB", label: "CB", start: point(92, defenseY(2)) },
      { slot: "FS", position: "S", label: "FS", start: point(41, defenseY(13.8)) },
      { slot: "SS", position: "S", label: "SS", start: point(63, defenseY(12.8)) },
    ];
  }
  if (formation === "Dime") {
    return [
      { slot: "LE", position: "EDGE", label: "DE", start: point(35, defenseY(0.9)) },
      { slot: "DT1", position: "DT", label: "DT", start: point(45, defenseY(0.65)) },
      { slot: "DT2", position: "DT", label: "DT", start: point(55, defenseY(0.65)) },
      { slot: "RE", position: "EDGE", label: "DE", start: point(65, defenseY(0.9)) },
      { slot: "MIKE", position: "LB", label: "M", start: point(50, defenseY(5.5)) },
      { slot: "LCB", position: "CB", label: "CB", start: point(7, defenseY(3.2)) },
      { slot: "SCB", position: "CB", label: "DB", start: point(27, defenseY(4.4)) },
      { slot: "NB", position: "CB", label: "NB", start: point(73, defenseY(4.4)) },
      { slot: "RCB", position: "CB", label: "CB", start: point(93, defenseY(3.2)) },
      { slot: "FS", position: "S", label: "FS", start: point(39, defenseY(14.2)) },
      { slot: "SS", position: "S", label: "SS", start: point(61, defenseY(14.2)) },
    ];
  }
  if (formation === "Bear Front" || formation === "Goal Line") {
    return [
      { slot: "LE", position: "EDGE", label: "DE", start: point(31, defenseY(0.7)) },
      { slot: "DT1", position: "DT", label: "DT", start: point(40, defenseY(0.55)) },
      { slot: "NT", position: "DT", label: "NT", start: point(50, defenseY(0.5)) },
      { slot: "DT2", position: "DT", label: "DT", start: point(60, defenseY(0.55)) },
      { slot: "RE", position: "EDGE", label: "DE", start: point(69, defenseY(0.7)) },
      { slot: "WILL", position: "LB", label: "W", start: point(38, defenseY(3.7)) },
      { slot: "MIKE", position: "LB", label: "M", start: point(50, defenseY(3.5)) },
      { slot: "SAM", position: "LB", label: "S", start: point(62, defenseY(3.7)) },
      { slot: "LCB", position: "CB", label: "CB", start: point(9, defenseY(1.6)) },
      { slot: "RCB", position: "CB", label: "CB", start: point(91, defenseY(1.6)) },
      { slot: "FS", position: "S", label: "S", start: point(50, defenseY(9.5)) },
    ];
  }
  return [
    { slot: "LE", position: "EDGE", label: "DE", start: point(35, defenseY(0.85)) },
    { slot: "DT1", position: "DT", label: "DT", start: point(45, defenseY(0.65)) },
    { slot: "DT2", position: "DT", label: "DT", start: point(55, defenseY(0.65)) },
    { slot: "RE", position: "EDGE", label: "DE", start: point(65, defenseY(0.85)) },
    { slot: "WILL", position: "LB", label: "W", start: point(31, defenseY(5.2)) },
    { slot: "MIKE", position: "LB", label: "M", start: point(50, defenseY(5.5)) },
    { slot: "SAM", position: "LB", label: "S", start: point(69, defenseY(5.2)) },
    { slot: "LCB", position: "CB", label: "CB", start: point(9, defenseY(2.2)) },
    { slot: "RCB", position: "CB", label: "CB", start: point(91, defenseY(2.2)) },
    { slot: "FS", position: "S", label: "FS", start: point(39, defenseY(13.5)) },
    { slot: "SS", position: "S", label: "SS", start: point(61, defenseY(12.5)) },
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
    end = point(player.start.x + direction * (run ? 4 : 1), player.start.y + (run ? -3 : 2.5));
  } else if (player.position === "QB") {
    if (call.playType === "run") {
      kind = "handoff";
      task = call.concept.includes("Read") ? "Прочитать edge и решить mesh" : "Передать мяч и держать backside";
      end = point(player.start.x + direction * 4, player.start.y - 2);
    } else {
      kind = "pass-read";
      task = `Пройти progression: ${call.progression.join(" → ") || "по структуре"}`;
      end = point(player.start.x - direction * 3, player.start.y + 2.5);
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
    end = point(player.start.x + random.integer(-3, 3), offenseY(5));
  } else if (isLinebacker && blitz && (player.slot === "MIKE" || player.slot === "SAM" || player.slot === "JACK")) {
    kind = "rush";
    task = `Атаковать ${call.strength === "middle" ? "A-gap" : `${call.strength} edge`}`;
    end = point(50 + random.integer(-7, 7), offenseY(5));
  } else if (isLinebacker && call.tags.includes("heavy-box")) {
    kind = "run-fit";
    task = "Закрыть свой гэп и не потерять cutback";
    end = point(player.start.x + (player.start.x < 50 ? 5 : -5), defenseY(1));
  } else if (player.position === "CB" && man) {
    kind = "man-coverage";
    task = `Держать ${matchupSlot ?? "своего ресивера"} с правильным leverage`;
    end = point(player.start.x + (player.start.x < 50 ? -3 : 3), Math.max(9, player.start.y - 14));
  } else if (player.slot === "FS" && call.concept.includes("Robber")) {
    kind = "zone-coverage";
    task = "Читать глаза QB и закрыть внутреннее окно";
    end = point(50, defenseY(7));
    matchupSlot = "H";
  } else if (player.slot === "MIKE" && call.concept.includes("Quarters")) {
    kind = "zone-coverage";
    task = "Закрыть hook и не отпустить crosser";
    end = point(50, defenseY(8));
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

function ensureHeroPosition(players: FormationPlayer[], position: FootballPosition): FormationPlayer[] {
  if (players.some((player) => player.position === position)) return players;
  const fallbackSlots: Partial<Record<FootballPosition, readonly string[]>> = {
    TE: ["Y", "U", "H"],
    WR: ["X", "Z", "H", "Y"],
    RB: ["RB", "F", "FB"],
    OT: ["LT", "RT"],
    OG: ["LG", "RG"],
    C: ["C"],
    EDGE: ["LE", "RE", "JACK"],
    DT: ["DT1", "DT2", "NT"],
    LB: ["MIKE", "WILL", "SAM", "JACK"],
    CB: ["LCB", "RCB", "NB", "SCB"],
    S: ["FS", "SS"],
  };
  const slots = fallbackSlots[position] ?? [];
  const index = players.findIndex((player) => slots.includes(player.slot));
  if (index < 0) return players;
  return players.map((player, playerIndex) => playerIndex === index
    ? { ...player, position, label: position }
    : player);
}

function heroSlotForPosition(position: FootballPosition, players: FormationPlayer[]): string {
  const preferred: Partial<Record<FootballPosition, readonly string[]>> = {
    QB: ["QB"], RB: ["RB", "FB", "F"], WR: ["X", "Z", "H", "Y"], TE: ["Y", "U", "W"],
    OT: ["LT", "RT"], OG: ["LG", "RG"], C: ["C"], EDGE: ["LE", "RE", "JACK"],
    DT: ["DT1", "DT2", "NT"], LB: ["MIKE", "WILL", "SAM"], CB: ["LCB", "RCB", "NB", "SCB"], S: ["FS", "SS"],
  };
  for (const slot of preferred[position] ?? []) {
    if (players.some((player) => player.slot === slot && player.position === position)) return slot;
  }
  return players.find((player) => player.position === position)?.slot ?? position;
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
  const offensePlayers = heroUnit === "offense"
    ? ensureHeroPosition(offenseFormation(offenseCall.formation), heroPosition)
    : offenseFormation(offenseCall.formation);
  const defensePlayers = heroUnit === "defense"
    ? ensureHeroPosition(defenseFormation(defenseCall.formation), heroPosition)
    : defenseFormation(defenseCall.formation);
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
  if (position === "WR" || position === "TE") {
    if (play.playType === "run") return { involvement: "assignment-only", role: position === "TE" ? "Закрыть край формации" : "Закрыть периметр" };
    return { involvement: play.primarySlot === "Y" && position === "TE" || play.primarySlot === "X" && position === "WR" ? "primary" : "secondary", role: "Выполнить маршрут и сохранить тайминг" };
  }
  if (position === "OT" || position === "OG" || position === "C") return { involvement: "assignment-only", role: play.playType === "run" ? "Выиграть точку атаки" : "Сохранить карман" };
  if (position === "EDGE" || position === "DT") return { involvement: "primary", role: play.playType === "blitz" ? "Атаковать карман" : "Контролировать гэп и rush lane" };
  if (position === "LB") return play.playType === "blitz" ? { involvement: "primary", role: "Выполнить pressure assignment" } : { involvement: "secondary", role: "Закрыть run fit или hook zone" };
  if (position === "CB" || position === "S") return { involvement: "secondary", role: "Сохранить leverage и не отдать взрывной розыгрыш" };
  if (position === "K") return { involvement: "primary", role: "Выполнить удар по вызову штаба" };
  return { involvement: "primary", role: "Поставить пант в назначенную зону" };
}

export function buildSpecialTeamsAssignments(
  position: "K" | "P",
  heroSide: MatchTeamSide,
  seed: string,
): MatchPlayerAssignment[] {
  const random = new SeededRandom(seed);
  const opponentSide = heroSide === "hero" ? "opponent" : "hero";
  const kicking: FormationPlayer[] = position === "K"
    ? [
        { slot: "K", position: "K", label: "K", start: point(50, offenseY(12.5)) },
        { slot: "H", position: "P", label: "H", start: point(50, offenseY(7)) },
        { slot: "LS", position: "C", label: "LS", start: point(50, offenseY(0)) },
        { slot: "LT", position: "OT", label: "T", start: point(32, offenseY(0.15)) }, { slot: "LG", position: "OG", label: "G", start: point(41, offenseY(0.1)) },
        { slot: "RG", position: "OG", label: "G", start: point(59, offenseY(0.1)) }, { slot: "RT", position: "OT", label: "T", start: point(68, offenseY(0.15)) },
        { slot: "LW", position: "TE", label: "W", start: point(23, offenseY(0.2)) }, { slot: "RW", position: "TE", label: "W", start: point(77, offenseY(0.2)) },
        { slot: "LUP", position: "RB", label: "U", start: point(14, offenseY(1.2)) }, { slot: "RUP", position: "RB", label: "U", start: point(86, offenseY(1.2)) },
      ]
    : [
        { slot: "P", position: "P", label: "P", start: point(50, offenseY(14)) },
        { slot: "LS", position: "C", label: "LS", start: point(50, offenseY(0)) },
        { slot: "LT", position: "OT", label: "T", start: point(31, offenseY(0.2)) }, { slot: "LG", position: "OG", label: "G", start: point(40, offenseY(0.1)) },
        { slot: "RG", position: "OG", label: "G", start: point(60, offenseY(0.1)) }, { slot: "RT", position: "OT", label: "T", start: point(69, offenseY(0.2)) },
        { slot: "LW", position: "TE", label: "W", start: point(23, offenseY(0.7)) }, { slot: "RW", position: "TE", label: "W", start: point(77, offenseY(0.7)) },
        { slot: "LGUN", position: "WR", label: "G", start: point(8, offenseY(0)) }, { slot: "RGUN", position: "WR", label: "G", start: point(92, offenseY(0)) },
        { slot: "PP", position: "RB", label: "PP", start: point(50, offenseY(7)) },
      ];
  const returning: FormationPlayer[] = [
    { slot: "R", position: "CB", label: "R", start: point(50, defenseY(35)) },
    { slot: "LJ", position: "CB", label: "J", start: point(8, defenseY(2)) }, { slot: "RJ", position: "CB", label: "J", start: point(92, defenseY(2)) },
    { slot: "LE", position: "EDGE", label: "E", start: point(28, defenseY(0.8)) }, { slot: "RE", position: "EDGE", label: "E", start: point(72, defenseY(0.8)) },
    { slot: "DT1", position: "DT", label: "D", start: point(42, defenseY(0.6)) }, { slot: "DT2", position: "DT", label: "D", start: point(58, defenseY(0.6)) },
    { slot: "WILL", position: "LB", label: "W", start: point(34, defenseY(4.5)) }, { slot: "MIKE", position: "LB", label: "M", start: point(50, defenseY(5)) },
    { slot: "SAM", position: "LB", label: "S", start: point(66, defenseY(4.5)) }, { slot: "FS", position: "S", label: "S", start: point(50, defenseY(13)) },
  ];
  const kickAssignments: MatchPlayerAssignment[] = kicking.map((player) => {
    const isHero = player.position === position && player.slot === position;
    const kind: MatchPlayerAssignment["kind"] = isHero ? (position === "K" ? "kick" : "punt") : player.slot === "LS" ? "long-snap" : position === "P" && player.slot.includes("GUN") ? "return-coverage" : "kick-protection";
    return { id: `${heroSide}-special-${player.slot}`, side: heroSide, unit: "special" as const, slot: player.slot, position: player.position, label: player.label, isHero, kind, task: isHero ? (position === "K" ? "Провести удар между стойками" : "Поставить пант в вызванную зону") : kind === "long-snap" ? "Дать точный длинный снэп" : kind === "return-coverage" ? "Закрыть return lane" : "Защитить точку удара", start: player.start, end: isHero ? point(50, 22) : point(player.start.x, player.start.y - 10), delayMs: random.integer(20, 180) };
  });
  const returnAssignments: MatchPlayerAssignment[] = returning.map((player) => ({ id: `${opponentSide}-return-${player.slot}`, side: opponentSide, unit: "special" as const, slot: player.slot, position: player.position, label: player.label, isHero: false, kind: player.slot === "R" ? "return" as const : "return-coverage" as const, task: player.slot === "R" ? "Принять мяч и выбрать return lane" : position === "K" ? "Атаковать точку удара" : "Закрыть coverage lane", start: player.start, end: player.slot === "R" ? point(50, 35) : point(player.start.x, player.start.y + 12), delayMs: random.integer(20, 180) }));
  return [...returnAssignments, ...kickAssignments];
}
