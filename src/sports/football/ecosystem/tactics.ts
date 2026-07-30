import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition } from "../career/types";
import { FOOTBALL_ROSTER_POSITIONS } from "../team/positions";
import type { FootballRosterPosition } from "../team/types";
import type {
  EcosystemCoach,
  EcosystemDefenseSystem,
  EcosystemOffenseSystem,
  EcosystemPlayer,
  EcosystemPlayerArchetype,
  EcosystemPlayerTacticalProfile,
  EcosystemPositionRole,
  EcosystemRolePriority,
  EcosystemTacticalIdentity,
  EcosystemTeam,
} from "./types";

const ROLE_BY_POSITION: Record<FootballRosterPosition, readonly EcosystemPositionRole[]> = {
  QB: ["pocket-distributor", "dual-threat", "field-general"],
  RB: ["zone-runner", "power-back", "receiving-back"],
  WR: ["separator", "vertical-threat", "possession-target"],
  TE: ["inline-receiver", "seam-threat", "move-tight-end"],
  OT: ["blindside-anchor", "zone-tackle", "power-tackle"],
  OG: ["pull-guard", "phone-booth-guard", "zone-guard"],
  C: ["line-caller", "reach-center", "power-center"],
  EDGE: ["speed-rusher", "power-rusher", "edge-setter"],
  DT: ["nose-anchor", "interior-penetrator", "three-technique"],
  LB: ["run-anchor", "coverage-backer", "edge-blitzer"],
  CB: ["press-corner", "zone-corner", "ball-hawk"],
  S: ["box-safety", "center-fielder", "match-safety"],
  K: ["accuracy-kicker", "power-kicker", "clutch-kicker"],
  P: ["directional-punter", "hangtime-punter", "field-position-punter"],
};

const OFFENSE_STYLE_MAP: Array<[RegExp, EcosystemOffenseSystem]> = [
  [/air/i, "air-raid"],
  [/west/i, "west-coast"],
  [/power/i, "power-run"],
  [/option/i, "spread-option"],
];

