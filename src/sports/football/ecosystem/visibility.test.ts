import { describe, expect, it } from "vitest";
import { createFootballCareerState } from "../career/createFootballCareer";
import type { FootballCareerSetup } from "../career/types";
import { createFootballEcosystem } from "./createEcosystem";
import { getPositionPressure, getTeamEcosystemSnapshot } from "./visibility";

const setup: FootballCareerSetup = {
  character: { firstName: "Cain", lastName: "Vale", birthDate: "2008-02-14", gender: "male", handedness: "right", originId: "houston", familyIncome: "working", familyStructure: "two-parent", familySupport: "supportive", mindset: "obsessed" },
  position: "WR", archetypeId: "route-technician", jerseyNumber: 11,
};

describe("ecosystem visibility selectors", () => {
  it("exposes roster openings and position pressure from the active market", () => {
    const career = createFootballCareerState("visibility-seed", setup);
    const world = createFootballEcosystem("visibility-seed", career.character, career.football, { year: 2026, month: 8, day: 17 });
    const college = world.teams.find((team) => team.level === "college");
    expect(college).toBeDefined();
    const snapshot = getTeamEcosystemSnapshot(world, college!.id);
    expect(snapshot.openings.length).toBeGreaterThan(0);
    expect(getPositionPressure(world)).toHaveLength(5);
    expect(getPositionPressure(world).reduce((sum, item) => sum + item.targetAdds, 0)).toBeGreaterThan(0);
  });
});
