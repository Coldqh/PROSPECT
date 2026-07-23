import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition } from "../career/types";
import type {
  EcosystemCoach,
  EcosystemOffenseSystem,
  EcosystemDefenseSystem,
  EcosystemPlayer,
  EcosystemPlayerArchetype,
  EcosystemPlayerTacticalProfile,
  EcosystemPositionRole,
  EcosystemTacticalIdentity,
  EcosystemTeam,
} from "./types";

const POSITIONS = ["QB", "RB", "WR", "LB", "CB"] as const satisfies readonly FootballPosition[];

const ROLE_BY_POSITION: Record<FootballPosition, readonly EcosystemPositionRole[]> = {
  QB: ["pocket-distributor", "dual-threat", "field-general"],
  RB: ["zone-runner", "power-back", "receiving-back"],
  WR: ["separator", "vertical-threat", "possession-target"],
  LB: ["run-anchor", "coverage-backer", "edge-blitzer"],
  CB: ["press-corner", "zone-corner", "ball-hawk"],
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

function offenseRoles(system: EcosystemOffenseSystem): Pick<EcosystemTacticalIdentity["positionRoles"], "QB" | "RB" | "WR"> {
  if (system === "air-raid") {
    return {
      QB: { primary: "pocket-distributor", secondary: "field-general" },
      RB: { primary: "receiving-back", secondary: "zone-runner" },
      WR: { primary: "separator", secondary: "vertical-threat" },
    };
  }
  if (system === "west-coast") {
    return {
      QB: { primary: "field-general", secondary: "pocket-distributor" },
      RB: { primary: "receiving-back", secondary: "zone-runner" },
      WR: { primary: "possession-target", secondary: "separator" },
    };
  }
  if (system === "power-run") {
    return {
      QB: { primary: "field-general", secondary: "pocket-distributor" },
      RB: { primary: "power-back", secondary: "zone-runner" },
      WR: { primary: "possession-target", secondary: "vertical-threat" },
    };
  }
  if (system === "spread-option") {
    return {
      QB: { primary: "dual-threat", secondary: "field-general" },
      RB: { primary: "zone-runner", secondary: "power-back" },
      WR: { primary: "vertical-threat", secondary: "separator" },
    };
  }
  return {
    QB: { primary: "field-general", secondary: "dual-threat" },
    RB: { primary: "zone-runner", secondary: "receiving-back" },
    WR: { primary: "separator", secondary: "possession-target" },
  };
}

function defenseRoles(system: EcosystemDefenseSystem): Pick<EcosystemTacticalIdentity["positionRoles"], "LB" | "CB"> {
  if (system === "quarters-425") {
    return {
      LB: { primary: "coverage-backer", secondary: "run-anchor" },
      CB: { primary: "zone-corner", secondary: "ball-hawk" },
    };
  }
  if (system === "multiple-34") {
    return {
      LB: { primary: "edge-blitzer", secondary: "run-anchor" },
      CB: { primary: "press-corner", secondary: "zone-corner" },
    };
  }
  if (system === "over-43") {
    return {
      LB: { primary: "run-anchor", secondary: "coverage-backer" },
      CB: { primary: "zone-corner", secondary: "ball-hawk" },
    };
  }
  if (system === "nickel-match") {
    return {
      LB: { primary: "coverage-backer", secondary: "edge-blitzer" },
      CB: { primary: "zone-corner", secondary: "press-corner" },
    };
  }
  if (system === "man-pressure") {
    return {
      LB: { primary: "edge-blitzer", secondary: "coverage-backer" },
      CB: { primary: "press-corner", secondary: "ball-hawk" },
    };
  }
  return {
    LB: { primary: "run-anchor", secondary: "coverage-backer" },
    CB: { primary: "zone-corner", secondary: "press-corner" },
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
    "run-anchor": "якорь против выноса",
    "coverage-backer": "лайнбекер покрытия",
    "edge-blitzer": "атакующий блицер",
    "press-corner": "пресс-корнер",
    "zone-corner": "зонный корнер",
    "ball-hawk": "охотник за мячом",
  };
  return labels[role];
}

export function createTacticalIdentity(
  team: Pick<EcosystemTeam, "seed" | "offenseStyle" | "defenseStyle" | "level" | "prestige">,
  coach: Pick<EcosystemCoach, "seed" | "development" | "reputation" | "philosophy"> | undefined,
  random: SeededRandom,
): EcosystemTacticalIdentity {
  const coachRandom = random.fork(coach?.seed ?? `${team.seed}:staff`);
  const offenseSystem = normalizedOffense(team.offenseStyle);
  const defenseSystem = normalizedDefense(team.defenseStyle);
  const offense = offenseRoles(offenseSystem);
  const defense = defenseRoles(defenseSystem);
  const coachQuality = coach ? coach.development * 0.55 + coach.reputation * 0.45 : team.prestige;
  const complexity = clamp((team.level === "college" ? 58 : 38) + team.prestige * 0.22 + coachRandom.integer(-12, 12));
  const installation = clamp(54 + coachQuality * 0.28 + coachRandom.integer(-12, 10));
  const continuity = clamp(58 + (coach?.philosophy.includes("схем") ? 8 : 0) + coachRandom.integer(-16, 18));
  const rotationDepth = clamp((team.level === "college" ? 58 : 42) + coachRandom.integer(-15, 20));
  const tempo = offenseSystem === "air-raid" || offenseSystem === "spread-option"
    ? "fast"
    : offenseSystem === "power-run"
      ? "controlled"
      : coachRandom.pick(["controlled", "balanced", "balanced", "fast"] as const);
  const offensiveAggression = offenseSystem === "air-raid" ? "aggressive" : offenseSystem === "power-run" ? "conservative" : "balanced";
  const defensiveAggression = defenseSystem === "man-pressure" || defenseSystem === "multiple-34" ? "aggressive" : defenseSystem === "quarters-425" ? "balanced" : coachRandom.pick(["conservative", "balanced", "balanced"] as const);
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
    positionRoles: {
      QB: offense.QB,
      RB: offense.RB,
      WR: offense.WR,
      LB: defense.LB,
      CB: defense.CB,
    },
  };
}

