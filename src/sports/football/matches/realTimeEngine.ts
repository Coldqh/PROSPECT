import type { FootballPosition } from "../career/types";
import type {
  MatchAdvancedStatLine,
  MatchEpisode,
  MatchLiveEvaluationSignals,
  MatchPoint,
  MatchSnapResult,
  MatchStatLine,
  MatchTeamSide,
} from "./types";

export type LivePlayPhase = "pre-snap" | "live" | "ball-flight" | "whistle";

export type LivePlayCommand =
  | { type: "snap" }
  | { type: "throw"; targetId: string }
  | { type: "run" }
  | { type: "throw-away" }
  | { type: "burst" }
  | { type: "cut" }
  | { type: "secure" }
  | { type: "power" }
  | { type: "speed" }
  | { type: "anchor" }
  | { type: "break" }
  | { type: "tackle" }
  | { type: "intercept" }
  | { type: "kick" };

export interface LiveControlInput {
  moveX: number;
  moveY: number;
}

export interface LivePlayerState {
  id: string;
  assignmentId: string;
  slot: string;
  position: string;
  label: string;
  side: MatchTeamSide;
  unit: "offense" | "defense" | "special";
  isHero: boolean;
  kind: string;
  task: string;
  matchupSlot?: string;
  overall: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  startX: number;
  startY: number;
  route: MatchPoint[];
  routeIndex: number;
  hasBall: boolean;
  down: boolean;
  blockedUntil: number;
  engagementUntil: number;
  blockEngagements: number;
  rushWon: boolean;
  autoCutDirection: -1 | 0 | 1;
  autoCutUntil: number;
  tackleCooldownUntil: number;
  ballReactionDelay: number;
  actionBoostUntil: number;
  actionMode?: "burst" | "cut" | "secure" | "power" | "speed" | "anchor" | "break" | "tackle" | "intercept";
}

export interface LiveBallState {
  x: number;
  y: number;
  z: number;
  state: "dead" | "snap" | "carried" | "flight";
  carrierId?: string;
  targetId?: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  flightElapsed: number;
  flightDuration: number;
  throwQuality: number;
  throwStartedAt: number;
}

export interface LivePlayEvent {
  id: string;
  type: "snap" | "handoff" | "pressure" | "throw" | "catch" | "drop" | "breakup" | "interception" | "missed-tackle" | "tackle" | "sack" | "touchdown" | "out-of-bounds" | "whistle";
  time: number;
  x: number;
  y: number;
  text: string;
  playerId?: string;
  targetId?: string;
}

export interface MatchLivePlayOutcome {
  version: 1;
  actionId: string;
  snapResult: MatchSnapResult;
  yards: number;
  points: number;
  scoringSide?: MatchTeamSide;
  turnover: boolean;
  targetSlot?: string;
  ballCarrierSlot?: string;
  teamExecutionScore: number;
  assignmentScore: number;
  pressureOccurred: boolean;
  elapsedSeconds: number;
  description: string;
  heroInvolved: boolean;
  statDelta: MatchStatLine;
  advancedDelta: MatchAdvancedStatLine;
  grossPuntYards?: number;
  puntReturnYards?: number;
  kickDistance?: number;
  events: LivePlayEvent[];
  startFieldPosition?: number;
  endFieldPosition?: number;
  firstDown?: boolean;
  evaluationSignals?: MatchLiveEvaluationSignals;
}

export interface LivePlayEngineState {
  version: 1;
  seed: number;
  randomState: number;
  phase: LivePlayPhase;
  elapsed: number;
  episode: MatchEpisode;
  heroPosition: FootballPosition;
  players: LivePlayerState[];
  ball: LiveBallState;
  lineOfScrimmage: number;
  firstDownY: number;
  offenseSide: MatchTeamSide;
  quarterbackId?: string;
  intendedRunnerId?: string;
  pressureOccurred: boolean;
  runCommitted: boolean;
  passCompleted: boolean;
  passAttempted: boolean;
  passTargetId?: string;
  turnoverCommitted: boolean;
  heroActionScore: number;
  heroTouchedPlay: boolean;
  heroRouteDeviationTotal: number;
  heroRouteSamples: number;
  heroSeparationTotal: number;
  heroSeparationSamples: number;
  heroCoverageTotal: number;
  heroCoverageSamples: number;
  qbDecisionQuality: number;
  qbTimeToThrow: number;
  qbEscapeDirection: -1 | 0 | 1;
  qbEscapeTarget?: MatchPoint;
  heroOpenWindowSeen: boolean;
  heroOpenWindowTargeted: boolean;
  heroBestSeparation: number;
  events: LivePlayEvent[];
  outcome?: MatchLivePlayOutcome;
}

const LIVE_PREFIX = "live-play:";
const FIELD_MIN_X = 2.5;
const FIELD_MAX_X = 97.5;
const WORLD_MIN_Y = -50;
const WORLD_MAX_Y = 165;
const YARDS_TO_FIELD = 1;
const DEFAULT_VIEW_YARDS = 36;
const LIVE_TIME_SCALE = 0.78;

export interface LiveFieldViewport {
  lowFieldYard: number;
  highFieldYard: number;
  focusFieldYard: number;
  spanYards: number;
}

export function liveWorldToFieldYard(state: LivePlayEngineState, worldY: number): number {
  return clamp(state.episode.fieldPosition + (state.lineOfScrimmage - worldY) / YARDS_TO_FIELD, 0, 100);
}

export function liveFieldYardToWorldY(state: LivePlayEngineState, fieldYard: number): number {
  return state.lineOfScrimmage - (fieldYard - state.episode.fieldPosition) * YARDS_TO_FIELD;
}

export function liveFieldViewport(state: LivePlayEngineState, spanYards = DEFAULT_VIEW_YARDS): LiveFieldViewport {
  const carrier = currentCarrier(state);
  // До снэпа камера всегда держит линию розыгрыша, карман и secondary.
  // Иначе карьера за safety/CB центрировала экран на герое и прятала всю атаку.
  const focusWorldY = state.phase === "pre-snap"
    ? state.lineOfScrimmage
    : state.ball.state === "flight"
      ? state.ball.y
      : carrier?.y ?? state.ball.y ?? state.lineOfScrimmage;
  const ballFieldYard = liveWorldToFieldYard(state, focusWorldY);
  const forwardBias = state.phase === "pre-snap" ? 3 : state.turnoverCommitted ? -4 : 4;
  const focusFieldYard = clamp(ballFieldYard + forwardBias, spanYards / 2, 100 - spanYards / 2);
  return {
    lowFieldYard: focusFieldYard - spanYards / 2,
    highFieldYard: focusFieldYard + spanYards / 2,
    focusFieldYard,
    spanYards,
  };
}

function offenseGoalWorldY(state: LivePlayEngineState): number {
  return liveFieldYardToWorldY(state, 100);
}

function defenseGoalWorldY(state: LivePlayEngineState): number {
  return liveFieldYardToWorldY(state, 0);
}

