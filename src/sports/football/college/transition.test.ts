import { describe, expect, it } from "vitest";
import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import { createFootballEcosystem } from "../ecosystem/createEcosystem";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";
import { collegeDecisionPrograms, reportToCollege, setCollegeOnboardingPriority, signCollegeAgreement } from "./transition";

function completedCareer(): CareerSave {
  const worldSeed = "college-transition-test";
  const generated = createFootballCareerState(worldSeed, createLegacyFootballSetup(worldSeed));
  const first = generated.football.recruitment.programs[0];
  if (!first) throw new Error("No recruiting program");
  const programs = generated.football.recruitment.programs.map((program, index) => index === 0 ? {
    ...program,
    stage: "offered" as const,
    interest: 91,
    scoutingConfidence: 82,
    academicEligible: true,
    positionNeed: 76,
    depthCompetition: 58,
    projectedRole: "rotation-path" as const,
    offer: {
      id: `${program.id}:offer:test`,
      issuedWeek: 8,
      scholarship: "full" as const,
      projectedRole: "rotation-path" as const,
      expiresAfterWeek: 8,
    },
  } : program);
  const football = {
    ...generated.football,
    season: { ...generated.football.season, phase: "complete" as const, week: 8 },
    recruitment: { ...generated.football.recruitment, programs, offers: 1 },
  };
  return {
    meta: {
      id: "career-college-test",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sport: "american-football",
      worldSeed,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      currentDate: { year: 2026, month: 10, day: 12 },
      phase: "high-school-preseason",
      revision: 1,
    },
    character: generated.character,
    life: createInitialLifeState(),
    football,
    relationships: createFootballRelationships(worldSeed, generated.character, football),
    world: createFootballEcosystem(worldSeed, generated.character, football, { year: 2026, month: 10, day: 12 }),
    history: [],
  };
}

describe("college transition", () => {
  it("exposes legitimate final options after the season", () => {
    const save = completedCareer();
    expect(collegeDecisionPrograms(save)[0]?.offer).toBeDefined();
  });

  it("signs, simulates the offseason and arrives with a real depth rank", () => {
    const save = completedCareer();
    const program = collegeDecisionPrograms(save)[0];
    if (!program) throw new Error("No decision option");
    const signed = signCollegeAgreement(save, program.id, "scholarship");
    expect(signed.football.college.status).toBe("signed");
    expect(signed.football.recruitment.commitment?.status).toBe("signed");

    const arrived = reportToCollege(signed);
    expect(arrived.meta.phase).toBe("college-orientation");
    expect(arrived.meta.currentDate).toEqual({ year: 2027, month: 8, day: 9 });
    expect(arrived.football.college.positionRoom.length).toBeGreaterThanOrEqual(5);
    expect(arrived.football.college.depthRank).toBeGreaterThan(0);
    expect(arrived.football.college.offseason?.trainingGrade).toMatch(/[ABCD]/);
  });

  it("locks the first onboarding priority to prevent farming bonuses", () => {
    const save = completedCareer();
    const program = collegeDecisionPrograms(save)[0];
    if (!program) throw new Error("No decision option");
    const arrived = reportToCollege(signCollegeAgreement(save, program.id, "scholarship"));
    const selected = setCollegeOnboardingPriority(arrived, "learn-system");
    expect(selected.football.college.onboardingPriority).toBe("learn-system");
    expect(() => setCollegeOnboardingPriority(selected, "compete-now")).toThrow();
  });
});
