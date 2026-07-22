import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../../core/random/SeededRandom";
import {
  createPlayerEligibility,
  createTeamCompliance,
  createWorldConstitution,
  resolveWorldCycle,
} from "./constitution";

const constitution = createWorldConstitution();

describe("football world constitution", () => {
  it("uses one deterministic annual calendar", () => {
    expect(resolveWorldCycle({ year: 2026, month: 8, day: 17 }).phase).toBe("preseason");
    expect(resolveWorldCycle({ year: 2026, month: 10, day: 10 }).phase).toBe("regular-season");
    expect(resolveWorldCycle({ year: 2026, month: 9, day: 5 }).phaseWeek).toBeGreaterThan(resolveWorldCycle({ year: 2026, month: 8, day: 24 }).phaseWeek);
    expect(resolveWorldCycle({ year: 2027, month: 3, day: 8 }).phase).toBe("spring-development");
  });

  it("places 2027 college entrants into the age-based five-year model", () => {
    const eligibility = createPlayerEligibility(
      "college",
      18,
      "Freshman",
      2027,
      new SeededRandom("modern-eligibility"),
      "full",
    );
    expect(eligibility.model).toBe("age-based-five-year");
    expect(eligibility.windowEndYear).toBe(2031);
    expect(eligibility.redshirtUsed).toBe(false);
  });

  it("keeps pre-2027 players on transition-era eligibility", () => {
    const eligibility = createPlayerEligibility(
      "college",
      20,
      "Junior",
      2026,
      new SeededRandom("legacy-eligibility"),
    );
    expect(eligibility.model).toBe("legacy-four-in-five");
    expect(eligibility.initialEnrollmentYear).toBe(2024);
  });

  it("enforces the college roster and scholarship constitution", () => {
    const compliance = createTeamCompliance(
      { level: "college", prestige: 84 },
      15,
      new SeededRandom("team-compliance"),
      constitution,
    );
    expect(compliance.rosterLimit).toBe(105);
    expect(compliance.scholarshipLimit).toBe(105);
    expect(compliance.estimatedRosterSize).toBeLessThanOrEqual(105);
    expect(compliance.scholarshipsUsed).toBeLessThanOrEqual(compliance.fundedScholarships);
  });
});
