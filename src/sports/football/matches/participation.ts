import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CareerSave } from "../../../storage/saves/schema";
import type { FootballPosition } from "../career/types";
import type { FootballMatchState, MatchPlayCall } from "./types";

export type HeroParticipationRole = "starter" | "rotation" | "special-teams" | "developmental" | "inactive" | "practice-squad" | "free-agent";

export interface HeroParticipationContext {
  role: HeroParticipationRole;
  expectedShare: number;
  active: boolean;
  reason: "starter-package" | "rotation-package" | "special-package" | "fatigue-rest" | "package-mismatch" | "inactive";
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveHeroParticipationRole(save: CareerSave, match: FootballMatchState): HeroParticipationRole {
  if (match.rosterRole) return match.rosterRole;
  if (save.meta.phase === "college-season") return save.football.college.heroCareer?.role ?? "developmental";
  if (save.meta.phase === "professional-career") return save.football.professional.heroCareer?.role ?? "inactive";
  const rank = save.football.depthChart.rank;
  if (rank <= 1) return "starter";
  if (rank === 2) return "rotation";
  if (rank === 3) return "special-teams";
  return "inactive";
}

function baseShare(role: HeroParticipationRole, position: FootballPosition): number {
  if (role === "inactive" || role === "practice-squad" || role === "free-agent") return 0;
  if (position === "QB" || position === "C") {
    if (role === "starter") return 0.97;
    if (role === "rotation") return 0.12;
    return role === "developmental" ? 0.05 : 0;
  }
  if (position === "K" || position === "P") {
    if (role === "starter") return 1;
    if (role === "rotation" || role === "special-teams") return 0.58;
    return role === "developmental" ? 0.2 : 0;
  }
  if (role === "starter") return 0.84;
  if (role === "rotation") return 0.4;
  if (role === "special-teams") return 0.1;
  return 0.2;
}

function quarterMultiplier(role: HeroParticipationRole, quarter: FootballMatchState["quarter"], scoreMargin: number): number {
  if (role === "starter") {
    if (quarter === 4 && Math.abs(scoreMargin) >= 24) return 0.58;
    return quarter === 1 ? 0.92 : 1;
  }
  if (role === "rotation") return quarter === 1 ? 0.64 : quarter === 4 && Math.abs(scoreMargin) >= 17 ? 1.34 : 1;
  if (role === "special-teams" || role === "developmental") return quarter === 4 && Math.abs(scoreMargin) >= 17 ? 2.4 : quarter >= 3 ? 1.35 : 0.65;
  return 0;
}

function conceptMultiplier(position: FootballPosition, offenseCall: MatchPlayCall, defenseCall: MatchPlayCall): number {
  if (position === "WR") return offenseCall.personnel.includes("10") || offenseCall.personnel.includes("11") ? 1.12 : offenseCall.personnel.includes("22") ? 0.62 : 1;
  if (position === "TE") return offenseCall.personnel.includes("12") || offenseCall.personnel.includes("13") || offenseCall.personnel.includes("22") ? 1.18 : offenseCall.personnel.includes("10") ? 0.42 : 0.88;
  if (position === "RB") return offenseCall.playType === "run" || offenseCall.playType === "screen" ? 1.13 : 0.9;
  if (position === "OT" || position === "OG") return 0.98;
  if (position === "EDGE" || position === "DT") return defenseCall.formation === "Dime" ? 0.72 : defenseCall.playType === "blitz" ? 1.1 : 1;
  if (position === "LB") return defenseCall.formation === "Dime" ? 0.58 : defenseCall.playType === "blitz" ? 1.18 : 1;
  if (position === "CB" || position === "S") return defenseCall.formation === "Dime" || defenseCall.formation === "Nickel" ? 1.12 : 0.95;
  return 1;
}

export function expectedHeroSnapShare(
  save: CareerSave,
  match: FootballMatchState,
  offenseCall: MatchPlayCall,
  defenseCall: MatchPlayCall,
  naturalPackageFit: boolean,
): number {
  const role = resolveHeroParticipationRole(save, match);
  if (!naturalPackageFit) return 0;
  const scoreMargin = match.heroScore - match.opponentScore;
  const fatigueMultiplier = 1 - Math.max(0, match.heroFatigue - 55) * 0.006;
  return clamp(
    baseShare(role, save.football.position)
      * quarterMultiplier(role, match.quarter, scoreMargin)
      * conceptMultiplier(save.football.position, offenseCall, defenseCall)
      * clamp(fatigueMultiplier, 0.48, 1),
  );
}

export function heroParticipationForSnap(
  save: CareerSave,
  match: FootballMatchState,
  offenseCall: MatchPlayCall,
  defenseCall: MatchPlayCall,
  naturalPackageFit: boolean,
  snapIndex: number,
): HeroParticipationContext {
  const role = resolveHeroParticipationRole(save, match);
  if (role === "inactive" || role === "practice-squad" || role === "free-agent") {
    return { role, expectedShare: 0, active: false, reason: "inactive" };
  }
  if (!naturalPackageFit) return { role, expectedShare: 0, active: false, reason: "package-mismatch" };
  const expectedShare = expectedHeroSnapShare(save, match, offenseCall, defenseCall, naturalPackageFit);
  const random = new SeededRandom(`${save.meta.worldSeed}:${match.gameId}:participation:${snapIndex}:${role}`);
  const active = random.chance(expectedShare);
  if (!active) {
    return {
      role,
      expectedShare,
      active,
      reason: match.heroFatigue >= 72 ? "fatigue-rest" : "rotation-package",
    };
  }
  return {
    role,
    expectedShare,
    active,
    reason: role === "starter" ? "starter-package" : role === "special-teams" ? "special-package" : "rotation-package",
  };
}