const DEFENSE_STYLE_MAP: Array<[RegExp, EcosystemDefenseSystem]> = [
  [/4-2-5|quarters/i, "quarters-425"],
  [/3-4/i, "multiple-34"],
  [/4-3/i, "over-43"],
  [/nickel|match/i, "nickel-match"],
  [/man|pressure|blitz/i, "man-pressure"],
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function normalizedOffense(style: string): EcosystemOffenseSystem {
  return OFFENSE_STYLE_MAP.find(([pattern]) => pattern.test(style))?.[1] ?? "multiple";
}

function normalizedDefense(style: string): EcosystemDefenseSystem {
  return DEFENSE_STYLE_MAP.find(([pattern]) => pattern.test(style))?.[1] ?? "multiple-defense";
}

function pair(primary: EcosystemPositionRole, secondary: EcosystemPositionRole): EcosystemRolePriority {
  return { primary, secondary };
}

function offenseRoles(system: EcosystemOffenseSystem): Pick<EcosystemTacticalIdentity["positionRoles"], "QB" | "RB" | "WR" | "TE" | "OT" | "OG" | "C"> {
  if (system === "air-raid") {
    return {
      QB: pair("pocket-distributor", "field-general"),
      RB: pair("receiving-back", "zone-runner"),
      WR: pair("separator", "vertical-threat"),
      TE: pair("move-tight-end", "seam-threat"),
      OT: pair("blindside-anchor", "zone-tackle"),
      OG: pair("zone-guard", "pull-guard"),
      C: pair("line-caller", "reach-center"),
    };
  }
  if (system === "west-coast") {
    return {
      QB: pair("field-general", "pocket-distributor"),
      RB: pair("receiving-back", "zone-runner"),
      WR: pair("possession-target", "separator"),
      TE: pair("move-tight-end", "inline-receiver"),
      OT: pair("zone-tackle", "blindside-anchor"),
      OG: pair("zone-guard", "pull-guard"),
      C: pair("reach-center", "line-caller"),
    };
  }
  if (system === "power-run") {
    return {
      QB: pair("field-general", "pocket-distributor"),
      RB: pair("power-back", "zone-runner"),
      WR: pair("possession-target", "vertical-threat"),
      TE: pair("inline-receiver", "seam-threat"),
      OT: pair("power-tackle", "blindside-anchor"),
      OG: pair("phone-booth-guard", "pull-guard"),
      C: pair("power-center", "line-caller"),
    };
  }
  if (system === "spread-option") {
    return {
      QB: pair("dual-threat", "field-general"),
      RB: pair("zone-runner", "power-back"),
      WR: pair("vertical-threat", "separator"),
      TE: pair("move-tight-end", "inline-receiver"),
      OT: pair("zone-tackle", "power-tackle"),
      OG: pair("pull-guard", "zone-guard"),
      C: pair("reach-center", "line-caller"),
    };
  }
  return {
    QB: pair("field-general", "dual-threat"),
    RB: pair("zone-runner", "receiving-back"),
    WR: pair("separator", "possession-target"),
    TE: pair("seam-threat", "inline-receiver"),
    OT: pair("blindside-anchor", "zone-tackle"),
    OG: pair("pull-guard", "phone-booth-guard"),
    C: pair("line-caller", "power-center"),
  };
}

function defenseRoles(system: EcosystemDefenseSystem): Pick<EcosystemTacticalIdentity["positionRoles"], "EDGE" | "DT" | "LB" | "CB" | "S"> {
  if (system === "quarters-425") {
    return {
      EDGE: pair("edge-setter", "speed-rusher"),
      DT: pair("interior-penetrator", "three-technique"),
      LB: pair("coverage-backer", "run-anchor"),
      CB: pair("zone-corner", "ball-hawk"),
      S: pair("match-safety", "box-safety"),
    };
  }
  if (system === "multiple-34") {
    return {
      EDGE: pair("power-rusher", "edge-setter"),
      DT: pair("nose-anchor", "interior-penetrator"),
      LB: pair("edge-blitzer", "run-anchor"),
      CB: pair("press-corner", "zone-corner"),
      S: pair("box-safety", "center-fielder"),
    };
  }
  if (system === "over-43") {
    return {
      EDGE: pair("edge-setter", "power-rusher"),
      DT: pair("three-technique", "nose-anchor"),
      LB: pair("run-anchor", "coverage-backer"),
      CB: pair("zone-corner", "ball-hawk"),
      S: pair("center-fielder", "box-safety"),
    };
  }
  if (system === "nickel-match") {
    return {
      EDGE: pair("speed-rusher", "edge-setter"),
      DT: pair("interior-penetrator", "three-technique"),
      LB: pair("coverage-backer", "edge-blitzer"),
      CB: pair("zone-corner", "press-corner"),
      S: pair("match-safety", "center-fielder"),
    };
  }
  if (system === "man-pressure") {
    return {
      EDGE: pair("speed-rusher", "power-rusher"),
      DT: pair("interior-penetrator", "nose-anchor"),
      LB: pair("edge-blitzer", "coverage-backer"),
      CB: pair("press-corner", "ball-hawk"),
      S: pair("box-safety", "match-safety"),
    };
  }
  return {
    EDGE: pair("edge-setter", "speed-rusher"),
    DT: pair("nose-anchor", "three-technique"),
    LB: pair("run-anchor", "coverage-backer"),
    CB: pair("zone-corner", "press-corner"),
    S: pair("center-fielder", "box-safety"),
  };
}

export function positionRoleLabel(role: EcosystemPositionRole): string {
  const labels: Record<EcosystemPositionRole, string> = {
    "pocket-distributor": "карманный распасовщик",
    "dual-threat": "двойная угроза",
    "field-general": "управляющий нападением",
    "zone-runner": "раннер зонной схемы",
    "power-back": "силовой раннер",
    "receiving-back": "раннер-принимающий",
    separator: "сепаратор",
    "vertical-threat": "глубинная угроза",
    "possession-target": "надёжная цель",
    "inline-receiver": "инлайн тайт-энд",
    "seam-threat": "угроза по шву",
    "move-tight-end": "мобильный тайт-энд",
    "blindside-anchor": "якорь слепой стороны",
    "zone-tackle": "тэкл зонной схемы",
    "power-tackle": "силовой тэкл",
    "pull-guard": "выходящий гард",
    "phone-booth-guard": "силовой гард",
    "zone-guard": "гард зонной схемы",
    "line-caller": "координатор линии",
    "reach-center": "мобильный центр",
    "power-center": "силовой центр",
    "speed-rusher": "скоростной раш",
    "power-rusher": "силовой раш",
    "edge-setter": "контроль края",
    "nose-anchor": "якорь центра",
    "interior-penetrator": "проникающий тэкл",
    "three-technique": "трёхтехник",
    "run-anchor": "якорь против выноса",
    "coverage-backer": "лайнбекер покрытия",
    "edge-blitzer": "атакующий блицер",
    "press-corner": "пресс-корнер",
    "zone-corner": "зонный корнер",
    "ball-hawk": "охотник за мячом",
    "box-safety": "боксовый сэйфти",
    "center-fielder": "глубокий сэйфти",
    "match-safety": "матчевый сэйфти",
    "accuracy-kicker": "точный кикер",
    "power-kicker": "кикер с сильной ногой",
    "clutch-kicker": "кикер решающих ударов",
    "directional-punter": "направленный пантер",
    "hangtime-punter": "пантер с высоким зависанием",
    "field-position-punter": "пантер контроля поля",
  };
  return labels[role];
}

export function createTacticalIdentity(
  team: Pick<EcosystemTeam, "seed" | "offenseStyle" | "defenseStyle" | "level" | "prestige">,
  coach: Pick<EcosystemCoach, "seed" | "development" | "reputation" | "philosophy" | "offenseSystem" | "defenseSystem" | "adaptability" | "tactics" | "gameManagement"> | undefined,
  random: SeededRandom,
  staff: readonly EcosystemCoach[] = [],
): EcosystemTacticalIdentity {
  const coachRandom = random.fork(coach?.seed ?? `${team.seed}:staff`);
  const offensiveCoordinator = staff.find((item) => item.role === "offensive-coordinator");
  const defensiveCoordinator = staff.find((item) => item.role === "defensive-coordinator");
  const offenseSystem = offensiveCoordinator?.offenseSystem ?? coach?.offenseSystem ?? normalizedOffense(team.offenseStyle);
  const defenseSystem = defensiveCoordinator?.defenseSystem ?? coach?.defenseSystem ?? normalizedDefense(team.defenseStyle);
  const offense = offenseRoles(offenseSystem);
  const defense = defenseRoles(defenseSystem);
  const coachQuality = coach ? coach.development * 0.35 + coach.reputation * 0.25 + coach.tactics * 0.4 : team.prestige;
  const coordinatorQuality = ((offensiveCoordinator?.tactics ?? coachQuality) + (defensiveCoordinator?.tactics ?? coachQuality)) / 2;
  const complexity = clamp((team.level === "college" ? 58 : 38) + team.prestige * 0.18 + coordinatorQuality * 0.18 + coachRandom.integer(-10, 10));
  const installation = clamp(46 + coachQuality * 0.24 + coordinatorQuality * 0.22 + coachRandom.integer(-9, 9));
  const continuity = clamp(54 + (coach?.philosophy.includes("схем") ? 7 : 0) + coachRandom.integer(-12, 16));
  const rotationDepth = clamp((team.level === "college" ? 58 : 42) + coachRandom.integer(-14, 18));
  const tempo = offenseSystem === "air-raid" || offenseSystem === "spread-option"
    ? "fast"
    : offenseSystem === "power-run"
      ? "controlled"
      : coachRandom.pick(["controlled", "balanced", "balanced", "fast"] as const);
  const offensiveAggression = offenseSystem === "air-raid" ? "aggressive" : offenseSystem === "power-run" ? "conservative" : "balanced";
  const defensiveAggression = defenseSystem === "man-pressure" || defenseSystem === "multiple-34" ? "aggressive" : defenseSystem === "quarters-425" ? "balanced" : coachRandom.pick(["conservative", "balanced", "balanced"] as const);
  const runRateBase: Record<EcosystemOffenseSystem, number> = { "air-raid": 31, "west-coast": 43, "power-run": 62, "spread-option": 54, multiple: 48 };
  const blitzBase: Record<EcosystemDefenseSystem, number> = { "quarters-425": 24, "multiple-34": 42, "over-43": 29, "nickel-match": 31, "man-pressure": 51, "multiple-defense": 34 };
  const manBase: Record<EcosystemDefenseSystem, number> = { "quarters-425": 28, "multiple-34": 39, "over-43": 34, "nickel-match": 43, "man-pressure": 68, "multiple-defense": 42 };
  const staffFingerprint = staff.length > 0
    ? staff.map((item) => `${item.role}:${item.seed}`).sort().join("|")
    : coach?.seed ?? `${team.seed}:staff`;
  return {
    version: 1,
    offenseSystem,
    defenseSystem,
    tempo,
    offensiveAggression,
    defensiveAggression,
    complexity,
    installation,
    continuity,
    rotationDepth,
    headCoachFingerprint: coach?.seed ?? `${team.seed}:staff`,
    offensiveCoordinatorFingerprint: offensiveCoordinator?.seed ?? coach?.seed ?? `${team.seed}:offense`,
    defensiveCoordinatorFingerprint: defensiveCoordinator?.seed ?? coach?.seed ?? `${team.seed}:defense`,
    staffFingerprint,
    runRate: clamp(runRateBase[offenseSystem] + coachRandom.integer(-5, 5)),
    playActionRate: clamp((offenseSystem === "power-run" ? 28 : offenseSystem === "spread-option" ? 24 : 17) + coachRandom.integer(-4, 5)),
    screenRate: clamp((offenseSystem === "west-coast" || offenseSystem === "air-raid" ? 19 : 11) + coachRandom.integer(-4, 4)),
    deepShotRate: clamp((offenseSystem === "air-raid" ? 27 : offenseSystem === "power-run" ? 14 : 20) + coachRandom.integer(-5, 5)),
    blitzRate: clamp(blitzBase[defenseSystem] + coachRandom.integer(-5, 5)),
    manCoverageRate: clamp(manBase[defenseSystem] + coachRandom.integer(-5, 5)),
    disguiseRate: clamp(38 + (defensiveCoordinator?.adaptability ?? coach?.adaptability ?? 55) * .42 + coachRandom.integer(-8, 8)),
    fourthDownAggression: clamp(34 + (coach?.gameManagement ?? 55) * .38 + (offensiveAggression === "aggressive" ? 12 : offensiveAggression === "conservative" ? -8 : 0)),
    adaptation: clamp((coach?.adaptability ?? 55) * .4 + (offensiveCoordinator?.adaptability ?? 55) * .3 + (defensiveCoordinator?.adaptability ?? 55) * .3),
    positionRoles: {
      ...offense,
      ...defense,
      K: pair("accuracy-kicker", "power-kicker"),
      P: pair("field-position-punter", "hangtime-punter"),
    },
  };
}

function deterministicArchetype(position: FootballRosterPosition, random: SeededRandom): EcosystemPlayerArchetype {
  return random.pick(ROLE_BY_POSITION[position]) as EcosystemPlayerArchetype;
}

export function roleFitScore(
  preferredRole: EcosystemPositionRole,
  secondaryRole: EcosystemPositionRole,
  identity: EcosystemTacticalIdentity,
  position: FootballRosterPosition,
): number {
  const target = identity.positionRoles[position];
  if (preferredRole === target.primary) return 96;
  if (preferredRole === target.secondary) return 82;
  if (secondaryRole === target.primary) return 70;
  if (secondaryRole === target.secondary) return 58;
  return 42;
}

export function careerArchetypeRole(position: FootballPosition, archetypeId: string): EcosystemPositionRole {
  const mappings: Record<FootballPosition, Record<string, EcosystemPositionRole>> = {
    QB: { "field-general": "field-general", gunslinger: "pocket-distributor", "dual-threat": "dual-threat" },
    RB: { "power-back": "power-back", slasher: "zone-runner", "receiving-back": "receiving-back" },
    WR: { "route-technician": "separator", "vertical-threat": "vertical-threat", "contested-catch": "possession-target" },
    TE: { "inline-blocker": "inline-receiver", "seam-threat": "seam-threat", "move-tight-end": "move-tight-end" },
    OT: { "blindside-anchor": "blindside-anchor", "zone-tackle": "zone-tackle", "power-tackle": "power-tackle" },
    OG: { "pull-guard": "pull-guard", "phone-booth-guard": "phone-booth-guard", "zone-guard": "zone-guard" },
    C: { "line-caller": "line-caller", "reach-center": "reach-center", "power-center": "power-center" },
    EDGE: { "speed-rusher": "speed-rusher", "power-rusher": "power-rusher", "edge-setter": "edge-setter" },
    DT: { "nose-anchor": "nose-anchor", "interior-penetrator": "interior-penetrator", "three-technique": "three-technique" },
    LB: { "run-stopper": "run-anchor", "coverage-linebacker": "coverage-backer", "edge-hunter": "edge-blitzer" },
    CB: { "press-corner": "press-corner", "ball-hawk": "ball-hawk", "shutdown-corner": "zone-corner" },
    S: { "box-safety": "box-safety", "center-fielder": "center-fielder", "match-safety": "match-safety" },
    K: { "accuracy-kicker": "accuracy-kicker", "power-kicker": "power-kicker", "clutch-kicker": "clutch-kicker" },
    P: { "directional-punter": "directional-punter", "hangtime-punter": "hangtime-punter", "field-position-punter": "field-position-punter" },
  };
  return mappings[position][archetypeId] ?? ROLE_BY_POSITION[position][0]!;
}

export function createPlayerTacticalProfile(
  player: Pick<EcosystemPlayer, "seed" | "position" | "overall" | "potential" | "classYear">,
  identity: EcosystemTacticalIdentity,
  random: SeededRandom,
  forcedPreferredRole?: EcosystemPositionRole,
): EcosystemPlayerTacticalProfile {
  const roles = ROLE_BY_POSITION[player.position];
  const preferredRole = forcedPreferredRole && roles.includes(forcedPreferredRole)
    ? forcedPreferredRole
    : deterministicArchetype(player.position, random.fork("primary"));
  const secondaryRole = random.fork("secondary").pick(roles.filter((role) => role !== preferredRole)) as EcosystemPositionRole;
  const learning = clamp(45 + (player.potential - player.overall) * 1.2 + (player.classYear === "Senior" ? 8 : 0) + random.integer(-14, 18));
  const versatility = clamp(42 + random.integer(-12, 30) + (player.potential - player.overall) * 0.6);
  const rawRoleFit = roleFitScore(preferredRole, secondaryRole, identity, player.position);
  const schemeFit = clamp(rawRoleFit * 0.72 + learning * 0.18 + versatility * 0.1);
  return {
    version: 1,
    archetype: preferredRole,
    preferredRole,
    secondaryRole,
    schemeFit,
    roleFit: rawRoleFit,
    learning,
    versatility,
    lastEvaluatedSeason: 0,
    lastCoachFingerprint: identity.staffFingerprint ?? identity.headCoachFingerprint,
  };
}

export function reevaluatePlayerTacticalProfile(
  player: EcosystemPlayer,
  identity: EcosystemTacticalIdentity,
  seasonYear: number,
): EcosystemPlayerTacticalProfile {
  const rawRoleFit = roleFitScore(player.tactical.preferredRole, player.tactical.secondaryRole, identity, player.position);
  const currentFingerprint = identity.staffFingerprint ?? identity.headCoachFingerprint;
  const familiarity = currentFingerprint === player.tactical.lastCoachFingerprint ? 7 : -8;
  const schemeFit = clamp(
    rawRoleFit * 0.7
      + player.tactical.learning * 0.17
      + player.tactical.versatility * 0.08
      + identity.installation * 0.05
      + familiarity,
  );
  return {
    ...player.tactical,
    roleFit: rawRoleFit,
    schemeFit,
    lastEvaluatedSeason: seasonYear,
    lastCoachFingerprint: identity.staffFingerprint ?? identity.headCoachFingerprint,
  };
}

export function tacticalDevelopmentMultiplier(player: EcosystemPlayer, team: EcosystemTeam, staff: readonly EcosystemCoach[] = []): number {
  const fit = player.tactical.schemeFit;
  const installation = team.tactical.installation;
  const usage = player.usagePlan === "starter" ? 1.04 : player.usagePlan === "rotation" ? 1 : player.usagePlan === "developmental" || player.usagePlan === "redshirt" ? 0.96 : 0.98;
  const positionCoach = staff.find((coach) => coach.role === "position-coach" && coach.specialtyPositions.includes(player.position));
  const specialistBonus = positionCoach ? (positionCoach.development - 50) * .0016 : 0;
  return Math.max(0.72, Math.min(1.24, (0.72 + fit * 0.0032 + installation * 0.0015 + specialistBonus) * usage));
}

export function tacticalDepthScore(player: EcosystemPlayer): number {
  return player.tactical.schemeFit * 0.11 + player.tactical.roleFit * 0.05;
}

export function tacticalTeamModifier(team: EcosystemTeam, players: EcosystemPlayer[]): number {
  const rotation = players.filter((player) => player.teamId === team.id && player.depthRank <= 2 && player.status !== "injured");
  if (rotation.length === 0) return 0;
  const averageFit = rotation.reduce((sum, player) => sum + player.tactical.schemeFit, 0) / rotation.length;
  const execution = averageFit * 0.55 + team.tactical.installation * 0.3 + team.tactical.continuity * 0.15;
  return Math.max(-5, Math.min(5, (execution - 68) * 0.13));
}

export function tacticalRecruitingFit(
  position: FootballRosterPosition,
  preferredRole: EcosystemPositionRole,
  secondaryRole: EcosystemPositionRole,
  team: EcosystemTeam,
): number {
  return roleFitScore(preferredRole, secondaryRole, team.tactical, position);
}

export function defaultRoleForPosition(position: FootballRosterPosition, seed: string): { preferredRole: EcosystemPositionRole; secondaryRole: EcosystemPositionRole } {
  const random = new SeededRandom(`${seed}:market-role`);
  const roles = ROLE_BY_POSITION[position];
  const preferredRole = random.pick(roles);
  const secondaryRole = random.pick(roles.filter((role) => role !== preferredRole));
  return { preferredRole, secondaryRole };
}

export function refreshTacticalIdentityAfterCoachChange(
  team: EcosystemTeam,
  coach: EcosystemCoach,
  seasonYear: number,
  staff: readonly EcosystemCoach[] = [],
): EcosystemTeam {
  const random = new SeededRandom(`${team.seed}:tactical-reset:${coach.seed}:${seasonYear}`);
  const identity = createTacticalIdentity(team, coach, random, staff);
  return {
    ...team,
    offenseStyle: offenseSystemLabel(identity.offenseSystem),
    defenseStyle: defenseSystemLabel(identity.defenseSystem),
    tactical: {
      ...identity,
      installation: clamp(identity.installation - 18),
      continuity: clamp(identity.continuity - 30),
    },
  };
}

export function offenseSystemLabel(system: EcosystemOffenseSystem): string {
  const labels: Record<EcosystemOffenseSystem, string> = {
    "air-raid": "Air raid",
    "west-coast": "West coast",
    "power-run": "Power run",
    "spread-option": "Spread option",
    multiple: "Multiple",
  };
  return labels[system];
}

export function defenseSystemLabel(system: EcosystemDefenseSystem): string {
  const labels: Record<EcosystemDefenseSystem, string> = {
    "quarters-425": "4-2-5 quarters",
    "multiple-34": "3-4 multiple",
    "over-43": "4-3 quarters",
    "nickel-match": "Nickel match",
    "man-pressure": "Man pressure",
    "multiple-defense": "Multiple defense",
  };
  return labels[system];
}

export function tacticalIdentitySummary(team: EcosystemTeam): string {
  const offense = offenseSystemLabel(team.tactical.offenseSystem);
  const defense = defenseSystemLabel(team.tactical.defenseSystem);
  const primaryRoles = FOOTBALL_ROSTER_POSITIONS
    .map((position) => `${position}: ${positionRoleLabel(team.tactical.positionRoles[position].primary)}`)
    .join(" · ");
  return `${offense} / ${defense}. ${primaryRoles}`;
}
