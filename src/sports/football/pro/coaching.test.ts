import { describe, expect, it } from "vitest";
import { advanceProfessionalCoaching, createProfessionalStaff, createProfessionalTacticalIdentity, ensureProfessionalCoaching, professionalSchemeFit, professionalStaffRating, professionalTacticalModifier } from "./coaching";
import type { ProfessionalTeam } from "./types";
import { CAREER_FOOTBALL_POSITIONS } from "../career/types";

function team(id: string, wins = 8): ProfessionalTeam {
  const needs = Object.fromEntries(CAREER_FOOTBALL_POSITIONS.map((position) => [position, 50])) as ProfessionalTeam["needs"];
  const staff = createProfessionalStaff(id, 76, `${id}:staff`);
  return {
    id,
    city: id,
    name: "Club",
    shortName: id.slice(0, 3).toUpperCase(),
    conference: "AFC",
    prestige: 76,
    rosterStrength: 76,
    wins,
    losses: 17 - wins,
    salaryCap: 255_000_000,
    payroll: 220_000_000,
    deadCap: 4_000_000,
    capSpace: 31_000_000,
    rosterSize: 53,
    needs,
    staff,
    tactical: createProfessionalTacticalIdentity(staff, `${id}:tactical`),
  };
}

describe("professional coaching ecosystem", () => {
  it("creates complete deterministic staffs and tactical identities", () => {
    const first = ensureProfessionalCoaching([team("alpha")], "staff-seed")[0]!;
    const second = ensureProfessionalCoaching([{ ...team("alpha"), staff: undefined, tactical: undefined }], "staff-seed")[0]!;
    expect(first.staff?.map((coach) => coach.role)).toEqual(["head-coach", "offensive-coordinator", "defensive-coordinator", "position-coach"]);
    expect(second.staff).toHaveLength(4);
    expect(second.tactical?.runRate).toBeGreaterThanOrEqual(0);
    expect(professionalStaffRating(second)).toBeGreaterThan(40);
  });

  it("replaces failed expired staff and installs a new system", () => {
    const failing = team("failure", 2);
    const staff = failing.staff!.map((coach) => ({ ...coach, contractYears: 1, jobSecurity: 0 }));
    const beforeIds = staff.map((coach) => coach.id + coach.name);
    const [after] = advanceProfessionalCoaching([{ ...failing, staff }], 2032, "carousel");
    expect(after?.staff).toHaveLength(4);
    expect(after?.staff?.map((coach) => coach.id + coach.name)).not.toEqual(beforeIds);
    expect(after?.tactical).toBeDefined();
  });


  it("turns team systems into player scheme fit", () => {
    const power = team("power");
    power.tactical = { ...power.tactical!, offenseSystem: "power-run" };
    const runner = professionalSchemeFit(power, { id: "runner", position: "RB", age: 22, potential: 88 });
    const receiver = professionalSchemeFit(power, { id: "receiver", position: "WR", age: 22, potential: 88 });
    expect(runner).toBeGreaterThan(receiver);
  });

  it("turns staff and scheme matchups into a bounded game modifier", () => {
    const offense = team("offense");
    const defense = team("defense");
    const modifier = professionalTacticalModifier(offense, defense);
    expect(modifier).toBeGreaterThanOrEqual(-5.5);
    expect(modifier).toBeLessThanOrEqual(5.5);
  });
});
