import { describe, expect, it } from "vitest";
import { createFootballCareerState } from "../career/createFootballCareer";
import type { FootballCareerSetup } from "../career/types";
import { FOOTBALL_ROSTER_POSITIONS, POSITION_STARTER_TARGETS } from "./positions";

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

describe("football team generation", () => {
  it("creates the same staff and roster for the same seed", () => {
    const first = createFootballCareerState("team-seed", setup).football;
    const second = createFootballCareerState("team-seed", setup).football;
    expect(first.staff).toEqual(second.staff);
    expect(first.roster).toEqual(second.roster);
  });

  it("creates a full roster and a populated position room", () => {
    const football = createFootballCareerState("team-seed", setup).football;
    expect(football.roster.length).toBeGreaterThanOrEqual(55);
    expect(football.roster.filter((player) => player.position === "WR").length).toBeGreaterThanOrEqual(4);
    expect(football.depthChart.playersAtPosition).toBeGreaterThanOrEqual(5);
    expect(football.depthChart.evaluation.reasons.length).toBeGreaterThan(0);
    for (const position of FOOTBALL_ROSTER_POSITIONS) {
      const room = football.roster.filter((player) => player.position === position);
      expect(room.length).toBeGreaterThanOrEqual(POSITION_STARTER_TARGETS[position]);
    }
  });
});
