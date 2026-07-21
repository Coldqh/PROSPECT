import { describe, expect, it } from "vitest";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { resolveTrainingDay } from "./resolveTrainingDay";

function makeCareer(seed = "training-test-seed") {
  return createFootballCareerState(seed, createLegacyFootballSetup(seed));
}

const effects = {
  trainingQuality: 74,
  recoveryQuality: 62,
  studyQuality: 68,
  socialQuality: 55,
  load: 58,
};

describe("resolveTrainingDay", () => {
  it("is deterministic for the same career state and date", () => {
    const generated = makeCareer();
    const first = resolveTrainingDay(generated.football, generated.character, effects, { year: 2026, month: 8, day: 17 }, "training-test-seed", 1);
    const second = resolveTrainingDay(generated.football, generated.character, effects, { year: 2026, month: 8, day: 17 }, "training-test-seed", 1);
    expect(first).toEqual(second);
  });

  it("applies the selected focus to development", () => {
    const generated = makeCareer("focus-test-seed");
    const football = {
      ...generated.football,
      training: {
        ...generated.football.training,
        plan: { focusId: "film-install" as const, intensity: "standard" as const, revision: 2 },
      },
    };
    const result = resolveTrainingDay(football, generated.character, effects, { year: 2026, month: 8, day: 17 }, "focus-test-seed", 1);
    expect(result.session.gains.footballIq).toBeGreaterThan(result.session.gains.athleticism);
  });

  it("reduces load when recovery is the active focus", () => {
    const generated = makeCareer("recovery-test-seed");
    const hard = resolveTrainingDay(generated.football, generated.character, effects, { year: 2026, month: 8, day: 17 }, "recovery-test-seed", 1);
    const recoveryFootball = {
      ...generated.football,
      training: {
        ...generated.football.training,
        plan: { focusId: "recovery-reset" as const, intensity: "controlled" as const, revision: 2 },
      },
    };
    const recovery = resolveTrainingDay(recoveryFootball, generated.character, effects, { year: 2026, month: 8, day: 17 }, "recovery-test-seed", 1);
    expect(recovery.session.load).toBeLessThan(hard.session.load);
    expect(recovery.training.body.soreness).toBeLessThanOrEqual(hard.training.body.soreness);
  });
});
