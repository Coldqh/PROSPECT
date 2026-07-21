import { describe, expect, it } from "vitest";
import { createFootballCareerState } from "./createFootballCareer";
import type { FootballCareerSetup } from "./types";

const setup: FootballCareerSetup = {
  character: {
    firstName: "Cain",
    lastName: "Vale",
    birthDate: "2008-02-14",
    gender: "male",
    handedness: "right",
    originId: "houston",
    familyIncome: "working",
    familyStructure: "two-parent",
    familySupport: "supportive",
    mindset: "obsessed",
  },
  position: "WR",
  archetypeId: "route-technician",
  jerseyNumber: 11,
};

describe("createFootballCareerState", () => {
  it("is deterministic for the same seed and setup", () => {
    expect(createFootballCareerState("test-seed", setup)).toEqual(createFootballCareerState("test-seed", setup));
  });

  it("creates a playable high-school prospect", () => {
    const result = createFootballCareerState("test-seed", setup);
    expect(result.character.identity.fullName).toBe("Cain Vale");
    expect(result.football.position).toBe("WR");
    expect(result.football.school.name).toContain("High");
    expect(result.football.ratings.overall).toBeGreaterThanOrEqual(45);
    expect(result.football.depthChart.rank).toBeGreaterThanOrEqual(1);
  });

  it("rejects an archetype from another position", () => {
    expect(() => createFootballCareerState("test-seed", { ...setup, archetypeId: "dual-threat" })).toThrow();
  });
});
