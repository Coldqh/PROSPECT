import { describe, expect, it } from "vitest";
import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import { createFootballEcosystem } from "../ecosystem/createEcosystem";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";
import { advanceCollegeCareerDay, resolveCollegeHeroDecision } from "./heroCareer";
import { collegeDecisionPrograms, reportToCollege, setCollegeOnboardingPriority, signCollegeAgreement } from "./transition";

function activeCollegeCareer(seed = "hero-college-test"): CareerSave {
  const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
  const first = generated.football.recruitment.programs[0];
  if (!first) throw new Error("No recruiting program");
  const programs = generated.football.recruitment.programs.map((program, index) => index === 0 ? {
    ...program,
    stage: "offered" as const,
    interest: 94,
    scoutingConfidence: 88,
    academicEligible: true,
    positionNeed: 80,
    depthCompetition: 54,
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
  const save: CareerSave = {
    meta: {
      id: "hero-college-career",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sport: "american-football",
      worldSeed: seed,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      currentDate: { year: 2026, month: 10, day: 12 },
      phase: "high-school-preseason",
      revision: 1,
    },
    character: generated.character,
    life: createInitialLifeState(),
    football,
    relationships: createFootballRelationships(seed, generated.character, football),
    world: createFootballEcosystem(seed, generated.character, football, { year: 2026, month: 10, day: 12 }),
    history: [],
  };
  const program = collegeDecisionPrograms(save)[0];
  if (!program) throw new Error("No college option");
  return setCollegeOnboardingPriority(
    reportToCollege(signCollegeAgreement(save, program.id, "scholarship")),
    "learn-system",
  );
}

describe("college hero career", () => {
  it("activates the hero inside the real college roster", () => {
    const save = activeCollegeCareer();
    const career = save.football.college.heroCareer;
    expect(save.meta.phase).toBe("college-season");
    expect(save.football.college.status).toBe("active");
    expect(career?.teamId).toBe(save.football.college.signedProgramId);
    expect(save.football.college.positionRoom.some((player) => player.id === "hero")).toBe(true);
    expect(save.world.players.find((player) => player.isHero)?.usagePlan).toBeDefined();
  });

  it("advances the shared world until the hero receives a real game result", () => {
    let save = activeCollegeCareer("hero-college-week");
    for (let day = 0; day < 15; day += 1) {
      if (save.football.college.heroCareer?.pendingDecision) {
        const option = save.football.college.heroCareer.pendingDecision.options[0];
        if (!option) throw new Error("Decision has no option");
        save = resolveCollegeHeroDecision(save, option.id);
      }
      save = advanceCollegeCareerDay(save);
    }
    const career = save.football.college.heroCareer;
    expect(save.world.competition.schedule.some((game) => game.status === "complete" && (game.homeTeamId === career?.teamId || game.awayTeamId === career?.teamId))).toBe(true);
    expect(career?.gameLog.length).toBeGreaterThan(0);
    expect(career?.seasonSnaps).toBeGreaterThanOrEqual(0);
    expect(save.football.college.positionRoom[0]?.depthRank).toBe(1);
  });

  it("turns a portal decision into persistent world state", () => {
    const save = activeCollegeCareer("hero-college-portal");
    const career = save.football.college.heroCareer;
    if (!career) throw new Error("No hero career");
    const withDecision: CareerSave = {
      ...save,
      football: {
        ...save.football,
        college: {
          ...save.football.college,
          heroCareer: {
            ...career,
            pendingDecision: {
              id: "portal-decision",
              kind: "transfer-window",
              createdWeek: 8,
              title: "Роль не появилась",
              detail: "Нужно решить будущее.",
              options: [
                { id: "stay", label: "Остаться", detail: "Продолжить борьбу." },
                { id: "request-portal", label: "Портал", detail: "Запросить трансфер." },
              ],
            },
          },
        },
      },
    };
    const resolved = resolveCollegeHeroDecision(withDecision, "request-portal");
    expect(resolved.football.college.heroCareer?.transferIntent).toBe("portal");
    expect(resolved.world.players.find((player) => player.isHero)?.transferStatus).toBe("portal");
    expect(resolved.world.transactions.at(-1)?.kind).toBe("portal-entry");
  });
});
