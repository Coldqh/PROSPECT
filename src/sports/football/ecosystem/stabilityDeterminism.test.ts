import { describe, expect, it } from "vitest";
import { runAutonomousStabilitySimulation } from "./stability";
import { createStabilitySave } from "./stabilityTestUtils";

describe("full-roster autonomous determinism", () => {
  it("produces the same two-season report from the same seed", () => {
    const left = runAutonomousStabilitySimulation(createStabilitySave("stability-repeatable"), 2);
    const right = runAutonomousStabilitySimulation(createStabilitySave("stability-repeatable"), 2);

    expect(left.report).toEqual(right.report);
    expect(left.save.world).toEqual(right.save.world);
  }, 90_000);
});
