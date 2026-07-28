import type { FootballPosition } from "../career/types";
import type {
  MatchAdvancedStatLine,
  MatchEpisode,
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
  tackleCooldownUntil: number;
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
}

export interface LivePlayEvent {
  id: string;
  type: "snap" | "handoff" | "pressure" | "throw" | "catch" | "drop" | "breakup" | "interception" | "tackle" | "sack" | "touchdown" | "whistle";
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
  heroActionScore: number;
  heroTouchedPlay: boolean;
  events: LivePlayEvent[];
  outcome?: MatchLivePlayOutcome;
}

const LIVE_PREFIX = "live-play:";
const FIELD_MIN_X = 4;
const FIELD_MAX_X = 96;
const FIELD_MIN_Y = 4;
const FIELD_MAX_Y = 96;
const YARDS_TO_FIELD = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(left: Pick<LivePlayerState, "x" | "y"> | MatchPoint, right: Pick<LivePlayerState, "x" | "y"> | MatchPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
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
    const depth = checkdown ? 5 : deep ? 28 : quick ? 8 : call.playType === "play-action" ? 17 : 14;
    const finalY = clamp(start.y - depth, FIELD_MIN_Y, FIELD_MAX_Y);
    if (concept.includes("mesh") && (slot === "H" || slot === "Y")) {
      const crossX = slot === "H" ? 72 : 28;
      return [
        { x: start.x, y: clamp(start.y - 5, FIELD_MIN_Y, FIELD_MAX_Y) },
        { x: crossX, y: finalY },
        { x: clamp(crossX + (slot === "H" ? 8 : -8), FIELD_MIN_X, FIELD_MAX_X), y: finalY },
      ];
    }
    const finalX = clamp(start.x + horizontal, FIELD_MIN_X, FIELD_MAX_X);
    const stem = { x: start.x, y: clamp(start.y - depth * 0.58, FIELD_MIN_Y, FIELD_MAX_Y) };
    const breakPoint = Math.abs(horizontal) > 6
      ? { x: clamp(start.x + horizontal * 0.62, FIELD_MIN_X, FIELD_MAX_X), y: finalY }
      : { x: clamp(start.x + (slot === "H" || slot === "Y" ? 2 : -2), FIELD_MIN_X, FIELD_MAX_X), y: clamp(start.y - depth * 0.82, FIELD_MIN_Y, FIELD_MAX_Y) };
    return [stem, breakPoint, { x: finalX, y: finalY }];
  }
  if (kind === "carry" || kind === "handoff") {
    const runDepth = call.tags.includes("goal-line") ? 6 : 13;
    return [
      { x: clamp(start.x + horizontal * 0.2, FIELD_MIN_X, FIELD_MAX_X), y: clamp(start.y - 2, FIELD_MIN_Y, FIELD_MAX_Y) },
      { x: clamp(start.x + horizontal * 0.7, FIELD_MIN_X, FIELD_MAX_X), y: clamp(start.y - runDepth * 0.55, FIELD_MIN_Y, FIELD_MAX_Y) },
      { x: clamp(end.x, FIELD_MIN_X, FIELD_MAX_X), y: clamp(start.y - runDepth, FIELD_MIN_Y, FIELD_MAX_Y) },
    ];
  }
  return [{ x: clamp(end.x, FIELD_MIN_X, FIELD_MAX_X), y: clamp(end.y, FIELD_MIN_Y, FIELD_MAX_Y) }];
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
  return base * (0.78 + player.overall / 350);
}