function oppositeSide(side: MatchTeamSide): MatchTeamSide {
  return side === "hero" ? "opponent" : "hero";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(left: Pick<LivePlayerState, "x" | "y"> | MatchPoint, right: Pick<LivePlayerState, "x" | "y"> | MatchPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function distanceToSegment(pointValue: MatchPoint, start: MatchPoint, end: MatchPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.0001) return distance(pointValue, start);
  const projection = clamp(((pointValue.x - start.x) * dx + (pointValue.y - start.y) * dy) / lengthSquared, 0, 1);
  return distance(pointValue, { x: start.x + dx * projection, y: start.y + dy * projection });
}

function normalize(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  return length < 0.0001 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random(state: LivePlayEngineState): number {
  let value = state.randomState || 0x9e3779b9;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.randomState = value >>> 0;
  return state.randomState / 4294967296;
}

function event(
  state: LivePlayEngineState,
  type: LivePlayEvent["type"],
  text: string,
  x: number,
  y: number,
  playerId?: string,
  targetId?: string,
): void {
  const entry: LivePlayEvent = {
    id: `${state.episode.id}-${state.events.length}-${type}`,
    type,
    time: Math.round(state.elapsed * 100) / 100,
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
    text,
  };
  if (playerId) entry.playerId = playerId;
  if (targetId) entry.targetId = targetId;
  state.events.push(entry);
}

function offenseCallForEpisode(episode: MatchEpisode): MatchEpisode["playCall"] {
  const offensiveTypes = new Set(["run", "pass", "play-action", "screen", "field-goal", "punt"]);
  return offensiveTypes.has(episode.playCall.playType) ? episode.playCall : episode.opponentCall;
}

function routeFor(kind: string, start: MatchPoint, end: MatchPoint, slot: string, call: MatchEpisode["playCall"]): MatchPoint[] {
  const horizontal = end.x - start.x;
  if (kind === "route") {
    const concept = call.concept.toLowerCase();
    const checkdown = slot === "RB" || slot === "F";
    const deep = call.tags.includes("shot") || call.tags.includes("deep") || call.tags.includes("long-yardage") || concept.includes("vertical");
    const quick = call.tags.includes("quick") || call.tags.includes("short") || call.tags.includes("screen") || concept.includes("mesh") || concept.includes("spacing") || concept.includes("stick");
    const depth = checkdown ? 4.5 : deep ? 22 : quick ? 7 : call.playType === "play-action" ? 15 : 11.5;
    const finalY = clamp(start.y - depth, WORLD_MIN_Y, WORLD_MAX_Y);
    if (concept.includes("mesh") && (slot === "H" || slot === "Y")) {
      const crossX = slot === "H" ? 72 : 28;
      return [
        { x: start.x, y: clamp(start.y - 5, WORLD_MIN_Y, WORLD_MAX_Y) },
        { x: crossX, y: finalY },
        { x: clamp(crossX + (slot === "H" ? 8 : -8), FIELD_MIN_X, FIELD_MAX_X), y: finalY },
      ];
    }
    const finalX = clamp(start.x + horizontal, FIELD_MIN_X, FIELD_MAX_X);
    const stem = { x: start.x, y: clamp(start.y - depth * 0.58, WORLD_MIN_Y, WORLD_MAX_Y) };
    const breakPoint = Math.abs(horizontal) > 6
      ? { x: clamp(start.x + horizontal * 0.62, FIELD_MIN_X, FIELD_MAX_X), y: finalY }
      : { x: clamp(start.x + (slot === "H" || slot === "Y" ? 2 : -2), FIELD_MIN_X, FIELD_MAX_X), y: clamp(start.y - depth * 0.82, WORLD_MIN_Y, WORLD_MAX_Y) };
    return [stem, breakPoint, { x: finalX, y: finalY }];
  }
  if (kind === "carry" || kind === "handoff") {
    const runDepth = call.tags.includes("goal-line") ? 6 : 13;
    return [
      { x: clamp(start.x + horizontal * 0.2, FIELD_MIN_X, FIELD_MAX_X), y: clamp(start.y - 2, WORLD_MIN_Y, WORLD_MAX_Y) },
      { x: clamp(start.x + horizontal * 0.7, FIELD_MIN_X, FIELD_MAX_X), y: clamp(start.y - runDepth * 0.55, WORLD_MIN_Y, WORLD_MAX_Y) },
      { x: clamp(end.x, FIELD_MIN_X, FIELD_MAX_X), y: clamp(start.y - runDepth, WORLD_MIN_Y, WORLD_MAX_Y) },
    ];
  }
  return [{ x: clamp(end.x, FIELD_MIN_X, FIELD_MAX_X), y: clamp(end.y, WORLD_MIN_Y, WORLD_MAX_Y) }];
}

function playerSpeed(player: LivePlayerState): number {
  const base = player.position === "WR" || player.position === "CB" || player.position === "S"
    ? 11.2
    : player.position === "RB" || player.position === "LB" || player.position === "EDGE"
      ? 10.1
      : player.position === "QB"
        ? 8.2
        : player.position === "OT" || player.position === "OG" || player.position === "C" || player.position === "DT"
          ? 6.8
          : 8.6;
  return base * (0.78 + player.overall / 350) * 0.78;
}

function moveToward(player: LivePlayerState, target: MatchPoint, speed: number, dt: number): void {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const remaining = Math.hypot(dx, dy);
  if (remaining < 0.02) {
    player.x = clamp(target.x, FIELD_MIN_X, FIELD_MAX_X);
    player.y = clamp(target.y, WORLD_MIN_Y, WORLD_MAX_Y);
    player.vx = 0;
    player.vy = 0;
    return;
  }
  const direction = { x: dx / remaining, y: dy / remaining };
  const step = Math.min(remaining, speed * dt);
  player.vx = step >= remaining ? 0 : direction.x * speed;
  player.vy = step >= remaining ? 0 : direction.y * speed;
  player.facingX = direction.x;
  player.facingY = direction.y;
  player.x = clamp(player.x + direction.x * step, FIELD_MIN_X, FIELD_MAX_X);
  player.y = clamp(player.y + direction.y * step, WORLD_MIN_Y, WORLD_MAX_Y);
}

function moveByInput(player: LivePlayerState, input: LiveControlInput, speed: number, dt: number): void {
  const direction = normalize(input.moveX, input.moveY);
  player.vx = direction.x * speed;
  player.vy = direction.y * speed;
  if (Math.abs(direction.x) + Math.abs(direction.y) > 0) {
    player.facingX = direction.x;
    player.facingY = direction.y;
  }
  player.x = clamp(player.x + player.vx * dt, FIELD_MIN_X, FIELD_MAX_X);
  player.y = clamp(player.y + player.vy * dt, WORLD_MIN_Y, WORLD_MAX_Y);
}

function nearestPlayer(
  state: LivePlayEngineState,
  source: LivePlayerState,
  predicate: (candidate: LivePlayerState) => boolean,
): LivePlayerState | undefined {
  return state.players
    .filter((candidate) => candidate.id !== source.id && !candidate.down && predicate(candidate))
    .sort((left, right) => distance(source, left) - distance(source, right))[0];
}

function playerBySlot(state: LivePlayEngineState, slot: string | undefined, unit?: "offense" | "defense" | "special"): LivePlayerState | undefined {
  if (!slot) return undefined;
  return state.players.find((player) => player.slot === slot && (!unit || player.unit === unit));
}

function currentCarrier(state: LivePlayEngineState): LivePlayerState | undefined {
  return state.ball.carrierId ? state.players.find((player) => player.id === state.ball.carrierId) : undefined;
}

function quarterback(state: LivePlayEngineState): LivePlayerState | undefined {
  return state.quarterbackId ? state.players.find((player) => player.id === state.quarterbackId) : undefined;
}

interface QuarterbackTargetRead {
  receiver: LivePlayerState;
  score: number;
  separation: number;
  depth: number;
  progressionIndex: number;
  risk: number;
  openWindow: boolean;
  behindCoverage: boolean;
  overTopRisk: number;
}

function quarterbackTargetRead(state: LivePlayEngineState, receiver: LivePlayerState): QuarterbackTargetRead {
  const defenders = state.players.filter((candidate) => candidate.unit === "defense" && !candidate.down);
  const closest = [...defenders].sort((left, right) => distance(receiver, left) - distance(receiver, right))[0];
  const separation = closest ? distance(receiver, closest) : 12;
  const depth = Math.max(0, state.lineOfScrimmage - receiver.y);
  const call = offenseCallForEpisode(state.episode);
  const rawProgressionIndex = call.progression.indexOf(receiver.slot);
  const progressionIndex = rawProgressionIndex < 0 ? call.progression.length + 1 : rawProgressionIndex;
  const corridor = defenders.filter((defender) => Math.abs(defender.x - receiver.x) <= 7.5);
  const trailDefender = corridor
    .filter((defender) => defender.y >= receiver.y - 0.6)
    .sort((left, right) => distance(receiver, left) - distance(receiver, right))[0];
  const overTopDefender = corridor
    .filter((defender) => defender.y < receiver.y - 0.6)
    .sort((left, right) => Math.abs(receiver.y - left.y) - Math.abs(receiver.y - right.y))[0];
  const trailDepth = trailDefender ? trailDefender.y - receiver.y : 0;
  const behindCoverage = Boolean(trailDefender && trailDepth >= 1.25 && Math.abs(trailDefender.x - receiver.x) <= 5);
  const overTopDepth = overTopDefender ? receiver.y - overTopDefender.y : 99;
  const overTopRisk = overTopDefender
    ? Math.max(0, 9 - overTopDepth) * 2.5 + Math.max(0, 5.5 - Math.abs(overTopDefender.x - receiver.x)) * 1.8
    : 0;
  const needed = state.episode.distance;
  const sticksValue = depth >= needed ? 12 : -Math.max(0, needed - depth) * 1.6;
  const deepConcept = call.tags.includes("shot") || call.tags.includes("deep") || call.tags.includes("long-yardage");
  const excessDepthPenalty = Math.max(0, depth - (deepConcept ? 30 : Math.max(needed + 10, 17))) * (deepConcept ? 0.45 : 1.25);
  const leverageRisk = closest && !behindCoverage
    ? Math.max(0, 2.8 - separation) * 11 + Math.max(0, receiver.y - closest.y) * 2
    : 0;
  const sidelinePenalty = Math.max(0, 6 - Math.min(receiver.x, 100 - receiver.x)) * 1.25;
  const progressionBonus = Math.max(0, 12 - progressionIndex * 3.4);
  const checkdownBonus = receiver.slot === "RB" && state.elapsed >= 2.8 ? 9 : 0;
  const usagePriority = state.episode.receiverPriorities?.[receiver.slot] ?? (call.primarySlot === receiver.slot ? 78 : 58);
  const openWindow = (separation >= 3 && overTopRisk < 16) || (behindCoverage && separation >= 1.6 && overTopRisk < 22);
  const score = separation * 8.7
    + receiver.overall * 0.2
    + usagePriority * 0.46
    + sticksValue
    + progressionBonus
    + checkdownBonus
    + (behindCoverage ? Math.min(30, 12 + trailDepth * 5.5) : 0)
    + (openWindow ? 13 : 0)
    - leverageRisk
    - overTopRisk
    - sidelinePenalty
    - excessDepthPenalty;
  return {
    receiver,
    score,
    separation,
    depth,
    progressionIndex,
    risk: leverageRisk + overTopRisk + sidelinePenalty,
    openWindow,
    behindCoverage,
    overTopRisk,
  };
}

function setCarrier(state: LivePlayEngineState, player: LivePlayerState): void {
  state.players.forEach((candidate) => { candidate.hasBall = candidate.id === player.id; });
  state.ball.state = "carried";
  state.ball.carrierId = player.id;
  delete state.ball.targetId;
  player.hasBall = true;
  state.ball.x = player.x;
  state.ball.y = player.y;
  state.ball.z = 0;
}

function startPass(state: LivePlayEngineState, thrower: LivePlayerState, target: LivePlayerState): void {
  if (
    state.ball.state !== "carried"
    || state.ball.carrierId !== thrower.id
    || thrower.y < state.lineOfScrimmage - 0.2
    || target.unit !== "offense"
    || target.kind !== "route"
    || target.down
  ) return;
  const pressure = nearestPlayer(state, thrower, (candidate) => candidate.unit === "defense" && ["rush", "contain", "run-fit"].includes(candidate.kind));
  const pressureDistance = pressure ? distance(thrower, pressure) : 20;
  const lead = clamp((target.overall - 55) * 0.012 + 0.48, 0.38, 0.92);
  const cleanTargetX = clamp(target.x + target.vx * lead, FIELD_MIN_X, FIELD_MAX_X);
  const cleanTargetY = clamp(target.y + target.vy * lead, WORLD_MIN_Y, WORLD_MAX_Y);
  const airDistance = Math.hypot(cleanTargetX - thrower.x, cleanTargetY - thrower.y);
  const quality = clamp(72 + thrower.overall * 0.22 - Math.max(0, 5 - pressureDistance) * 7 - Math.abs(thrower.vx) * 0.7 - Math.abs(thrower.vy) * 0.5, 20, 99);
  const missRadius = clamp((100 - quality) * 0.018 + airDistance * 0.008, 0.08, 2.35);
  const missAngle = random(state) * Math.PI * 2;
  const targetX = clamp(cleanTargetX + Math.cos(missAngle) * missRadius, FIELD_MIN_X, FIELD_MAX_X);
  const targetY = clamp(cleanTargetY + Math.sin(missAngle) * missRadius, WORLD_MIN_Y, WORLD_MAX_Y);
  state.players.forEach((candidate) => { candidate.hasBall = false; });
  state.passAttempted = true;
  state.passTargetId = target.id;
  if (target.isHero && state.heroOpenWindowSeen) state.heroOpenWindowTargeted = true;
  state.ball = {
    x: thrower.x,
    y: thrower.y,
    z: 1,
    state: "flight",
    targetId: target.id,
    startX: thrower.x,
    startY: thrower.y,
    targetX,
    targetY,
    flightElapsed: 0,
    flightDuration: clamp(0.45 + airDistance / 42, 0.55, 1.65),
    throwQuality: quality,
    throwStartedAt: state.elapsed,
  };
  state.phase = "ball-flight";
  state.heroTouchedPlay = state.heroTouchedPlay || thrower.isHero || target.isHero;
  event(state, "throw", `${thrower.slot} бросает на ${target.slot}`, thrower.x, thrower.y, thrower.id, target.id);
}

function emptyStats(): MatchStatLine {
  return {
    passingAttempts: 0, completions: 0, passingYards: 0, rushingAttempts: 0, rushingYards: 0,
    targets: 0, receptions: 0, receivingYards: 0, touchdowns: 0, turnovers: 0,
    tackles: 0, tacklesForLoss: 0, sacks: 0, passBreakups: 0, interceptions: 0,
    sacksAllowed: 0, pressuresAllowed: 0, pancakes: 0, hurries: 0, runStops: 0,
    coverageSnaps: 0, fieldGoalsAttempted: 0, fieldGoalsMade: 0, longestFieldGoal: 0,
    punts: 0, puntYards: 0, puntsInside20: 0, returnYardsAllowed: 0,
  };
}

function emptyAdvancedStats(): MatchAdvancedStatLine {
  return {
    snaps: 1, assignmentWins: 0, assignmentLosses: 0, routeWins: 0, separationWins: 0,
    blocksWon: 0, pressures: 0, coverageWins: 0, missedTackles: 0,
    passProtectionWins: 0, runBlockWins: 0, doubleTeamWins: 0, kickQuality: 0, puntQuality: 0,
  };
}

function exactHeroDeltas(
  state: LivePlayEngineState,
  snapResult: MatchSnapResult,
  yards: number,
  turnover: boolean,
  target: LivePlayerState | undefined,
  carrier: LivePlayerState | undefined,
  assignmentScore: number,
): { stats: MatchStatLine; advanced: MatchAdvancedStatLine; involved: boolean } {
  const stats = emptyStats();
  const advanced = emptyAdvancedStats();
  const hero = state.players.find((player) => player.isHero);
  if (!hero) return { stats, advanced, involved: false };
  const heroEvents = state.events.filter((entry) => entry.playerId === hero.id);
  const won = assignmentScore >= 65;
  const lost = assignmentScore < 45;
  advanced.assignmentWins = won ? 1 : 0;
  advanced.assignmentLosses = lost ? 1 : 0;
  let involved = state.heroTouchedPlay;

  if (state.heroPosition === "QB") {
    if (state.passAttempted) {
      involved = true;
      stats.passingAttempts = 1;
      stats.completions = state.passCompleted ? 1 : 0;
      stats.passingYards = state.passCompleted ? Math.max(0, yards) : 0;
      stats.turnovers = turnover ? 1 : 0;
    } else if (carrier?.id === hero.id && snapResult !== "sack") {
      involved = true;
      stats.rushingAttempts = 1;
      stats.rushingYards = yards;
      stats.turnovers = turnover ? 1 : 0;
    }
  } else if (state.heroPosition === "RB") {
    if (carrier?.id === hero.id && !state.passCompleted) {
      involved = true;
      stats.rushingAttempts = 1;
      stats.rushingYards = yards;
      stats.turnovers = turnover ? 1 : 0;
    }
    if (target?.id === hero.id) {
      involved = true;
      stats.targets = 1;
      stats.receptions = state.passCompleted ? 1 : 0;
      stats.receivingYards = state.passCompleted ? Math.max(0, yards) : 0;
    }
  } else if (state.heroPosition === "WR" || state.heroPosition === "TE") {
    if (target?.id === hero.id) {
      involved = true;
      stats.targets = 1;
      stats.receptions = state.passCompleted ? 1 : 0;
      stats.receivingYards = state.passCompleted ? Math.max(0, yards) : 0;
    }
    advanced.routeWins = hero.kind === "route" && won ? 1 : 0;
    advanced.separationWins = hero.kind === "route" && assignmentScore >= 78 ? 1 : 0;
  } else if (["OT", "OG", "C"].includes(state.heroPosition)) {
    involved = true;
    const passProtection = hero.kind === "pass-protection";
    advanced.blocksWon = won ? 1 : 0;
    advanced.passProtectionWins = passProtection && won ? 1 : 0;
    advanced.runBlockWins = !passProtection && won ? 1 : 0;
    advanced.doubleTeamWins = ["OG", "C"].includes(state.heroPosition) && won ? 1 : 0;
    stats.pressuresAllowed = passProtection && state.pressureOccurred && lost ? 1 : 0;
    stats.sacksAllowed = passProtection && snapResult === "sack" && lost ? 1 : 0;
    stats.pancakes = assignmentScore >= 88 ? 1 : 0;
  } else if (["EDGE", "DT", "LB", "CB", "S"].includes(state.heroPosition)) {
    const tackle = heroEvents.some((entry) => entry.type === "tackle");
    const sack = heroEvents.some((entry) => entry.type === "sack");
    const interception = heroEvents.some((entry) => entry.type === "interception");
    const breakup = heroEvents.some((entry) => entry.type === "breakup");
    const pressure = heroEvents.some((entry) => entry.type === "pressure");
    involved = involved || tackle || sack || interception || breakup || pressure;
    stats.tackles = tackle || sack ? 1 : 0;
    stats.tacklesForLoss = stats.tackles > 0 && yards < 0 ? 1 : 0;
    stats.sacks = sack ? 1 : 0;
    stats.interceptions = interception ? 1 : 0;
    stats.passBreakups = breakup ? 1 : 0;
    stats.hurries = pressure && !sack ? 1 : 0;
    stats.runStops = tackle && yards <= 2 ? 1 : 0;
    stats.coverageSnaps = hero.kind === "zone-coverage" || hero.kind === "man-coverage" ? 1 : 0;
    advanced.pressures = pressure || sack ? 1 : 0;
    advanced.coverageWins = stats.coverageSnaps > 0 && won ? 1 : 0;
  } else if (state.heroPosition === "K") {
    involved = true;
    stats.fieldGoalsAttempted = 1;
    stats.fieldGoalsMade = snapResult === "field-goal" ? 1 : 0;
    stats.longestFieldGoal = stats.fieldGoalsMade ? state.episode.distance : 0;
    advanced.kickQuality = Math.max(1, Math.round(assignmentScore / 25));
  } else if (state.heroPosition === "P") {
    involved = true;
    stats.punts = 1;
    stats.puntYards = 42;
    stats.puntsInside20 = state.episode.fieldPosition + 42 >= 80 ? 1 : 0;
    stats.returnYardsAllowed = 3;
    advanced.puntQuality = Math.max(1, Math.round(assignmentScore / 25));
  }

  if ((snapResult === "touchdown" || snapResult === "defensive-touchdown") && (carrier?.id === hero.id || target?.id === hero.id || state.heroPosition === "QB" && state.passAttempted)) {
    stats.touchdowns = 1;
  }
  return { stats, advanced, involved };
}

function sampleHeroMovement(state: LivePlayEngineState, player: LivePlayerState): void {
  if (!player.isHero) return;
  if (player.kind === "route") {
    const next = player.route[player.routeIndex] ?? player.route[player.route.length - 1];
    const previous = player.route[Math.max(0, player.routeIndex - 1)] ?? { x: player.startX, y: player.startY };
    const deviation = next ? distanceToSegment(player, previous, next) : 0;
    const defender = nearestPlayer(state, player, (candidate) => candidate.unit === "defense");
    state.heroRouteDeviationTotal += deviation;
    state.heroRouteSamples += 1;
    state.heroSeparationTotal += defender ? distance(player, defender) : 8;
    state.heroSeparationSamples += 1;
  }
  if (player.kind === "man-coverage" || player.kind === "zone-coverage") {
    const threat = player.matchupSlot
      ? playerBySlot(state, player.matchupSlot, "offense")
      : nearestPlayer(state, player, (candidate) => candidate.unit === "offense" && candidate.kind === "route");
    if (threat) {
      state.heroCoverageTotal += distance(player, threat);
      state.heroCoverageSamples += 1;
    }
  }
}

function evaluationSignals(state: LivePlayEngineState): MatchLiveEvaluationSignals {
  const routeDeviation = state.heroRouteSamples > 0 ? state.heroRouteDeviationTotal / state.heroRouteSamples : 0;
  const separation = state.heroSeparationSamples > 0 ? state.heroSeparationTotal / state.heroSeparationSamples : 0;
  const coverageDistance = state.heroCoverageSamples > 0 ? state.heroCoverageTotal / state.heroCoverageSamples : 0;
  return {
    routeAdherence: state.heroRouteSamples > 0 ? clamp(100 - routeDeviation * 9.5, 18, 98) : undefined,
    separationScore: state.heroSeparationSamples > 0 ? clamp(42 + separation * 13, 20, 98) : undefined,
    coverageScore: state.heroCoverageSamples > 0 ? clamp(100 - coverageDistance * 10.5, 18, 98) : undefined,
    decisionQuality: state.qbDecisionQuality > 0 ? clamp(state.qbDecisionQuality, 20, 98) : undefined,
    timingScore: state.qbTimeToThrow > 0 ? clamp(92 - Math.abs(state.qbTimeToThrow - 2.65) * 18, 25, 98) : undefined,
    timeToThrow: state.qbTimeToThrow > 0 ? state.qbTimeToThrow : undefined,
    heroOpenWindow: state.heroOpenWindowSeen || undefined,
    targetedWhenOpen: state.heroOpenWindowTargeted || undefined,
    separationYards: state.heroBestSeparation > 0 ? Math.round(state.heroBestSeparation * 10) / 10 : undefined,
  };
}

function finishPlay(
  state: LivePlayEngineState,
  snapResult: MatchSnapResult,
  carrier: LivePlayerState | undefined,
  description: string,
  turnover = false,
): MatchLivePlayOutcome {
  const spotY = carrier?.y ?? state.ball.y;
  const endFieldPosition = liveWorldToFieldYard(state, spotY);
  let yards = Math.round(endFieldPosition - state.episode.fieldPosition);
  if (snapResult === "incomplete" || snapResult === "field-goal" || snapResult === "missed-field-goal") yards = 0;
  if (snapResult === "punt") yards = 42;
  if (snapResult === "touchdown") yards = Math.max(0, 100 - state.episode.fieldPosition);
  if (snapResult === "defensive-touchdown") yards = -state.episode.fieldPosition;
  const resolvedTurnover = turnover || snapResult === "defensive-touchdown" || state.turnoverCommitted;
  const carrierImpact = carrier?.isHero ? clamp(yards, -10, 20) * 1.2 : 0;
  const actionScore = clamp(state.heroActionScore + (state.heroTouchedPlay ? 8 : 0) + carrierImpact, 20, 98);
  const teamExecution = clamp(52 + yards * 2.1 + (snapResult === "completion" ? 10 : 0) + (snapResult === "touchdown" ? 24 : 0) - (resolvedTurnover ? 28 : 0), 12, 99);
  const targetId = state.passTargetId ?? state.ball.targetId;
  const target = targetId ? state.players.find((player) => player.id === targetId) : undefined;
  const exact = exactHeroDeltas(state, snapResult, yards, resolvedTurnover, target, carrier, actionScore);
  const points = snapResult === "field-goal" ? 3 : snapResult === "touchdown" || snapResult === "defensive-touchdown" ? 7 : 0;
  const scoringSide = points > 0
    ? snapResult === "defensive-touchdown" ? oppositeSide(state.offenseSide) : state.offenseSide
    : undefined;
  const firstDown = !resolvedTurnover && snapResult !== "incomplete" && yards >= state.episode.distance;
  state.phase = "whistle";
  event(
    state,
    snapResult === "touchdown" || snapResult === "defensive-touchdown" ? "touchdown" : "whistle",
    description,
    carrier?.x ?? state.ball.x,
    carrier?.y ?? state.ball.y,
    carrier?.id,
  );
  const outcome: MatchLivePlayOutcome = {
    version: 1,
    actionId: `live-${state.heroPosition.toLowerCase()}`,
    snapResult,
    yards,
    points,
    turnover: resolvedTurnover,
    teamExecutionScore: teamExecution,
    assignmentScore: actionScore,
    pressureOccurred: state.pressureOccurred,
    elapsedSeconds: Math.max(1, Math.round(state.elapsed)),
    description,
    heroInvolved: exact.involved,
    statDelta: exact.stats,
    advancedDelta: exact.advanced,
    events: [...state.events],
    startFieldPosition: state.episode.fieldPosition,
    endFieldPosition: Math.round(endFieldPosition),
    firstDown,
    evaluationSignals: evaluationSignals(state),
  };
  if (scoringSide) outcome.scoringSide = scoringSide;
  if (target) outcome.targetSlot = target.slot;
  if (carrier) outcome.ballCarrierSlot = carrier.slot;
  state.outcome = outcome;
  return outcome;
}

export function livePassInterceptionChance(defenderOverall: number, playBallBonus: number, throwQuality: number, leverage: number): number {
  return clamp(
    0.9
      + Math.max(0, defenderOverall - 70) * 0.12
      + playBallBonus * 0.55
      - throwQuality * 0.035
      + Math.max(0, leverage) * 0.9,
    0.25,
    11.5,
  );
}

function resolveBallFlight(state: LivePlayEngineState): MatchLivePlayOutcome | undefined {
  const progress = clamp(state.ball.flightElapsed / Math.max(0.01, state.ball.flightDuration), 0, 1);
  const target = state.ball.targetId ? state.players.find((player) => player.id === state.ball.targetId) : undefined;
  const ballPoint = { x: state.ball.x, y: state.ball.y };
  const receiverDistance = target ? distance(target, ballPoint) : 99;
  const defenders = state.players
    .filter((player) => player.unit === "defense" && !player.down && state.elapsed - state.ball.throwStartedAt >= player.ballReactionDelay)
    .sort((left, right) => distance(left, ballPoint) - distance(right, ballPoint));
  const defender = defenders[0];
  const defenderDistance = defender ? distance(defender, ballPoint) : 99;
  const catchableHeight = state.ball.z <= 3.1;

  if (catchableHeight && defender && defenderDistance <= 1.42 && defenderDistance + 0.14 < receiverDistance) {
    const canIntercept = ["CB", "S", "LB"].includes(defender.position);
    const playBallBonus = defender.actionMode === "intercept" ? 7 : defender.actionMode === "break" ? 3 : 0;
    // A defender reaching the catch point should usually create a breakup, not an interception.
    // The previous curve could exceed 60% on ordinary contested throws and flooded every game with turnovers.
    const interceptionChance = livePassInterceptionChance(
      defender.overall,
      playBallBonus,
      state.ball.throwQuality,
      Math.max(0, receiverDistance - defenderDistance),
    );
    if (canIntercept && random(state) * 100 <= interceptionChance) {
      setCarrier(state, defender);
      state.turnoverCommitted = true;
      state.phase = "live";
      state.heroActionScore += defender.isHero ? 30 : target?.isHero ? -24 : 0;
      event(state, "interception", `${defender.slot} перехватывает мяч`, defender.x, defender.y, defender.id, target?.id);
      return undefined;
    }
    state.heroActionScore += defender.isHero ? 18 : target?.isHero ? -12 : 0;
    event(state, "breakup", `${defender.slot} касается мяча`, defender.x, defender.y, defender.id, target?.id);
    return finishPlay(state, "incomplete", undefined, "Защитник физически добирается до траектории и сбивает передачу.");
  }

  if (catchableHeight && target && receiverDistance <= 1.9) {
    const nearestContest = defenders.find((candidate) => distance(candidate, target) <= 2.1);
    const contestPenalty = nearestContest ? Math.max(0, 2.1 - distance(nearestContest, target)) * 13 : 0;
    const secureBonus = target.actionMode === "secure" ? 8 : 0;
    const catchChance = clamp(24 + target.overall * 0.38 + state.ball.throwQuality * 0.25 - contestPenalty + secureBonus, 24, 94);
    if (random(state) * 100 <= catchChance) {
      state.passCompleted = true;
      setCarrier(state, target);
      state.phase = "live";
      state.heroTouchedPlay = state.heroTouchedPlay || target.isHero;
      state.heroActionScore += target.isHero ? 16 : state.heroPosition === "QB" ? 12 : 0;
      event(state, "catch", `${target.slot} принимает передачу`, target.x, target.y, target.id);
      return undefined;
    }
    state.heroActionScore += target.isHero || state.heroPosition === "QB" ? -12 : 0;
    event(state, "drop", `${target.slot} не удерживает мяч`, target.x, target.y, target.id);
    return finishPlay(state, "incomplete", undefined, "Мяч доходит до ресивера, но приём не завершён.");
  }

  if (progress >= 1 && catchableHeight && target && receiverDistance <= 2.35) {
    const nearestContest = defenders.find((candidate) => distance(candidate, target) <= 1.8);
    const lateCatchChance = clamp(28 + target.overall * 0.28 + state.ball.throwQuality * 0.18 - (nearestContest ? 18 : 0), 12, 68);
    if (random(state) * 100 <= lateCatchChance) {
      state.passCompleted = true;
      setCarrier(state, target);
      state.phase = "live";
      state.heroTouchedPlay = state.heroTouchedPlay || target.isHero;
      state.heroActionScore += target.isHero ? 12 : state.heroPosition === "QB" ? 9 : 0;
      event(state, "catch", `${target.slot} вытягивает неточную передачу`, target.x, target.y, target.id);
      return undefined;
    }
  }

  if (progress >= 1) {
    const description = target && receiverDistance <= 3.2
      ? "Неточный бросок проходит рядом с ресивером, но вне радиуса уверенного приёма."
      : "Передача уходит в свободную зону и падает на газон.";
    event(state, "drop", "Незавершённая передача", state.ball.x, state.ball.y, target?.id);
    return finishPlay(state, "incomplete", undefined, description);
  }
  return undefined;
}

function tackleCarrier(state: LivePlayEngineState, defender: LivePlayerState, carrier: LivePlayerState): MatchLivePlayOutcome | undefined {
  if (defender.id === carrier.id || defender.unit === carrier.unit || defender.down) return undefined;
  const isQuarterbackBeforeLine = carrier.id === state.quarterbackId && !state.turnoverCommitted && carrier.y >= state.lineOfScrimmage;
  const contactLimit = isQuarterbackBeforeLine ? 1.05 : 1.9;
  if (state.elapsed < defender.tackleCooldownUntil || distance(defender, carrier) > contactLimit) return undefined;
  defender.tackleCooldownUntil = state.elapsed + 0.65;
  const userBonus = defender.isHero && defender.actionMode === "tackle" ? 14 : 0;
  const secureBonus = carrier.actionMode === "secure" ? 13 : 0;
  const burstPenalty = carrier.actionMode === "cut" ? 11 : carrier.actionMode === "burst" ? 5 : 0;
  const carrierDirection = normalize(carrier.vx, carrier.vy);
  const approachDirection = normalize(carrier.x - defender.x, carrier.y - defender.y);
  const angleBonus = Math.max(-6, (carrierDirection.x * approachDirection.x + carrierDirection.y * approachDirection.y) * -8);
  const chance = isQuarterbackBeforeLine
    ? clamp(38 + (defender.overall - carrier.overall) * 0.65 + userBonus + angleBonus - secureBonus - burstPenalty, 14, 76)
    : clamp(64 + (defender.overall - carrier.overall) * 0.85 + userBonus + angleBonus - secureBonus - burstPenalty, 24, 96);
  if (random(state) * 100 > chance) {
    state.heroActionScore += defender.isHero ? -8 : carrier.isHero ? 8 : 0;
    event(state, "missed-tackle", `${defender.slot} промахивается с тэклом`, defender.x, defender.y, defender.id, carrier.id);
    defender.x = clamp(defender.x - defender.facingX * 1.4, FIELD_MIN_X, FIELD_MAX_X);
    defender.y = clamp(defender.y - defender.facingY * 1.4, WORLD_MIN_Y, WORLD_MAX_Y);
    return undefined;
  }
  carrier.down = true;
  const isQuarterback = carrier.id === state.quarterbackId;
  const sack = isQuarterback && !state.turnoverCommitted && carrier.y >= state.lineOfScrimmage;
  state.heroActionScore += defender.isHero ? 22 : carrier.isHero ? -15 : 0;
  event(state, sack ? "sack" : "tackle", sack ? `${defender.slot} делает сэк` : `${defender.slot} завершает тэкл`, carrier.x, carrier.y, defender.id, carrier.id);
  const result = state.turnoverCommitted ? "turnover" : sack ? "sack" : state.passCompleted ? "completion" : "run";
  return finishPlay(
    state,
    result,
    carrier,
    sack ? "Карман закрывается, квотербек остановлен за линией скримиджа." : state.turnoverCommitted ? "После перехвата атакующая команда останавливает возврат." : "Защитник фиксирует захват и завершает розыгрыш.",
    state.turnoverCommitted,
  );
}

function hasManualMovementInput(input: LiveControlInput): boolean {
  return Math.hypot(input.moveX, input.moveY) >= 0.08;
}

function heroHasManualControl(player: LivePlayerState, input: LiveControlInput): boolean {
  return player.isHero && hasManualMovementInput(input);
}

export function liveHeroControlActive(input: LiveControlInput): boolean {
  return hasManualMovementInput(input);
}

function offensiveRouteStep(state: LivePlayEngineState, player: LivePlayerState, dt: number): void {
  if (player.hasBall) return;
  if (state.ball.state === "flight" && state.ball.targetId === player.id) {
    const adjustmentTarget = { x: state.ball.targetX, y: state.ball.targetY };
    moveToward(player, adjustmentTarget, playerSpeed(player) * 1.02, dt);
    if (player.isHero) sampleHeroMovement(state, player);
    return;
  }
  const target = player.route[player.routeIndex];
  if (!target) {
    const qb = quarterback(state);
    const escape = qb && Math.abs(qb.x - qb.startX) > 5
      ? { x: clamp(qb.x + (player.x < qb.x ? -8 : 8), FIELD_MIN_X, FIELD_MAX_X), y: clamp(player.y - 4, WORLD_MIN_Y, WORLD_MAX_Y) }
      : { x: player.x, y: clamp(player.y - 2, WORLD_MIN_Y, WORLD_MAX_Y) };
    moveToward(player, escape, playerSpeed(player) * 0.7, dt);
    return;
  }
  moveToward(player, target, playerSpeed(player) * (player.actionMode === "burst" ? 1.18 : 1), dt);
  if (player.isHero) {
    const defender = nearestPlayer(state, player, (candidate) => candidate.unit === "defense");
    const separation = defender ? distance(player, defender) : 8;
    state.heroActionScore += clamp(separation - 2.2, -2, 5) * dt * 1.25;
    sampleHeroMovement(state, player);
  }
  if (distance(player, target) < 1.2) player.routeIndex += 1;
}

function blockerStep(state: LivePlayEngineState, blocker: LivePlayerState, dt: number, automatedHero = false): void {
  const matched = playerBySlot(state, blocker.matchupSlot, "defense");
  const target = matched && !matched.down ? matched : nearestPlayer(state, blocker, (candidate) => candidate.unit === "defense" && ["rush", "contain", "run-fit"].includes(candidate.kind));
  if (!target || target.rushWon) return;
  const contact = distance(blocker, target);
  if (contact > 2.5) {
    if (!blocker.isHero || automatedHero) moveToward(blocker, target, playerSpeed(blocker) * 0.75, dt);
    return;
  }
  if (state.elapsed < blocker.engagementUntil) return;

  const powerBonus = blocker.actionMode === "power" ? 12 : blocker.actionMode === "anchor" ? 8 : 0;
  const rushBonus = target.actionMode === "power" ? 12 : target.actionMode === "speed" ? 8 : 0;
  const rushEdge = target.overall + rushBonus - blocker.overall - powerBonus;

  if (target.blockEngagements >= 2) {
    target.blockedUntil = Math.max(target.blockedUntil, state.elapsed + 0.28);
    blocker.engagementUntil = state.elapsed + 0.24;
    target.vx = 0;
    target.vy = 0;
    if (blocker.isHero) state.heroActionScore += dt * 3.4;
    if (target.isHero) state.heroActionScore -= dt * 1.4;
    return;
  }

  target.blockEngagements += 1;
  const rushWinChance = clamp(
    0.045 + rushEdge * 0.0045 + (target.position === "EDGE" ? 0.018 : 0) + (target.blockEngagements === 2 ? 0.025 : 0),
    0.02,
    0.16,
  );

  if (random(state) < rushWinChance) {
    target.rushWon = true;
    target.blockedUntil = state.elapsed;
    blocker.engagementUntil = state.elapsed + 0.7;
    const qb = quarterback(state);
    const lane = qb ? normalize(qb.x - target.x, qb.y - target.y) : { x: 0, y: 1 };
    target.x = clamp(target.x + lane.x * 0.48, FIELD_MIN_X, FIELD_MAX_X);
    target.y = clamp(target.y + lane.y * 0.48, WORLD_MIN_Y, WORLD_MAX_Y);
    blocker.x = clamp(blocker.x - lane.x * 0.22, FIELD_MIN_X, FIELD_MAX_X);
    blocker.y = clamp(blocker.y - lane.y * 0.22, WORLD_MIN_Y, WORLD_MAX_Y);
    if (target.isHero) {
      state.heroTouchedPlay = true;
      state.heroActionScore += 5.2;
    }
    if (blocker.isHero) state.heroActionScore -= 4.4;
    return;
  }

  const hold = clamp(
    0.78 + (blocker.overall + powerBonus - target.overall - rushBonus) * 0.014 - target.blockEngagements * 0.08,
    0.55,
    1.15,
  );
  target.blockedUntil = Math.max(target.blockedUntil, state.elapsed + hold);
  blocker.engagementUntil = state.elapsed + hold - 0.03;
  target.vx = 0;
  target.vy = 0;
  if (blocker.isHero) {
    state.heroTouchedPlay = true;
    state.heroActionScore += dt * 4.2;
  }
  if (target.isHero) state.heroActionScore -= dt * 1.8;
}

function defenderStep(state: LivePlayEngineState, player: LivePlayerState, input: LiveControlInput, dt: number): void {
  if (player.down || player.hasBall) return;
  const carrier = currentCarrier(state);
  if (player.isHero && heroHasManualControl(player, input)) {
    const boost = player.actionMode === "speed" ? 1.2 : player.actionMode === "break" || player.actionMode === "tackle" || player.actionMode === "intercept" ? 1.13 : 1;
    moveByInput(player, input, playerSpeed(player) * boost, dt);
    sampleHeroMovement(state, player);
    if (player.kind === "man-coverage" && player.matchupSlot) {
      const target = playerBySlot(state, player.matchupSlot, "offense");
      if (target) state.heroActionScore += clamp(3.8 - distance(player, target), -3, 3) * dt * 1.2;
    }
    return;
  }
  if (state.elapsed < player.blockedUntil) {
    player.vx = 0;
    player.vy = 0;
    return;
  }

  if (state.turnoverCommitted && carrier) {
    if (player.unit === carrier.unit) {
      const threat = nearestPlayer(state, player, (candidate) => candidate.unit !== carrier.unit);
      if (threat && distance(player, threat) < 10) moveToward(player, threat, playerSpeed(player) * 0.72, dt);
      else moveToward(player, { x: carrier.x, y: carrier.y + 4 }, playerSpeed(player) * 0.72, dt);
    } else {
      moveToward(player, carrier, playerSpeed(player) * 1.07, dt);
    }
    return;
  }

  const qb = quarterback(state);
  let target: MatchPoint | LivePlayerState;
  if (state.ball.state === "flight") {
    const reactionElapsed = state.elapsed - state.ball.throwStartedAt;
    if (reactionElapsed < player.ballReactionDelay) return;
    target = { x: state.ball.targetX, y: state.ball.targetY };
  } else if (carrier && (carrier.id !== qb?.id || state.runCommitted || carrier.y < state.lineOfScrimmage - 0.5)) {
    target = carrier;
  } else if (["rush", "contain", "run-fit"].includes(player.kind)) {
    target = carrier ?? qb ?? { x: 50, y: state.lineOfScrimmage + 7 };
  } else if (player.kind === "man-coverage") {
    const receiver = playerBySlot(state, player.matchupSlot, "offense");
    target = receiver
      ? { x: clamp(receiver.x + Math.sign(50 - receiver.x) * 0.8, FIELD_MIN_X, FIELD_MAX_X), y: receiver.y - 1.1 }
      : { x: player.x, y: player.y - 1 };
  } else {
    const threat = nearestPlayer(state, player, (candidate) => candidate.unit === "offense" && candidate.kind === "route");
    const zone = player.route[player.routeIndex] ?? { x: player.startX, y: player.startY - 6 };
    target = threat && distance(player, threat) < 12 ? { x: threat.x, y: threat.y - 1.2 } : zone;
  }
  const pursuitMultiplier = target === carrier
    ? 1.1
    : ["rush", "contain"].includes(player.kind)
      ? 1.02
      : 0.92;
  moveToward(player, target, playerSpeed(player) * pursuitMultiplier, dt);
}

function quarterbackStep(state: LivePlayEngineState, player: LivePlayerState, input: LiveControlInput, dt: number): void {
  if (state.ball.state === "snap") return;
  if (player.isHero && heroHasManualControl(player, input)) {
    const boost = player.actionMode === "burst" ? 1.12 : 1;
    moveByInput(player, input, playerSpeed(player) * boost, dt);
    if (player.y < state.lineOfScrimmage - 0.35) state.runCommitted = true;
    return;
  }
  const rusher = nearestPlayer(state, player, (candidate) => candidate.unit === "defense" && ["rush", "contain", "run-fit"].includes(candidate.kind));
  const pressureDistance = rusher ? distance(player, rusher) : 20;
  if (pressureDistance < 5.5) {
    state.pressureOccurred = true;
    if (!state.events.some((entry) => entry.type === "pressure")) event(state, "pressure", "Давление добирается до QB", player.x, player.y, rusher?.id, player.id);
  }
  const call = offenseCallForEpisode(state.episode);
  const receivers = state.players.filter((candidate) => candidate.unit === "offense" && candidate.kind === "route" && !candidate.down);
  const reads = receivers.map((receiver) => quarterbackTargetRead(state, receiver)).sort((left, right) => right.score - left.score);
  const heroRead = reads.find((read) => read.receiver.isHero);
  if (heroRead && state.elapsed >= 1.05) {
    state.heroBestSeparation = Math.max(state.heroBestSeparation, heroRead.separation);
    if (heroRead.openWindow) state.heroOpenWindowSeen = true;
  }
  let best = reads[0];
  if (heroRead?.openWindow && best && heroRead.score >= best.score - (heroRead.behindCoverage ? 12 : 6)) best = heroRead;
  const quickConcept = call.tags.includes("quick") || call.tags.includes("short") || call.playType === "screen";
  const deepConcept = call.tags.includes("shot") || call.tags.includes("deep") || call.tags.includes("long-yardage");
  const minimumReadTime = quickConcept ? 1.9 : deepConcept ? 3.05 : 2.45;
  const emergency = pressureDistance < 3.5;
  const forcedDecision = state.elapsed > (deepConcept ? 5.15 : 4.45);
  const acceptableWindow = best && best.score >= (emergency ? 35 : quickConcept ? 48 : 54);
  const requiredReadTime = emergency ? Math.min(1.25, minimumReadTime) : minimumReadTime;
  if (best && state.elapsed >= requiredReadTime && (acceptableWindow || emergency || forcedDecision)) {
    state.qbDecisionQuality = clamp(58 + best.score * 0.45 - best.risk * 0.5 - (emergency ? 5 : 0), 20, 98);
    state.qbTimeToThrow = state.elapsed;
    startPass(state, player, best.receiver);
    return;
  }
  if (pressureDistance < 5.2 && rusher && !state.qbEscapeTarget) {
    const dx = player.x - rusher.x;
    const dy = player.y - rusher.y;
    const edgePressure = Math.abs(dx) > Math.abs(dy) * 0.72;
    if (state.qbEscapeDirection === 0) {
      const resolved = Math.abs(dx) > 0.35 ? Math.sign(dx) : player.x < 50 ? 1 : -1;
      state.qbEscapeDirection = resolved < 0 ? -1 : 1;
    }
    const lateralDirection = state.qbEscapeDirection;
    state.qbEscapeTarget = edgePressure
      ? {
          x: clamp(player.x + lateralDirection * 5.2, 16, 84),
          y: clamp(player.y - 1.35, state.lineOfScrimmage + 1.2, state.lineOfScrimmage + 9.5),
        }
      : {
          x: clamp(player.x + lateralDirection * 4.4, 16, 84),
          y: clamp(player.y + Math.max(0.8, dy * 0.24), state.lineOfScrimmage + 2, state.lineOfScrimmage + 12),
        };
  }
  const dropTarget = state.qbEscapeTarget ?? { x: player.startX, y: player.startY + (deepConcept ? 6.6 : 5.1) };
  moveToward(player, dropTarget, playerSpeed(player) * (state.qbEscapeTarget ? 1.12 : 0.62), dt);
  if (state.elapsed > 4.05 && pressureDistance < 3.25 && !acceptableWindow) state.runCommitted = true;
}

function carrierStep(state: LivePlayEngineState, carrier: LivePlayerState, input: LiveControlInput, dt: number): void {
  if (carrier.isHero && heroHasManualControl(carrier, input)) {
    const boost = carrier.actionMode === "burst" ? 1.2 : carrier.actionMode === "cut" ? 1.1 : carrier.actionMode === "secure" ? 0.9 : 1;
    moveByInput(carrier, input, playerSpeed(carrier) * boost, dt);
  } else {
    const opponents = state.players.filter((player) => player.unit !== carrier.unit && !player.down);
    const closest = [...opponents].sort((left, right) => distance(carrier, left) - distance(carrier, right))[0];
    const goalY = carrier.unit === "defense" ? defenseGoalWorldY(state) : offenseGoalWorldY(state);
    const scriptedTarget = carrier.unit === "offense" ? carrier.route[carrier.routeIndex] : undefined;
    const baseTarget = scriptedTarget ?? { x: carrier.x, y: goalY };
    if (closest && distance(carrier, closest) < 4.2 && state.elapsed >= carrier.autoCutUntil) {
      carrier.autoCutDirection = carrier.x <= closest.x ? -1 : 1;
      carrier.autoCutUntil = state.elapsed + 0.62;
    }
    if (state.elapsed >= carrier.autoCutUntil) carrier.autoCutDirection = 0;
    const avoidX = carrier.autoCutDirection === 0
      ? baseTarget.x
      : clamp(carrier.x + carrier.autoCutDirection * 2.4, FIELD_MIN_X, FIELD_MAX_X);
    moveToward(carrier, { x: avoidX, y: baseTarget.y }, playerSpeed(carrier) * (carrier.isHero ? 0.9 : 0.75), dt);
    if (scriptedTarget && distance(carrier, scriptedTarget) < 1.2) carrier.routeIndex += 1;
  }
  state.ball.x = carrier.x;
  state.ball.y = carrier.y;
  state.ball.z = 0;
}

function separatePlayers(state: LivePlayEngineState): void {
  for (let leftIndex = 0; leftIndex < state.players.length; leftIndex += 1) {
    const left = state.players[leftIndex];
    if (!left || left.down) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < state.players.length; rightIndex += 1) {
      const right = state.players[rightIndex];
      if (!right || right.down) continue;
      const gap = distance(left, right);
      const minimum = left.unit === right.unit ? 0.18 : 0.26;
      if (gap >= minimum) continue;
      const direction = gap < 0.0001
        ? normalize(((leftIndex * 37 + rightIndex * 17) % 11) - 5, ((leftIndex * 19 + rightIndex * 29) % 11) - 5)
        : normalize(left.x - right.x, left.y - right.y);
      const correction = Math.min(0.018, (minimum - gap) * 0.22);
      left.x = clamp(left.x + direction.x * correction, FIELD_MIN_X, FIELD_MAX_X);
      left.y = clamp(left.y + direction.y * correction, WORLD_MIN_Y, WORLD_MAX_Y);
      right.x = clamp(right.x - direction.x * correction, FIELD_MIN_X, FIELD_MAX_X);
      right.y = clamp(right.y - direction.y * correction, WORLD_MIN_Y, WORLD_MAX_Y);
    }
  }
}

function liveStep(state: LivePlayEngineState, input: LiveControlInput, dt: number): MatchLivePlayOutcome | undefined {
  const qb = quarterback(state);
  if (state.elapsed <= 0.22 && qb) {
    state.ball.x = qb.x;
    state.ball.y = qb.y;
    if (state.elapsed >= 0.16 && state.ball.state === "snap") setCarrier(state, qb);
  }

  if (state.episode.unit === "special") {
    const hero = state.players.find((player) => player.isHero);
    if (hero && state.elapsed > 1.05 && !hero.actionMode) {
      hero.actionMode = "power";
      hero.actionBoostUntil = state.elapsed + 0.5;
    }
    if (hero && state.elapsed > 0.65 && state.ball.state !== "flight" && hero.actionMode === "power") {
      const quality = clamp(62 + hero.overall * 0.3 - Math.abs(1.25 - state.elapsed) * 30, 18, 98);
      const made = state.heroPosition === "K" ? quality >= 50 + state.episode.distance * 0.45 : true;
      state.heroActionScore = quality;
      if (state.heroPosition === "K") {
        const outcome = finishPlay(state, made ? "field-goal" : "missed-field-goal", hero, made ? "Удар проходит между стойками." : "Удар уходит мимо створа.");
        outcome.kickDistance = state.episode.distance;
        return outcome;
      }
      const outcome = finishPlay(state, "punt", hero, "Пантер отправляет мяч в выбранную зону.");
      outcome.grossPuntYards = 45;
      outcome.puntReturnYards = 3;
      return outcome;
    }
    if (state.elapsed > 4) return finishPlay(state, state.heroPosition === "K" ? "missed-field-goal" : "punt", hero, "Спецкоманда завершает розыгрыш.");
    return undefined;
  }

  const offensePlayers = state.players.filter((player) => player.unit === "offense" && !player.down);
  const defensePlayers = state.players.filter((player) => player.unit === "defense" && !player.down);
  const carrierBeforeMovement = currentCarrier(state);

  for (const player of offensePlayers) {
    if (player.hasBall) continue;
    if (state.turnoverCommitted && carrierBeforeMovement) {
      // Do not trail a returner at the same speed. Offensive players take an
      // interception angle toward the return lane so a nearby player can
      // realistically finish the play before an automatic pick-six.
      const pursuitLead = clamp(distance(player, carrierBeforeMovement) * 0.18, 1.5, 5.5);
      const returnDirection = normalize(carrierBeforeMovement.vx, carrierBeforeMovement.vy);
      const pursuitTarget = {
        x: clamp(carrierBeforeMovement.x + returnDirection.x * pursuitLead, FIELD_MIN_X, FIELD_MAX_X),
        y: clamp(carrierBeforeMovement.y + returnDirection.y * pursuitLead, WORLD_MIN_Y, WORLD_MAX_Y),
      };
      moveToward(player, pursuitTarget, playerSpeed(player) * 1.08, dt);
      continue;
    }
    if (player.id === state.quarterbackId) continue;
    if (["run-block", "pass-protection", "kick-protection"].includes(player.kind)) {
      const manualHero = player.isHero && heroHasManualControl(player, input);
      if (manualHero) moveByInput(player, input, playerSpeed(player) * 0.75, dt);
      blockerStep(state, player, dt, player.isHero && !manualHero);
    } else if (player.kind === "route" || player.kind === "carry" || player.kind === "handoff") {
      const manualHero = player.isHero && heroHasManualControl(player, input);
      if (manualHero) {
        const boost = player.actionMode === "burst" ? 1.18 : player.actionMode === "cut" ? 1.1 : 1;
        moveByInput(player, input, playerSpeed(player) * boost, dt);
        sampleHeroMovement(state, player);
      } else offensiveRouteStep(state, player, dt);
    }
  }

  if (offenseCallForEpisode(state.episode).playType === "run" && !state.runCommitted && state.ball.state === "carried" && state.ball.carrierId === state.quarterbackId && state.elapsed > 0.48) {
    const runner = state.intendedRunnerId ? state.players.find((player) => player.id === state.intendedRunnerId) : undefined;
    if (runner) {
      setCarrier(state, runner);
      state.heroTouchedPlay = state.heroTouchedPlay || runner.isHero;
      event(state, "handoff", `Передача мяча ${runner.slot}`, runner.x, runner.y, qb?.id, runner.id);
    }
  }

  const carrier = currentCarrier(state);
  if (carrier) {
    if (carrier.id === state.quarterbackId && !state.turnoverCommitted && !state.runCommitted) quarterbackStep(state, carrier, input, dt);
    else carrierStep(state, carrier, input, dt);
    if (state.ball.state === "carried") {
      state.ball.x = carrier.x;
      state.ball.y = carrier.y;
      state.ball.z = 0;
    }
  }

  for (const player of defensePlayers) defenderStep(state, player, input, dt);
  separatePlayers(state);

  const activeCarrier = currentCarrier(state);
  if (activeCarrier) {
    const offensiveTouchdown = activeCarrier.unit === "offense" && activeCarrier.y <= offenseGoalWorldY(state);
    const defensiveTouchdown = activeCarrier.unit === "defense" && state.turnoverCommitted && activeCarrier.y >= defenseGoalWorldY(state);
    if (offensiveTouchdown) return finishPlay(state, "touchdown", activeCarrier, "Игрок пересекает линию зачётной зоны.");
    if (defensiveTouchdown) return finishPlay(state, "defensive-touchdown", activeCarrier, "Защитник возвращает перехват в зачётную зону.", true);
    if (activeCarrier.x <= FIELD_MIN_X + 0.15 || activeCarrier.x >= FIELD_MAX_X - 0.15) {
      event(state, "out-of-bounds", `${activeCarrier.slot} выходит за боковую`, activeCarrier.x, activeCarrier.y, activeCarrier.id);
      const quarterbackBehindLine = activeCarrier.id === state.quarterbackId && !state.turnoverCommitted && activeCarrier.y >= state.lineOfScrimmage;
      return finishPlay(state, state.turnoverCommitted ? "turnover" : quarterbackBehindLine ? "sack" : state.passCompleted ? "completion" : "run", activeCarrier, "Игрок выходит за боковую, розыгрыш завершён.", state.turnoverCommitted);
    }
    const tacklers = state.players.filter((player) => player.unit !== activeCarrier.unit && !player.down);
    for (const defender of tacklers) {
      const result = tackleCarrier(state, defender, activeCarrier);
      if (result) return result;
    }
  }

  if (state.ball.state === "flight") {
    state.ball.flightElapsed += dt;
    const progress = clamp(state.ball.flightElapsed / state.ball.flightDuration, 0, 1);
    state.ball.x = state.ball.startX + (state.ball.targetX - state.ball.startX) * progress;
    state.ball.y = state.ball.startY + (state.ball.targetY - state.ball.startY) * progress;
    state.ball.z = Math.sin(progress * Math.PI) * (4 + state.ball.flightDuration * 2.5);
    const flightOutcome = resolveBallFlight(state);
    if (flightOutcome) return flightOutcome;
  }

  if (qb && state.ball.state === "carried" && state.ball.carrierId === qb.id) {
    const rusher = nearestPlayer(state, qb, (candidate) => candidate.unit === "defense" && ["rush", "contain", "run-fit"].includes(candidate.kind));
    if (rusher && distance(qb, rusher) < 5.2) {
      state.pressureOccurred = true;
      if (!state.events.some((entry) => entry.type === "pressure")) event(state, "pressure", "Карман начинает сжиматься", qb.x, qb.y, rusher.id, qb.id);
    }
  }

  if (state.elapsed > 15.5) {
    if (activeCarrier) {
      const result = state.turnoverCommitted ? "turnover" : activeCarrier.id === state.quarterbackId && activeCarrier.y >= state.lineOfScrimmage ? "sack" : state.passCompleted ? "completion" : "run";
      return finishPlay(state, result, activeCarrier, "Розыгрыш заканчивается по свистку.", state.turnoverCommitted);
    }
    return finishPlay(state, "incomplete", undefined, "Розыгрыш заканчивается без завершённой передачи.");
  }
  return undefined;
}

export function createLivePlayEngine(episode: MatchEpisode, heroPosition: FootballPosition, seedText: string): LivePlayEngineState {
  const offense = episode.assignments.filter((assignment) => assignment.unit === "offense");
  const snapLine = episode.assignments.filter((assignment) => assignment.slot === "C" || assignment.slot === "LS");
  const offensiveLine = offense.filter((assignment) => ["run-block", "pass-protection"].includes(assignment.kind) || assignment.slot === "C");
  const lineOfScrimmage = snapLine.length > 0
    ? snapLine.reduce((sum, assignment) => sum + assignment.start.y, 0) / snapLine.length
    : offensiveLine.length > 0
      ? offensiveLine.reduce((sum, assignment) => sum + assignment.start.y, 0) / offensiveLine.length
      : offense.length > 0
        ? offense.reduce((sum, assignment) => sum + assignment.start.y, 0) / offense.length
        : 60;
  const offenseCall = offenseCallForEpisode(episode);
  const seed = hashSeed(seedText);
  const players: LivePlayerState[] = episode.assignments.map((assignment) => {
    const state: LivePlayerState = {
      id: assignment.playerId ?? assignment.id,
      assignmentId: assignment.id,
      slot: assignment.slot,
      position: assignment.position,
      label: assignment.label,
      side: assignment.side,
      unit: assignment.unit,
      isHero: assignment.isHero,
      kind: assignment.kind,
      task: assignment.task,
      overall: assignment.overall ?? 65,
      x: assignment.start.x,
      y: assignment.start.y,
      vx: 0,
      vy: 0,
      facingX: 0,
      facingY: -1,
      startX: assignment.start.x,
      startY: assignment.start.y,
      route: routeFor(assignment.kind, assignment.start, assignment.end, assignment.slot, offenseCall),
      routeIndex: 0,
      hasBall: false,
      down: false,
      blockedUntil: 0,
      engagementUntil: 0,
      blockEngagements: 0,
      rushWon: false,
      autoCutDirection: 0,
      autoCutUntil: 0,
      tackleCooldownUntil: 0,
      ballReactionDelay: assignment.unit === "defense" ? clamp(0.12 + (82 - (assignment.overall ?? 65)) * 0.006, 0.08, 0.34) : 0,
      actionBoostUntil: 0,
    };
    if (assignment.matchupSlot) state.matchupSlot = assignment.matchupSlot;
    return state;
  });
  const quarterbackPlayer = players.find((player) => player.unit === "offense" && player.slot === "QB") ?? players.find((player) => player.unit === "offense" && player.kind === "pass-read");
  const runner = playerBySlot({ players } as LivePlayEngineState, offenseCall.primarySlot ?? "RB", "offense") ?? players.find((player) => player.unit === "offense" && player.kind === "carry");
  const snapper = players.find((player) => player.unit === "offense" && (player.slot === "C" || player.slot === "LS"));
  const ballOrigin = snapper ?? quarterbackPlayer ?? players.find((player) => player.isHero) ?? players[0];
  const state: LivePlayEngineState = {
    version: 1,
    seed,
    randomState: seed,
    phase: "pre-snap",
    elapsed: 0,
    episode,
    heroPosition,
    players,
    ball: {
      x: ballOrigin?.x ?? 50,
      y: ballOrigin?.y ?? lineOfScrimmage,
      z: 0,
      state: "dead",
      startX: ballOrigin?.x ?? 50,
      startY: ballOrigin?.y ?? lineOfScrimmage,
      targetX: ballOrigin?.x ?? 50,
      targetY: ballOrigin?.y ?? lineOfScrimmage,
      flightElapsed: 0,
      flightDuration: 0,
      throwQuality: 0,
      throwStartedAt: 0,
    },
    lineOfScrimmage,
    firstDownY: clamp(lineOfScrimmage - episode.distance * YARDS_TO_FIELD, WORLD_MIN_Y, WORLD_MAX_Y),
    offenseSide: episode.possession,
    pressureOccurred: false,
    runCommitted: false,
    passCompleted: false,
    passAttempted: false,
    turnoverCommitted: false,
    heroActionScore: 55,
    heroTouchedPlay: false,
    heroRouteDeviationTotal: 0,
    heroRouteSamples: 0,
    heroSeparationTotal: 0,
    heroSeparationSamples: 0,
    heroCoverageTotal: 0,
    heroCoverageSamples: 0,
    qbDecisionQuality: 0,
    qbTimeToThrow: 0,
    qbEscapeDirection: 0,
    heroOpenWindowSeen: false,
    heroOpenWindowTargeted: false,
    heroBestSeparation: 0,
    events: [],
  };
  if (quarterbackPlayer) state.quarterbackId = quarterbackPlayer.id;
  if (runner) state.intendedRunnerId = runner.id;
  return state;
}

export function issueLivePlayCommand(state: LivePlayEngineState, command: LivePlayCommand): void {
  if (state.phase === "whistle") return;
  const hero = state.players.find((player) => player.isHero);
  if (command.type === "snap") {
    if (state.phase !== "pre-snap") return;
    state.phase = "live";
    state.elapsed = 0;
    state.ball.state = "snap";
    event(state, "snap", "Снэп", state.ball.x, state.ball.y);
    return;
  }
  if (state.phase === "pre-snap" || !hero || hero.down) return;
  if (command.type === "throw") {
    const qb = quarterback(state);
    const target = state.players.find((player) => player.id === command.targetId && player.unit === "offense");
    if (qb?.isHero && target) startPass(state, qb, target);
    return;
  }
  if (command.type === "run") {
    if (hero.id === state.quarterbackId && state.ball.state === "carried" && state.ball.carrierId === hero.id) {
      state.runCommitted = true;
      hero.actionMode = "burst";
      hero.actionBoostUntil = state.elapsed + 1.2;
    }
    return;
  }
  if (command.type === "throw-away") {
    if (hero.id === state.quarterbackId && hero.y >= state.lineOfScrimmage - 0.2 && state.ball.carrierId === hero.id) {
      state.passAttempted = true;
      state.heroActionScore -= state.pressureOccurred ? 1 : 7;
      finishPlay(state, "incomplete", undefined, "QB выбрасывает мяч за боковую, сохраняя владение.");
    }
    return;
  }
  if (command.type === "kick") {
    hero.actionMode = "power";
    hero.actionBoostUntil = state.elapsed + 0.5;
    return;
  }
  hero.actionMode = command.type;
  hero.actionBoostUntil = state.elapsed + (command.type === "secure" || command.type === "anchor" ? 1.1 : 0.7);
  state.heroTouchedPlay = true;
}

export function stepLivePlayEngine(state: LivePlayEngineState, input: LiveControlInput, deltaSeconds: number): MatchLivePlayOutcome | undefined {
  if (state.phase === "pre-snap" || state.phase === "whistle") return state.outcome;
  const dt = clamp(deltaSeconds, 0, 0.05) * LIVE_TIME_SCALE;
  state.elapsed += dt;
  for (const player of state.players) {
    if (player.actionMode && state.elapsed > player.actionBoostUntil) delete player.actionMode;
  }
  return liveStep(state, input, dt);
}

export function liveReceiverTargets(state: LivePlayEngineState): LivePlayerState[] {
  return state.players.filter((player) => player.unit === "offense" && player.kind === "route" && !player.down);
}

export function encodeLivePlayOutcome(outcome: MatchLivePlayOutcome): string {
  return `${LIVE_PREFIX}${encodeURIComponent(JSON.stringify(outcome))}`;
}

export function decodeLivePlayOutcome(value: string): MatchLivePlayOutcome | undefined {
  if (!value.startsWith(LIVE_PREFIX)) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice(LIVE_PREFIX.length))) as Partial<MatchLivePlayOutcome>;
    if (
      parsed.version !== 1
      || typeof parsed.snapResult !== "string"
      || typeof parsed.yards !== "number"
      || typeof parsed.assignmentScore !== "number"
      || typeof parsed.statDelta !== "object"
      || typeof parsed.advancedDelta !== "object"
    ) return undefined;
    return parsed as MatchLivePlayOutcome;
  } catch {
    return undefined;
  }
}

export function liveRoleActions(position: FootballPosition): Array<{ id: LivePlayCommand["type"]; label: string }> {
  if (position === "QB") return [{ id: "run", label: "Бежать" }, { id: "throw-away", label: "Выбросить" }];
  if (position === "RB") return [{ id: "burst", label: "Рывок" }, { id: "cut", label: "Финт" }, { id: "secure", label: "Закрыть мяч" }];
  if (position === "WR" || position === "TE") return [{ id: "burst", label: "Ускориться" }, { id: "cut", label: "Срезать" }, { id: "secure", label: "Ловить" }];
  if (position === "OT" || position === "OG" || position === "C") return [{ id: "power", label: "Силовой блок" }, { id: "anchor", label: "Якорь" }];
  if (position === "EDGE" || position === "DT") return [{ id: "speed", label: "Speed rush" }, { id: "power", label: "Power rush" }];
  if (position === "LB" || position === "CB" || position === "S") return [{ id: "break", label: "К мячу" }, { id: "tackle", label: "Тэкл" }, { id: "intercept", label: "Перехват" }];
  return [{ id: "kick", label: position === "K" ? "Удар" : "Пант" }];
}
