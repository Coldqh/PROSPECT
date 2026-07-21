import { describe, expect, it } from "vitest";
import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import { createFootballCareerState } from "../career/createFootballCareer";
import type { FootballCareerSetup } from "../career/types";
import type { CareerSave } from "../../../storage/saves/schema";
import { performRecruitingAction } from "./updateRecruiting";

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
      schemaVersion: 9,
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
