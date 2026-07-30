import type { CareerSave } from "../../../storage/saves/schema";
import type { FootballPosition } from "../career/types";
import type {
  MatchEpisode,
  MatchPlayCall,
  MatchUsagePlan,
  MatchUsageRole,
  MatchUsageStatLine,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function roleMultiplier(role: CareerSave["football"]["match"]["rosterRole"]): number {
  if (role === "starter" || role === undefined) return 1;
  if (role === "rotation") return 0.78;
  if (role === "special-teams") return 0.45;
  return 0.18;
}

function offensiveSystem(save: CareerSave): string {
  if (save.meta.phase === "professional-career") {
    const teamId = save.football.professional.heroCareer?.teamId;
    return save.football.professional.teams.find((team) => team.id === teamId)?.tactical?.offenseSystem ?? "multiple";
  }
  if (save.meta.phase === "college-season") {
    const teamId = save.football.college.heroCareer?.teamId;
    return save.world.teams.find((team) => team.id === teamId)?.tactical.offenseSystem ?? "multiple";
  }
  return "multiple";
}

function roleForPosition(save: CareerSave): MatchUsageRole {
  const position = save.football.position;
  const physical = save.character.physical;
  const ratings = save.football.ratings;
  if (position === "QB") return "field-general";
  if (position === "RB") {
    return ratings.footballIq + physical.agility >= physical.strength + physical.explosiveness + 12
      ? "receiving-back"
      : "lead-runner";
  }
  if (position === "WR") {
    if (physical.speed + physical.explosiveness >= 160) return "deep-threat";
    if (physical.agility + ratings.technique >= 155) return "slot-option";
    return "possession-target";
  }
  if (position === "TE") {
    return physical.strength + physical.heightInches >= 150 ? "red-zone-target" : "possession-target";
  }
  if (position === "OT" || position === "OG" || position === "C") return "foundation-blocker";
  if (position === "EDGE" || position === "DT") return "disruptor";
  if (position === "LB") return "second-level-anchor";
  if (position === "CB" || position === "S") return "coverage-leader";
  return "specialist";
}

function roleLabel(role: MatchUsageRole): string {
  const labels: Record<MatchUsageRole, string> = {
    "field-general": "FIELD GENERAL",
    "lead-runner": "LEAD RUNNER",
    "receiving-back": "RECEIVING BACK",
    "deep-threat": "DEEP THREAT",
    "slot-option": "SLOT OPTION",
    "possession-target": "POSSESSION",
    "red-zone-target": "RED ZONE",
    "foundation-blocker": "FOUNDATION",
    disruptor: "DISRUPTOR",
    "second-level-anchor": "ANCHOR",
    "coverage-leader": "COVERAGE",
    specialist: "SPECIALIST",
  };
  return labels[role];
}

export function createEmptyMatchUsageStats(): MatchUsageStatLine {
  return {
    routesRun: 0,
    openWindows: 0,
    targetsWhenOpen: 0,
    missedOpenWindows: 0,
    designedTouches: 0,
    actualTouches: 0,
    separationTotal: 0,
    separationSamples: 0,
  };
}

export function createDefaultMatchUsagePlan(position: FootballPosition, rosterRole?: CareerSave["football"]["match"]["rosterRole"]): MatchUsagePlan {
  const offensiveSkill = position === "RB" || position === "WR" || position === "TE";
  const role: MatchUsageRole = position === "QB"
    ? "field-general"
    : position === "RB"
      ? "lead-runner"
      : position === "WR"
        ? "possession-target"
        : position === "TE"
          ? "red-zone-target"
          : position === "OT" || position === "OG" || position === "C"
            ? "foundation-blocker"
            : position === "EDGE" || position === "DT"
              ? "disruptor"
              : position === "LB"
                ? "second-level-anchor"
                : position === "CB" || position === "S"
                  ? "coverage-leader"
                  : "specialist";
  const multiplier = roleMultiplier(rosterRole);
  return {
    role,
    label: roleLabel(role),
    targetPriority: offensiveSkill ? clamp(64 * multiplier, 18, 84) : 0,
    touchPriority: position === "RB" ? clamp(72 * multiplier, 18, 88) : offensiveSkill ? clamp(58 * multiplier, 12, 80) : 0,
    redZonePriority: position === "TE" ? clamp(82 * multiplier, 20, 92) : offensiveSkill ? clamp(58 * multiplier, 18, 82) : 0,
    deepPriority: position === "WR" ? clamp(66 * multiplier, 18, 90) : 0,
    designedShare: position === "RB" ? clamp(30 * multiplier, 5, 42) : offensiveSkill ? clamp(18 * multiplier, 3, 32) : 0,
    shadowRisk: offensiveSkill ? 30 : 0,
    doubleTeamRisk: offensiveSkill ? 12 : 0,
  };
}

export function buildMatchUsagePlan(save: CareerSave, rosterRole = save.football.match.rosterRole): MatchUsagePlan {
  const position = save.football.position;
  const base = createDefaultMatchUsagePlan(position, rosterRole);
  const role = roleForPosition(save);
  const multiplier = roleMultiplier(rosterRole);
  const overall = save.football.ratings.overall;
  const coachTrust = save.meta.phase === "professional-career"
    ? save.football.professional.heroCareer?.coachTrust ?? 55
    : save.meta.phase === "college-season"
      ? save.football.college.heroCareer?.coachTrust ?? 55
      : save.football.depthChart.coachTrust;
  const system = offensiveSystem(save);
  let targetPriority = base.targetPriority;
  let touchPriority = base.touchPriority;
  let redZonePriority = base.redZonePriority;
  let deepPriority = base.deepPriority;

  if (role === "deep-threat") deepPriority += 22;
  if (role === "slot-option") targetPriority += 14;
  if (role === "possession-target") targetPriority += 10;
  if (role === "red-zone-target") redZonePriority += 18;
  if (role === "receiving-back") targetPriority += 12;
  if (role === "lead-runner") touchPriority += 16;
  if (system === "air-raid" && (position === "WR" || position === "TE")) targetPriority += 10;
  if (system === "west-coast" && (role === "slot-option" || role === "receiving-back" || role === "possession-target")) targetPriority += 8;
  if (system === "power-run" && position === "RB") touchPriority += 12;

  const standing = (overall - 65) * 0.48 + (coachTrust - 55) * 0.22;
  targetPriority += standing;
  touchPriority += standing;
  redZonePriority += (overall - 65) * 0.35;
  deepPriority += (save.character.physical.speed - 65) * 0.42;

  const designedShare = position === "RB"
    ? clamp((22 + touchPriority * 0.18) * multiplier, 4, 44)
    : position === "WR" || position === "TE"
      ? clamp((9 + targetPriority * 0.18) * multiplier, 3, 34)
      : 0;

  return {
    role,
    label: roleLabel(role),
    targetPriority: clamp(targetPriority, 0, 98),
    touchPriority: clamp(touchPriority, 0, 98),
    redZonePriority: clamp(redZonePriority, 0, 98),
    deepPriority: clamp(deepPriority, 0, 98),
    designedShare,
    shadowRisk: clamp((overall - 70) * 1.35 + targetPriority * 0.28, 0, 88),
    doubleTeamRisk: clamp((overall - 76) * 1.6 + redZonePriority * 0.16, 0, 72),
  };
}

export function usagePriorityForSnap(
  plan: MatchUsagePlan,
  stats: MatchUsageStatLine,
  call: MatchPlayCall,
  fieldPosition: number,
): number {
  let priority = plan.targetPriority;
  if (plan.role === "deep-threat" && (call.tags.includes("shot") || call.tags.includes("deep") || call.tags.includes("long-yardage"))) priority += plan.deepPriority * 0.22;
  if (plan.role === "slot-option" && (call.tags.includes("quick") || call.tags.includes("man-beater") || call.tags.includes("third-down"))) priority += 12;
  if (plan.role === "possession-target" && (call.tags.includes("medium") || call.tags.includes("third-down") || call.tags.includes("safe"))) priority += 10;
  if (plan.role === "red-zone-target" && fieldPosition >= 78) priority += plan.redZonePriority * 0.24;
  if (plan.role === "receiving-back" && (call.playType === "screen" || call.tags.includes("pressure-answer"))) priority += 14;
  if (stats.openWindows >= 2 && stats.targetsWhenOpen / Math.max(1, stats.openWindows) < 0.45) priority += 8;
  if (stats.routesRun >= 6) {
    const currentShare = stats.actualTouches / stats.routesRun * 100;
    const excessShare = currentShare - plan.designedShare;
    if (excessShare > 2) priority -= Math.min(48, (excessShare - 2) * 2.2);
    if (excessShare < -7 && stats.missedOpenWindows > 0) priority += Math.min(14, Math.abs(excessShare + 7) * .55);
  }
  return clamp(priority, 0, 100);
}

export function receiverPriorityMap(
  plan: MatchUsagePlan,
  stats: MatchUsageStatLine,
  call: MatchPlayCall,
  heroSlot: string,
  heroPosition: FootballPosition,
  fieldPosition: number,
): Record<string, number> {
  const map: Record<string, number> = {};
  call.progression.forEach((slot, index) => {
    map[slot] = clamp(74 - index * 8, 25, 82);
  });
  if (call.primarySlot) map[call.primarySlot] = Math.max(map[call.primarySlot] ?? 0, 82);
  if (heroPosition === "WR" || heroPosition === "TE" || heroPosition === "RB") {
    const basePriority = map[heroSlot] ?? 52;
    const plannedPriority = usagePriorityForSnap(plan, stats, call, fieldPosition);
    const designedBonus = call.primarySlot === heroSlot ? 6 : 0;
    map[heroSlot] = clamp(basePriority * .28 + plannedPriority * .72 + designedBonus, 18, 100);
  }
  return map;
}

export function usageDeltaForSnap(
  position: FootballPosition,
  episode: MatchEpisode,
  targetSlot: string | undefined,
  ballCarrierSlot: string | undefined,
  liveSignals: { heroOpenWindow?: boolean | undefined; targetedWhenOpen?: boolean | undefined; separationYards?: number | undefined } | undefined,
  advanced?: { routeWins?: number | undefined; separationWins?: number | undefined } | undefined,
): MatchUsageStatLine {
  const routeSnap = (position === "WR" || position === "TE" || position === "RB")
    && episode.assignments.some((assignment) => assignment.isHero && assignment.kind === "route");
  const heroTargeted = targetSlot === episode.heroSlot;
  const heroCarried = ballCarrierSlot === episode.heroSlot;
  const designed = episode.playCall.primarySlot === episode.heroSlot;
  const openWindow = liveSignals?.heroOpenWindow !== undefined
    ? Boolean(liveSignals.heroOpenWindow)
    : routeSnap && Boolean((advanced?.separationWins ?? 0) > 0);
  const separation = liveSignals?.separationYards ?? 0;
  return {
    routesRun: routeSnap ? 1 : 0,
    openWindows: openWindow ? 1 : 0,
    targetsWhenOpen: openWindow && heroTargeted ? 1 : 0,
    missedOpenWindows: openWindow && !heroTargeted ? 1 : 0,
    designedTouches: designed ? 1 : 0,
    actualTouches: heroTargeted || heroCarried ? 1 : 0,
    separationTotal: separation,
    separationSamples: separation > 0 ? 1 : 0,
  };
}

export function addMatchUsageStats(left: MatchUsageStatLine, right: MatchUsageStatLine): MatchUsageStatLine {
  return {
    routesRun: left.routesRun + right.routesRun,
    openWindows: left.openWindows + right.openWindows,
    targetsWhenOpen: left.targetsWhenOpen + right.targetsWhenOpen,
    missedOpenWindows: left.missedOpenWindows + right.missedOpenWindows,
    designedTouches: left.designedTouches + right.designedTouches,
    actualTouches: left.actualTouches + right.actualTouches,
    separationTotal: left.separationTotal + right.separationTotal,
    separationSamples: left.separationSamples + right.separationSamples,
  };
}
