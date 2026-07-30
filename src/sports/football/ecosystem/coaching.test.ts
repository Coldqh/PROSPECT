import { describe, expect, it } from "vitest";
import { completeCoachingStaff, createEcosystemCoach, staffRating } from "./coaching";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { EcosystemTeam } from "./types";

const team = {
  id: "college-test",
  level: "college",
  prestige: 78,
  coachIds: [],
} as unknown as EcosystemTeam;

describe("ecosystem coaching staff", () => {
  it("fills every functional coaching role without duplicating the head coach", () => {
    const head = createEcosystemCoach(team, "head-coach", new SeededRandom("head"));
    const completed = completeCoachingStaff([team], [head], 2030);
    const staff = completed.coaches.filter((coach) => coach.teamId === team.id);
    expect(staff.map((coach) => coach.role)).toEqual(["head-coach", "offensive-coordinator", "defensive-coordinator", "position-coach"]);
    expect(new Set(staff.map((coach) => coach.id)).size).toBe(4);
    expect(completed.teams[0]?.coachIds).toHaveLength(4);
    expect(staffRating(staff, team.id)).toBeGreaterThan(40);
  });
});
