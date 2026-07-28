import type { CareerSave } from "../../../storage/saves/schema";
import type { FootballMatchState, MatchDecisionOption, MatchEpisode } from "./types";

export type MatchAnalysisConfidence = "low" | "medium" | "high";

export interface MatchDecisionForecast {
  executionChance: number;
  assignmentFloor: number;
  assignmentCeiling: number;
  expectedAssignment: number;
  playImpact: number;
  bigPlayChance: number;
  mistakeChance: number;
  confidence: MatchAnalysisConfidence;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function heroSkillValue(save: CareerSave, option: MatchDecisionOption): number {
  const ratings = save.football.ratings;
  const heroTacticalFit = save.world.players.find((player) => player.isHero)?.tactical.schemeFit ?? 65;
  const coachTrust = save.meta.phase === "college-season"
    ? save.football.college.heroCareer?.coachTrust ?? save.football.depthChart.coachTrust
    : save.football.depthChart.coachTrust;
  const focus = {
    technique: ratings.technique,
    athleticism: ratings.athleticism,
    "football-iq": ratings.footballIq,
    competitiveness: ratings.competitiveness,
  }[option.focus];
  return (
    focus * .45
    + ratings.technique * .14
    + ratings.footballIq * .13
    + save.character.condition.confidence * .09
    + save.football.training.body.readiness * .08
    + coachTrust * .05
    + heroTacticalFit * .06
  );
}

export function decisionScoreCenter(
  save: CareerSave,
  match: FootballMatchState,
  option: MatchDecisionOption,
): number {
  const fatiguePenalty = match.heroFatigue * .2 + save.character.condition.fatigue * .06;
  const painPenalty = save.football.training.body.pain * .09
    + (save.football.training.body.medicalStatus === "limited" ? 6 : 0);
  return heroSkillValue(save, option) - option.difficulty * .34 - fatiguePenalty - painPenalty + 24;
}

function executionProbability(center: number): number {
  let wins = 0;
  for (let roll = -16; roll <= 16; roll += 1) {
    if (clamp(center + roll) >= 64) wins += 1;
  }
  return Math.round(wins / 33 * 100);
}

export function calculateDecisionForecast(
  save: CareerSave,
  match: FootballMatchState,
  episode: MatchEpisode,
  option: MatchDecisionOption,
): MatchDecisionForecast {
  const center = decisionScoreCenter(save, match, option);
  const executionChance = executionProbability(center);
  const involvementWeight = episode.heroInvolvement === "primary" ? 1 : episode.heroInvolvement === "secondary" ? .72 : .48;
  const riskImpact = option.risk === "aggressive" ? 1.18 : option.risk === "balanced" ? 1 : .78;
  const playImpact = Math.round(clamp(option.upside * involvementWeight * riskImpact * (.58 + executionChance / 210), 1, 100));
  const bigPlayChance = Math.round(clamp(
    option.upside * .32
      + Math.max(0, center - 58) * .2
      + (option.risk === "aggressive" ? 8 : option.risk === "balanced" ? 3 : 0)
      - option.mistakeRisk * .08,
    1,
    62,
  ));
  const mistakeChance = Math.round(clamp(
    option.mistakeRisk * .58
      + Math.max(0, 62 - center) * .42
      + match.heroFatigue * .045
      + save.football.training.body.pain * .035,
    1,
    55,
  ));
  const informationQuality = save.football.ratings.footballIq * .62
    + save.football.training.body.readiness * .2
    + (save.world.players.find((player) => player.isHero)?.tactical.schemeFit ?? 65) * .18;
  const confidence: MatchAnalysisConfidence = informationQuality >= 78 ? "high" : informationQuality >= 61 ? "medium" : "low";

  return {
    executionChance,
    assignmentFloor: Math.round(clamp(center - 16)),
    assignmentCeiling: Math.round(clamp(center + 16)),
    expectedAssignment: Math.round(clamp(center)),
    playImpact,
    bigPlayChance,
    mistakeChance,
    confidence,
  };
}
