import { describe, expect, it } from "vitest";
import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import { createFootballEcosystem } from "../ecosystem/createEcosystem";
import { createFootballCareerState } from "../career/createFootballCareer";
import type { FootballCareerSetup } from "../career/types";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";
import { performRecruitingAction } from "./updateRecruiting";
import { advanceRecruitingWorld, commitToCollege, withdrawCollegeCommitment } from "./visits";
import { addGameDays } from "../../../core/calendar/types";

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
    mindset: "composed",
  },
  position: "WR",
  archetypeId: "route-technician",
  jerseyNumber: 11,
};

function makeSave(): CareerSave {
  const generated = createFootballCareerState("recruiting-seed", setup);
  return {
    meta: {
      id: "recruiting-career",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sport: "american-football",
      worldSeed: "recruiting-seed",
      createdAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
      currentDate: { year: 2026, month: 8, day: 17 },
      phase: "high-school-preseason",
      revision: 1,
    },
    ...generated,
    life: createInitialLifeState(),
    relationships: createFootballRelationships("recruiting-seed", generated.character, generated.football),
    world: createFootballEcosystem("recruiting-seed", generated.character, generated.football, { year: 2026, month: 8, day: 17 }),
    history: [],
  };
}

describe("college recruiting", () => {
  it("creates a deterministic ecosystem of 24 programs", () => {
    const first = makeSave().football.recruitment;
    const second = makeSave().football.recruitment;
    expect(first).toEqual(second);
    expect(first.programs).toHaveLength(24);
    expect(new Set(first.programs.map((program) => program.tier)).size).toBe(4);
  });

  it("limits the player to two recruiting actions per week", () => {
    const save = makeSave();
    const program = save.football.recruitment.programs[0];
    if (!program) throw new Error("Missing program");
    const first = performRecruitingAction(save, program.id, "send-film");
    const second = performRecruitingAction(first, program.id, "send-transcript");
    expect(second.football.recruitment.actionsUsed).toBe(2);
    expect(second.football.recruitment.programs[0]?.scoutingConfidence).toBeGreaterThan(program.scoutingConfidence);
    expect(() => performRecruitingAction(second, program.id, "send-film")).toThrow();
  });



  it("turns direct recruiter contact into a concrete promise", () => {
    const save = makeSave();
    const target = save.football.recruitment.programs[0];
    if (!target) throw new Error("Missing program");
    const prepared: CareerSave = {
      ...save,
      football: {
        ...save.football,
        recruitment: {
          ...save.football.recruitment,
          programs: save.football.recruitment.programs.map((program) => program.id === target.id ? { ...program, stage: "contact", interest: 72 } : program),
        },
      },
    };
    const result = performRecruitingAction(prepared, target.id, "recruiter-call");
    const updated = result.football.recruitment.programs.find((program) => program.id === target.id);
    expect(updated?.promises).toHaveLength(1);
    expect(updated?.roleClarity).toBeGreaterThan(target.roleClarity);
  });

  it("schedules one official visit and resolves it on Sunday", () => {
    const save = makeSave();
    const target = save.football.recruitment.programs[0];
    if (!target) throw new Error("Missing program");
    const invited: CareerSave = {
      ...save,
      football: {
        ...save.football,
        recruitment: {
          ...save.football.recruitment,
          programs: save.football.recruitment.programs.map((program) => program.id === target.id ? { ...program, stage: "priority", visitStatus: "invited" } : program),
        },
      },
    };
    const scheduled = performRecruitingAction(invited, target.id, "schedule-visit");
    const scheduledProgram = scheduled.football.recruitment.programs.find((program) => program.id === target.id);
    expect(scheduledProgram?.visitStatus).toBe("scheduled");
    const sunday: CareerSave = {
      ...scheduled,
      meta: { ...scheduled.meta, currentDate: addGameDays(scheduled.meta.currentDate, 6) },
      life: { ...scheduled.life, dayIndex: 6, completedDays: scheduled.life.completedDays + 6 },
    };
    const completed = advanceRecruitingWorld(sunday);
    const completedProgram = completed.football.recruitment.programs.find((program) => program.id === target.id);
    expect(completedProgram?.visitStatus).toBe("completed");
    expect(completedProgram?.officialVisit?.overallImpression).toBeGreaterThan(0);
    expect(completedProgram?.promises.length).toBeGreaterThan(0);
  });

  it("makes a verbal commitment consequential and reversible", () => {
    const save = makeSave();
    const target = save.football.recruitment.programs[0];
    if (!target) throw new Error("Missing program");
    const offered: CareerSave = {
      ...save,
      football: {
        ...save.football,
        recruitment: {
          ...save.football.recruitment,
          programs: save.football.recruitment.programs.map((program) => program.id === target.id ? {
            ...program,
            stage: "offered",
            academicEligible: true,
            offer: { id: "offer-1", issuedWeek: 1, scholarship: "full", projectedRole: program.projectedRole, expiresAfterWeek: 8 },
          } : program),
          offers: 1,
        },
      },
    };
    const committed = commitToCollege(offered, target.id);
    expect(committed.football.recruitment.commitment?.programId).toBe(target.id);
    expect(committed.character.condition.stress).toBeLessThan(save.character.condition.stress);
    const withdrawn = withdrawCollegeCommitment(committed);
    expect(withdrawn.football.recruitment.commitment).toBeUndefined();
    expect(withdrawn.football.recruitment.decommitments).toBe(1);
    expect(withdrawn.football.recruitment.programs.find((program) => program.id === target.id)?.offer).toBeUndefined();
  });

  it("keeps academics and depth competition separate from raw interest", () => {
    const state = makeSave().football.recruitment;
    const academicStandards = state.programs.map((program) => program.academicStandard);
    expect(Math.max(...academicStandards) - Math.min(...academicStandards)).toBeGreaterThan(15);
    const depthCompetition = state.programs.map((program) => program.depthCompetition);
    const positionNeeds = state.programs.map((program) => program.positionNeed);
    expect(Math.max(...depthCompetition) - Math.min(...depthCompetition)).toBeGreaterThan(15);
    expect(Math.max(...positionNeeds) - Math.min(...positionNeeds)).toBeGreaterThan(20);
  });
});
