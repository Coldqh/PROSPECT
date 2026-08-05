import { gradeFromPerformanceScore } from "../performanceEvaluation";
import type {
  FootballMatchState,
  MatchAdvancedStatLine,
  MatchOutcomeGrade,
  MatchStatLine,
  MatchTeamSide,
} from "../types";

export const GAME_SECONDS = 48 * 60;

export const QUARTER_SECONDS = 12 * 60;

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

export function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

export function otherSide(side: MatchTeamSide): MatchTeamSide {
  return side === "hero" ? "opponent" : "hero";
}

export function controlledOffense(match: FootballMatchState): MatchTeamSide {
  return match.heroUnit === "defense" ? "opponent" : "hero";
}

export function clockParts(gameClockSeconds: number): { quarter: 1 | 2 | 3 | 4; clockSeconds: number } {
  if (gameClockSeconds <= 0) return { quarter: 4, clockSeconds: 0 };
  const elapsed = GAME_SECONDS - Math.min(GAME_SECONDS, gameClockSeconds);
  const quarter = Math.min(4, Math.floor(elapsed / QUARTER_SECONDS) + 1) as 1 | 2 | 3 | 4;
  const clockSeconds = gameClockSeconds - (4 - quarter) * QUARTER_SECONDS;
  return { quarter, clockSeconds: clampInteger(clockSeconds, 0, QUARTER_SECONDS) };
}

export function addStats(left: MatchStatLine, right: MatchStatLine): MatchStatLine {
  const result = { ...left };
  const target = result as Record<keyof MatchStatLine, number>;
  for (const key of Object.keys(result) as Array<keyof MatchStatLine>) {
    target[key] = key === "longestFieldGoal"
      ? Math.max(left[key], right[key])
      : left[key] + right[key];
  }
  return result;
}

export function addAdvancedStats(left: MatchAdvancedStatLine, right: MatchAdvancedStatLine): MatchAdvancedStatLine {
  const result = { ...left };
  const target = result as Record<keyof MatchAdvancedStatLine, number>;
  for (const key of Object.keys(result) as Array<keyof MatchAdvancedStatLine>) {
    target[key] = left[key] + right[key];
  }
  return result;
}

export function gradeFromScore(score: number): MatchOutcomeGrade {
  return gradeFromPerformanceScore(score);
}