function deterministicArchetype(position: FootballPosition, random: SeededRandom): EcosystemPlayerArchetype {
  return random.pick(ROLE_BY_POSITION[position]) as EcosystemPlayerArchetype;
}

export function roleFitScore(
  preferredRole: EcosystemPositionRole,
  secondaryRole: EcosystemPositionRole,
  identity: EcosystemTacticalIdentity,
  position: FootballPosition,
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
    LB: { "run-stopper": "run-anchor", "coverage-linebacker": "coverage-backer", "edge-hunter": "edge-blitzer" },
    CB: { "press-corner": "press-corner", "ball-hawk": "ball-hawk", "shutdown-corner": "zone-corner" },
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
    lastCoachFingerprint: identity.headCoachFingerprint,
  };
}

export function reevaluatePlayerTacticalProfile(
  player: EcosystemPlayer,
  identity: EcosystemTacticalIdentity,
  seasonYear: number,
): EcosystemPlayerTacticalProfile {
  const rawRoleFit = roleFitScore(player.tactical.preferredRole, player.tactical.secondaryRole, identity, player.position);
  const familiarity = identity.headCoachFingerprint === player.tactical.lastCoachFingerprint ? 7 : -8;
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
    lastCoachFingerprint: identity.headCoachFingerprint,
  };
}

export function tacticalDevelopmentMultiplier(player: EcosystemPlayer, team: EcosystemTeam): number {
  const fit = player.tactical.schemeFit;
  const installation = team.tactical.installation;
  const usage = player.usagePlan === "starter" ? 1.04 : player.usagePlan === "rotation" ? 1 : player.usagePlan === "developmental" || player.usagePlan === "redshirt" ? 0.96 : 0.98;
  return Math.max(0.72, Math.min(1.2, (0.72 + fit * 0.0032 + installation * 0.0015) * usage));
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
  position: FootballPosition,
  preferredRole: EcosystemPositionRole,
  secondaryRole: EcosystemPositionRole,
  team: EcosystemTeam,
): number {
  return roleFitScore(preferredRole, secondaryRole, team.tactical, position);
}

export function defaultRoleForPosition(position: FootballPosition, seed: string): { preferredRole: EcosystemPositionRole; secondaryRole: EcosystemPositionRole } {
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
): EcosystemTeam {
  const random = new SeededRandom(`${team.seed}:tactical-reset:${coach.seed}:${seasonYear}`);
  const identity = createTacticalIdentity(team, coach, random);
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
  const primaryRoles = POSITIONS.map((position) => `${position}: ${positionRoleLabel(team.tactical.positionRoles[position].primary)}`).join(" · ");
  return `${offense} / ${defense}. ${primaryRoles}`;
}