function moveToward(player: LivePlayerState, target: MatchPoint, speed: number, dt: number): void {
  const direction = normalize(target.x - player.x, target.y - player.y);
  player.vx = direction.x * speed;
  player.vy = direction.y * speed;
  player.facingX = direction.x;
  player.facingY = direction.y;
  player.x = clamp(player.x + player.vx * dt, FIELD_MIN_X, FIELD_MAX_X);
  player.y = clamp(player.y + player.vy * dt, FIELD_MIN_Y, FIELD_MAX_Y);
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
  player.y = clamp(player.y + player.vy * dt, FIELD_MIN_Y, FIELD_MAX_Y);
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

function openScore(state: LivePlayEngineState, receiver: LivePlayerState): number {
  const defender = nearestPlayer(state, receiver, (candidate) => candidate.unit === "defense");
  const separation = defender ? distance(receiver, defender) : 12;
  return separation * 8 + receiver.overall * 0.35 - Math.abs(receiver.x - 50) * 0.12;
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
  if (state.ball.state !== "carried" || state.ball.carrierId !== thrower.id || thrower.y < state.lineOfScrimmage - 0.2) return;
  const pressure = nearestPlayer(state, thrower, (candidate) => candidate.unit === "defense" && ["rush", "contain", "run-fit"].includes(candidate.kind));
  const pressureDistance = pressure ? distance(thrower, pressure) : 20;
  const lead = clamp((target.overall - 55) * 0.018 + 0.58, 0.45, 1.15);
  const targetX = clamp(target.x + target.vx * lead, FIELD_MIN_X, FIELD_MAX_X);
  const targetY = clamp(target.y + target.vy * lead, FIELD_MIN_Y, FIELD_MAX_Y);
  const airDistance = Math.hypot(targetX - thrower.x, targetY - thrower.y);
  const quality = clamp(72 + thrower.overall * 0.22 - Math.max(0, 5 - pressureDistance) * 7 - Math.abs(thrower.vx) * 0.7 - Math.abs(thrower.vy) * 0.5, 20, 99);
  state.players.forEach((candidate) => { candidate.hasBall = false; });
  state.passAttempted = true;
  state.passTargetId = target.id;
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
    } else if (carrier?.id === hero.id) {
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

  if (snapResult === "touchdown" && (carrier?.id === hero.id || target?.id === hero.id || state.heroPosition === "QB" && state.passAttempted)) {
    stats.touchdowns = 1;
  }
  return { stats, advanced, involved };
}

function finishPlay(
  state: LivePlayEngineState,
  snapResult: MatchSnapResult,
  carrier: LivePlayerState | undefined,
  description: string,
  turnover = false,
): MatchLivePlayOutcome {
  const spotY = carrier?.y ?? state.ball.y;
  const rawYards = (state.lineOfScrimmage - spotY) / YARDS_TO_FIELD;
  let yards = Math.round(rawYards);
  if (snapResult === "incomplete" || snapResult === "turnover" && !carrier || snapResult === "field-goal" || snapResult === "missed-field-goal") yards = 0;
  if (snapResult === "punt") yards = 42;
  const touchdown = snapResult === "touchdown";
  if (touchdown) yards = Math.max(0, 100 - state.episode.fieldPosition);
  const carrierImpact = carrier?.isHero ? clamp(yards, -10, 20) * 1.2 : 0;
  const actionScore = clamp(state.heroActionScore + (state.heroTouchedPlay ? 8 : 0) + carrierImpact, 20, 98);
  const teamExecution = clamp(52 + yards * 2.1 + (snapResult === "completion" ? 10 : 0) + (touchdown ? 24 : 0) - (turnover ? 28 : 0), 12, 99);
  const targetId = state.passTargetId ?? state.ball.targetId;
  const target = targetId ? state.players.find((player) => player.id === targetId) : undefined;
  const exact = exactHeroDeltas(state, snapResult, yards, turnover, target, carrier, actionScore);
  const points = snapResult === "field-goal" ? 3 : touchdown ? 7 : 0;
  const scoringSide = points > 0 ? state.offenseSide : undefined;
  const outcome: MatchLivePlayOutcome = {
    version: 1,
    actionId: `live-${state.heroPosition.toLowerCase()}`,
    snapResult,
    yards,
    points,
    turnover,
    teamExecutionScore: teamExecution,
    assignmentScore: actionScore,
    pressureOccurred: state.pressureOccurred,
    elapsedSeconds: Math.max(1, Math.round(state.elapsed)),
    description,
    heroInvolved: exact.involved,
    statDelta: exact.stats,
    advancedDelta: exact.advanced,
    events: state.events,
  };
  if (scoringSide) outcome.scoringSide = scoringSide;
  if (target) outcome.targetSlot = target.slot;
  if (carrier) outcome.ballCarrierSlot = carrier.slot;
  state.phase = "whistle";
  state.outcome = outcome;
  event(state, touchdown ? "touchdown" : "whistle", description, carrier?.x ?? state.ball.x, carrier?.y ?? state.ball.y, carrier?.id);
  return outcome;
}

function resolveCatch(state: LivePlayEngineState): MatchLivePlayOutcome | undefined {
  const target = state.ball.targetId ? state.players.find((player) => player.id === state.ball.targetId) : undefined;
  const catchPoint = { x: state.ball.targetX, y: state.ball.targetY };
  const offense = state.players.filter((player) => player.unit === "offense" && !player.down).sort((left, right) => distance(left, catchPoint) - distance(right, catchPoint));
  const defense = state.players.filter((player) => player.unit === "defense" && !player.down).sort((left, right) => distance(left, catchPoint) - distance(right, catchPoint));
  const receiver = target ?? offense[0];
  const defender = defense[0];
  const receiverDistance = receiver ? distance(receiver, catchPoint) : 99;
  const defenderDistance = defender ? distance(defender, catchPoint) : 99;
  const defenderPlayingBall = defender?.actionMode === "intercept" || defender?.actionMode === "break";
  const receiverSecure = receiver?.actionMode === "secure";
  const contestEdge = (defender?.overall ?? 55) - (receiver?.overall ?? 55) + (defenderPlayingBall ? 9 : 0) - (receiverSecure ? 8 : 0) + (defenderDistance - receiverDistance) * -7;
  const roll = random(state) * 100;

  if (defender && defenderDistance <= 3.4 && contestEdge + roll * 0.25 > 28 && state.ball.throwQuality < 86) {
    if (contestEdge + roll * 0.18 > 40) {
      setCarrier(state, defender);
      state.heroActionScore += defender.isHero ? 30 : target?.isHero ? -24 : 0;
      event(state, "interception", `${defender.slot} перехватывает мяч`, defender.x, defender.y, defender.id, receiver?.id);
      return finishPlay(state, "turnover", defender, "Защитник читает бросок и забирает мяч.", true);
    }
    state.heroActionScore += defender.isHero ? 18 : target?.isHero ? -12 : 0;
    event(state, "breakup", `${defender.slot} сбивает передачу`, defender.x, defender.y, defender.id, receiver?.id);
    return finishPlay(state, "incomplete", undefined, "Защитник успевает на мяч и разбивает передачу.");
  }

  const catchChance = clamp(state.ball.throwQuality + (receiver?.overall ?? 55) * 0.28 - receiverDistance * 9 - Math.max(0, 3.2 - defenderDistance) * 7 + (receiverSecure ? 9 : 0), 12, 98);
  if (receiver && roll <= catchChance) {
    state.passCompleted = true;
    setCarrier(state, receiver);
    state.heroTouchedPlay = state.heroTouchedPlay || receiver.isHero;
    state.heroActionScore += receiver.isHero ? 16 : state.heroPosition === "QB" ? 12 : 0;
    event(state, "catch", `${receiver.slot} принимает передачу`, receiver.x, receiver.y, receiver.id);
    return undefined;
  }

  state.heroActionScore += receiver?.isHero || state.heroPosition === "QB" ? -12 : 0;
  event(state, "drop", "Передача не завершена", catchPoint.x, catchPoint.y, receiver?.id);
  return finishPlay(state, "incomplete", undefined, "Мяч касается рук, но приём не завершён.");
}

function tackleCarrier(state: LivePlayEngineState, defender: LivePlayerState, carrier: LivePlayerState): MatchLivePlayOutcome | undefined {
  if (state.elapsed < defender.tackleCooldownUntil || distance(defender, carrier) > 2.45) return undefined;
  defender.tackleCooldownUntil = state.elapsed + 0.65;
  const userBonus = defender.isHero && defender.actionMode === "tackle" ? 14 : 0;
  const secureBonus = carrier.actionMode === "secure" ? 13 : 0;
  const burstPenalty = carrier.actionMode === "cut" ? 11 : carrier.actionMode === "burst" ? 5 : 0;
  const angle = normalize(carrier.vx, carrier.vy);
  const pursuit = normalize(defender.x - carrier.x, defender.y - carrier.y);
  const angleBonus = Math.max(-5, (angle.x * pursuit.x + angle.y * pursuit.y) * 8);
  const chance = clamp(58 + (defender.overall - carrier.overall) * 0.8 + userBonus + angleBonus - secureBonus - burstPenalty, 18, 94);
  if (random(state) * 100 > chance) {
    state.heroActionScore += defender.isHero ? -8 : carrier.isHero ? 8 : 0;
    defender.x = clamp(defender.x - defender.facingX * 1.4, FIELD_MIN_X, FIELD_MAX_X);
    defender.y = clamp(defender.y - defender.facingY * 1.4, FIELD_MIN_Y, FIELD_MAX_Y);
    return undefined;
  }
  carrier.down = true;
  const isQuarterback = carrier.id === state.quarterbackId;
  const sack = isQuarterback && carrier.y >= state.lineOfScrimmage;
  state.heroActionScore += defender.isHero ? 22 : carrier.isHero ? -15 : 0;
  event(state, sack ? "sack" : "tackle", sack ? `${defender.slot} делает сэк` : `${defender.slot} завершает тэкл`, carrier.x, carrier.y, defender.id, carrier.id);
  return finishPlay(state, sack ? "sack" : state.passCompleted ? "completion" : "run", carrier, sack ? "Карман закрывается, квотербек остановлен за линией скримиджа." : "Защитник фиксирует захват и завершает розыгрыш.");
}

function offensiveRouteStep(state: LivePlayEngineState, player: LivePlayerState, dt: number): void {
  if (player.hasBall) return;
  const target = player.route[player.routeIndex];
  if (!target) {
    const qb = quarterback(state);
    const escape = qb && Math.abs(qb.x - qb.startX) > 5
      ? { x: clamp(qb.x + (player.x < qb.x ? -8 : 8), FIELD_MIN_X, FIELD_MAX_X), y: clamp(player.y - 4, FIELD_MIN_Y, FIELD_MAX_Y) }
      : { x: player.x, y: clamp(player.y - 2, FIELD_MIN_Y, FIELD_MAX_Y) };
    moveToward(player, escape, playerSpeed(player) * 0.7, dt);
    return;
  }
  moveToward(player, target, playerSpeed(player) * (player.actionMode === "burst" ? 1.18 : 1), dt);
  if (player.isHero) {
    const defender = nearestPlayer(state, player, (candidate) => candidate.unit === "defense");
    const separation = defender ? distance(player, defender) : 8;
    state.heroActionScore += clamp(separation - 2.2, -2, 5) * dt * 1.25;
  }
  if (distance(player, target) < 1.2) player.routeIndex += 1;
}

function blockerStep(state: LivePlayEngineState, blocker: LivePlayerState, dt: number): void {
  const matched = playerBySlot(state, blocker.matchupSlot, "defense");
  const target = matched && !matched.down ? matched : nearestPlayer(state, blocker, (candidate) => candidate.unit === "defense" && ["rush", "contain", "run-fit"].includes(candidate.kind));
  if (!target) return;
  const contact = distance(blocker, target);
  if (contact > 2.5) {
    if (!blocker.isHero) moveToward(blocker, target, playerSpeed(blocker) * 0.75, dt);
    return;
  }
  const powerBonus = blocker.actionMode === "power" ? 13 : blocker.actionMode === "anchor" ? 9 : 0;
  const rushBonus = target.actionMode === "power" ? 13 : target.actionMode === "speed" ? 7 : 0;
  const edge = blocker.overall + powerBonus - target.overall - rushBonus;
  const hold = clamp(0.2 + edge * 0.012, 0.08, 0.55);
  target.blockedUntil = Math.max(target.blockedUntil, state.elapsed + hold);
  target.vx *= 0.25;
  target.vy *= 0.25;
  if (blocker.isHero) {
    state.heroTouchedPlay = true;
    state.heroActionScore += edge >= -4 ? dt * 5.4 : -dt * 3.2;
  }
}

function defenderStep(state: LivePlayEngineState, player: LivePlayerState, input: LiveControlInput, dt: number): void {
  if (player.down) return;
  if (player.isHero) {
    const boost = player.actionMode === "speed" ? 1.2 : player.actionMode === "break" || player.actionMode === "tackle" || player.actionMode === "intercept" ? 1.13 : 1;
    moveByInput(player, input, playerSpeed(player) * boost, dt);
    if (player.kind === "man-coverage" && player.matchupSlot) {
      const target = playerBySlot(state, player.matchupSlot, "offense");
      if (target) state.heroActionScore += clamp(3.8 - distance(player, target), -3, 3) * dt * 1.2;
    }
    return;
  }
  if (state.elapsed < player.blockedUntil) return;
  const carrier = currentCarrier(state);
  const qb = quarterback(state);
  let target: MatchPoint | LivePlayerState;
  if (state.ball.state === "flight") {
    target = { x: state.ball.targetX, y: state.ball.targetY };
  } else if (carrier && (carrier.id !== qb?.id || state.runCommitted || carrier.y < state.lineOfScrimmage - 0.5)) {
    target = carrier;
  } else if (["rush", "contain", "run-fit"].includes(player.kind)) {
    target = carrier ?? qb ?? { x: 50, y: state.lineOfScrimmage + 7 };
  } else if (player.kind === "man-coverage") {
    target = playerBySlot(state, player.matchupSlot, "offense") ?? { x: player.x, y: player.y - 1 };
  } else {
    const threat = nearestPlayer(state, player, (candidate) => candidate.unit === "offense" && candidate.kind === "route");
    const zone = player.route[player.routeIndex] ?? { x: player.startX, y: player.startY - 6 };
    target = threat && distance(player, threat) < 12 ? threat : zone;
  }
  moveToward(player, target, playerSpeed(player) * (["rush", "contain"].includes(player.kind) ? 1.02 : 0.92), dt);
}

function quarterbackStep(state: LivePlayEngineState, player: LivePlayerState, input: LiveControlInput, dt: number): void {
  if (player.isHero) {
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
  const receivers = state.players.filter((candidate) => candidate.unit === "offense" && candidate.kind === "route" && !candidate.down);
  const best = [...receivers].sort((left, right) => openScore(state, right) - openScore(state, left))[0];
  if (best && state.elapsed > 1.15 && (openScore(state, best) > 42 || pressureDistance < 4.2 || state.elapsed > 3.6)) {
    startPass(state, player, best);
    return;
  }
  const dropTarget = pressureDistance < 4.7 && rusher
    ? { x: clamp(player.x + (player.x - rusher.x) * 0.8, 20, 80), y: clamp(player.y - 1.5, state.lineOfScrimmage - 5, state.lineOfScrimmage + 12) }
    : { x: player.startX, y: player.startY + 6 };
  moveToward(player, dropTarget, playerSpeed(player) * 0.72, dt);
  if (state.elapsed > 4.2 && pressureDistance < 5) state.runCommitted = true;
}

function carrierStep(state: LivePlayEngineState, carrier: LivePlayerState, input: LiveControlInput, dt: number): void {
  if (carrier.isHero) {
    const boost = carrier.actionMode === "burst" ? 1.2 : carrier.actionMode === "cut" ? 1.1 : carrier.actionMode === "secure" ? 0.9 : 1;
    moveByInput(carrier, input, playerSpeed(carrier) * boost, dt);
  } else {
    const defenders = state.players.filter((player) => player.unit === "defense" && !player.down);
    const closest = [...defenders].sort((left, right) => distance(carrier, left) - distance(carrier, right))[0];
    const routeTarget = carrier.route[carrier.routeIndex] ?? { x: carrier.x, y: FIELD_MIN_Y };
    const avoidX = closest && distance(carrier, closest) < 6 ? clamp(carrier.x + (carrier.x <= closest.x ? -6 : 6), FIELD_MIN_X, FIELD_MAX_X) : routeTarget.x;
    moveToward(carrier, { x: avoidX, y: routeTarget.y }, playerSpeed(carrier) * 1.02, dt);
    if (distance(carrier, routeTarget) < 1.2) carrier.routeIndex += 1;
  }
  state.ball.x = carrier.x;
  state.ball.y = carrier.y;
  state.ball.z = 0;
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
  const carrier = currentCarrier(state);

  for (const player of offensePlayers) {
    if (player.id === state.quarterbackId) quarterbackStep(state, player, input, dt);
    else if (player.hasBall) carrierStep(state, player, input, dt);
    else if (["run-block", "pass-protection", "kick-protection"].includes(player.kind)) {
      if (player.isHero) moveByInput(player, input, playerSpeed(player) * 0.75, dt);
      blockerStep(state, player, dt);
    } else if (player.kind === "route" || player.kind === "carry" || player.kind === "handoff") {
      if (player.isHero && !player.hasBall) {
        const boost = player.actionMode === "burst" ? 1.18 : player.actionMode === "cut" ? 1.1 : 1;
        moveByInput(player, input, playerSpeed(player) * boost, dt);
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

  for (const player of defensePlayers) defenderStep(state, player, input, dt);

  const activeCarrier = currentCarrier(state);
  if (activeCarrier) {
    if (activeCarrier.y <= FIELD_MIN_Y + 0.4) return finishPlay(state, "touchdown", activeCarrier, "Игрок пересекает линию зачётной зоны.");
    for (const defender of defensePlayers) {
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
    if (progress >= 1) return resolveCatch(state);
  }

  if (qb && state.ball.state === "carried" && state.ball.carrierId === qb.id) {
    const rusher = nearestPlayer(state, qb, (candidate) => candidate.unit === "defense" && ["rush", "contain", "run-fit"].includes(candidate.kind));
    if (rusher && distance(qb, rusher) < 5.2) {
      state.pressureOccurred = true;
      if (!state.events.some((entry) => entry.type === "pressure")) event(state, "pressure", "Карман начинает сжиматься", qb.x, qb.y, rusher.id, qb.id);
    }
  }

  if (state.elapsed > 10.5) {
    if (activeCarrier) return finishPlay(state, activeCarrier.id === state.quarterbackId && activeCarrier.y >= state.lineOfScrimmage ? "sack" : "run", activeCarrier, "Розыгрыш заканчивается по свистку.");
    return finishPlay(state, "incomplete", undefined, "Розыгрыш заканчивается без завершённой передачи.");
  }
  return undefined;
}

export function createLivePlayEngine(episode: MatchEpisode, heroPosition: FootballPosition, seedText: string): LivePlayEngineState {
  const offense = episode.assignments.filter((assignment) => assignment.unit === "offense");
  const offensiveLine = offense.filter((assignment) => ["run-block", "pass-protection"].includes(assignment.kind) || assignment.slot === "C");
  const lineOfScrimmage = offensiveLine.length > 0
    ? offensiveLine.reduce((sum, assignment) => sum + assignment.start.y, 0) / offensiveLine.length
    : offense.length > 0
      ? offense.reduce((sum, assignment) => sum + assignment.start.y, 0) / offense.length
      : 58;
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
      tackleCooldownUntil: 0,
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
    },
    lineOfScrimmage,
    firstDownY: clamp(lineOfScrimmage - episode.distance * YARDS_TO_FIELD, FIELD_MIN_Y, FIELD_MAX_Y),
    offenseSide: episode.possession,
    pressureOccurred: false,
    runCommitted: false,
    passCompleted: false,
    passAttempted: false,
    heroActionScore: 55,
    heroTouchedPlay: false,
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
  if (state.phase === "pre-snap" || !hero) return;
  if (command.type === "throw") {
    const qb = quarterback(state);
    const target = state.players.find((player) => player.id === command.targetId && player.unit === "offense");
    if (qb?.isHero && target) startPass(state, qb, target);
    return;
  }
  if (command.type === "run") {
    if (hero.id === state.quarterbackId) {
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
  const dt = clamp(deltaSeconds, 0, 0.05);
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
