import { describe, expect, it } from "vitest";
import { createFootballCareerState } from "../career/createFootballCareer";
import type { FootballCareerSetup } from "../career/types";
import { evaluateDepthChart } from "./evaluateDepthChart";

const setup: FootballCareerSetup = {
  character: {
    firstName: "Jalen",
    lastName: "Cole",
    birthDate: "2008-08-17",
    gender: "male",
    handedness: "right",
    originId: "houston",
    familyIncome: "comfortable",
    familyStructure: "two-parent",
    familySupport: "supportive",
    mindset: "composed",
  },
  position: "WR",
  archetypeId: "route-technician",
  jerseyNumber: 1,
};

describe("depth chart evaluation", () => {
  it("uses condition and trust instead of overall alone", () => {
    const generated = createFootballCareerState("evaluation-seed", setup);
    const strong = evaluateDepthChart(
      { ...generated.football, depthChart: { ...generated.football.depthChart, coachTrust: 95 } },
      { ...generated.character, condition: { ...generated.character.condition, health: 100, fatigue: 0, confidence: 95 } },
      { year: 2026, month: 8, day: 18 },
    );
    const weak = evaluateDepthChart(
      { ...generated.football, depthChart: { ...generated.football.depthChart, coachTrust: 25 } },
      { ...generated.character, condition: { ...generated.character.condition, health: 65, fatigue: 90, confidence: 35 } },
      { year: 2026, month: 8, day: 18 },
    );
    expect(strong.rank).toBeLessThanOrEqual(weak.rank);
    expect(strong.evaluation.heroScore).toBeGreaterThan(weak.evaluation.heroScore);
  });
});
