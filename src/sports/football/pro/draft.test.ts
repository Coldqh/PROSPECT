import { describe, expect, it } from "vitest";
import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import { createFootballEcosystem } from "../ecosystem/createEcosystem";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";
import { collegeDecisionPrograms, reportToCollege, setCollegeOnboardingPriority, signCollegeAgreement } from "../college/transition";
import {
  acceptProfessionalCampInvite,
  advanceProfessionalTrainingCamp,
  completeProfessionalEvaluation,
  openProfessionalDraftProcess,
  resolveProfessionalDeclaration,
  runProfessionalDraft,
  selectProfessionalAgent,
} from "./draft";

function draftEligibleCareer(seed = "professional-draft-test"): CareerSave {
  const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
  const first = generated.football.recruitment.programs[0];
  if (!first) throw new Error("No recruiting program");
  const football = {
    ...generated.football,
    season: { ...generated.football.season, phase: "complete" as const, week: 8 },
    recruitment: {
      ...generated.football.recruitment,
      offers: 1,
      programs: generated.football.recruitment.programs.map((program, index) => index === 0 ? {
        ...program,
        stage: "offered" as const,
        interest: 95,
        academicEligible: true,
        offer: {
          id: `${program.id}:offer`,
          issuedWeek: 8,
          scholarship: "full" as const,
          projectedRole: "rotation-path" as const,
          expiresAfterWeek: 8,
        },
      } : program),
    },
  };
  const save: CareerSave = {
    meta: {
      id: "professional-career",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sport: "american-football",
      worldSeed: seed,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2030-01-12T00:00:00.000Z",
      currentDate: { year: 2030, month: 1, day: 12 },
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
  const active = setCollegeOnboardingPriority(reportToCollege(signCollegeAgreement(save, program.id, "scholarship")), "compete-now");
  const career = active.football.college.heroCareer;
  if (!career) throw new Error("No college career");
  return {
    ...active,
    meta: { ...active.meta, currentDate: { year: 2030, month: 1, day: 12 } },
    football: {
      ...active.football,
      ratings: { ...active.football.ratings, overall: 82, athleticism: 86, technique: 81, footballIq: 78 },
      college: {
        ...active.football.college,
        heroCareer: {
          ...career,
          classYear: "Senior",
          eligibilityYears: 1,
          careerGames: 31,
          careerStarts: 21,
          careerSnaps: 1280,
          seasonHistory: [
            { seasonYear: 2027, classYear: "Freshman", teamId: career.teamId, teamName: program.shortName, wins: 8, losses: 4, role: "rotation", gamesPlayed: 10, starts: 2, snaps: 240, averageGrade: "B", redshirted: false, overallStart: 71, overallEnd: 74, coachTrustEnd: 66, awards: [] },
            { seasonYear: 2028, classYear: "Sophomore", teamId: career.teamId, teamName: program.shortName, wins: 10, losses: 3, role: "starter", gamesPlayed: 12, starts: 11, snaps: 680, averageGrade: "A", redshirted: false, overallStart: 74, overallEnd: 79, coachTrustEnd: 82, awards: ["All-Conference"] },
          ],
        },
      },
    },
    world: {
      ...active.world,
      seasonYear: 2029,
      players: active.world.players.map((player) => player.isHero ? { ...player, classYear: "Senior" as const, eligibilityYears: 1, overall: 82, form: 84 } : player),
    },
  };
}

function lowStockCareer(seed = "professional-undrafted"): CareerSave {
  const save = draftEligibleCareer(seed);
  const career = save.football.college.heroCareer;
  if (!career) throw new Error("No college career");
  return {
    ...save,
    character: {
      ...save.character,
      condition: { ...save.character.condition, health: 20 },
      physical: { ...save.character.physical, speed: 20, explosiveness: 20, agility: 20, strength: 20, stamina: 20 },
    },
    football: {
      ...save.football,
      ratings: { ...save.football.ratings, overall: 20, athleticism: 20, technique: 20, footballIq: 20 },
      college: {
        ...save.football.college,
        heroCareer: { ...career, careerGames: 0, careerStarts: 0, careerSnaps: 0, seasonHistory: [] },
      },
    },
  };
}

function reachCamp(save: CareerSave): CareerSave {
  let next = openProfessionalDraftProcess(save);
  next = resolveProfessionalDeclaration(next, "declare");
  next = selectProfessionalAgent(next, next.football.professional.agents[0]!.id);
  next = completeProfessionalEvaluation(next, "technical");
  next = runProfessionalDraft(next);
  const invite = next.football.professional.campInvites[0];
  if (!invite) throw new Error("No camp invite");
  return acceptProfessionalCampInvite(next, invite.teamId);
}

describe("professional draft ecosystem", () => {
  it("creates an autonomous seven-round draft around the hero", () => {
    const opened = openProfessionalDraftProcess(draftEligibleCareer());
    expect(opened.meta.phase).toBe("professional-draft");
    expect(opened.football.professional.teams).toHaveLength(16);
    expect(opened.football.professional.draftOrder).toHaveLength(112);
    expect(opened.football.professional.prospects.some((prospect) => prospect.isHero)).toBe(true);
    expect(opened.football.professional.status).toBe("decision");
  });

  it("runs declaration, representation, evaluation and the complete draft", () => {
    let save = openProfessionalDraftProcess(draftEligibleCareer("professional-full-draft"));
    save = resolveProfessionalDeclaration(save, "declare");
    expect(save.football.college.heroCareer?.eligibilityYears).toBe(0);
    expect(save.world.players.find((player) => player.isHero)?.eligibility.athleticallyEligible).toBe(false);
    save = selectProfessionalAgent(save, save.football.professional.agents[1]!.id);
    save = completeProfessionalEvaluation(save, "athletic");
    save = runProfessionalDraft(save);
    expect(save.football.professional.draftResults).toHaveLength(112);
    expect(["drafted", "undrafted"]).toContain(save.football.professional.status);
    expect(save.football.professional.campInvites.length).toBeGreaterThan(0);
    expect(new Set(save.football.professional.draftResults.map((pick) => pick.prospectId)).size).toBe(112);
  });

  it("updates club needs as the autonomous draft fills rosters", () => {
    let save = openProfessionalDraftProcess(draftEligibleCareer("professional-needs"));
    const needsBefore = Object.fromEntries(save.football.professional.teams.map((team) => [team.id, { ...team.needs }]));
    save = resolveProfessionalDeclaration(save, "declare");
    save = selectProfessionalAgent(save, save.football.professional.agents[0]!.id);
    save = completeProfessionalEvaluation(save, "technical");
    save = runProfessionalDraft(save);
    expect(save.football.professional.teams.some((team) =>
      Object.entries(team.needs).some(([position, need]) => need < needsBefore[team.id]![position as keyof typeof team.needs]),
    )).toBe(true);
  });

  it("keeps the undrafted route alive for a prospect below the draft line", () => {
    let save = openProfessionalDraftProcess(lowStockCareer());
    save = resolveProfessionalDeclaration(save, "declare");
    save = selectProfessionalAgent(save, save.football.professional.agents[2]!.id);
    save = completeProfessionalEvaluation(save, "interview");
    save = runProfessionalDraft(save);
    expect(save.football.professional.status).toBe("undrafted");
    expect(save.football.professional.heroSelection).toBeUndefined();
    expect(save.football.professional.campInvites).toHaveLength(5);
  });

  it("allows an eligible athlete to return to college before declaring", () => {
    const opened = openProfessionalDraftProcess(draftEligibleCareer("professional-return"));
    const returned = resolveProfessionalDeclaration(opened, "return-college");
    expect(returned.meta.phase).toBe("college-season");
    expect(returned.football.stage).toBe("college-season");
    expect(returned.football.professional.status).toBe("dormant");
    expect(returned.football.professional.declared).toBe(false);
  });

  it("turns camp performance into a persistent roster decision", () => {
    let save = reachCamp(draftEligibleCareer("professional-camp"));
    for (let day = 0; day < 4; day += 1) save = advanceProfessionalTrainingCamp(save, "balanced");
    expect(["roster", "practice-squad", "cut"]).toContain(save.football.professional.status);
    expect(save.football.professional.camp?.sessions).toHaveLength(4);
    expect(save.football.professional.camp?.outcome).toBeDefined();
    expect(save.football.professional.contract?.teamId).toBe(save.football.professional.camp?.teamId);
    expect(save.football.professional.contract?.agentFee).toBeGreaterThan(0);
    expect(save.meta.phase).toBe("professional-career");
    expect(save.football.stage).toBe("professional-career");
  });

  it("is deterministic for the same world seed", () => {
    const run = () => {
      let save = openProfessionalDraftProcess(draftEligibleCareer("professional-deterministic"));
      save = resolveProfessionalDeclaration(save, "declare");
      save = selectProfessionalAgent(save, save.football.professional.agents[0]!.id);
      save = completeProfessionalEvaluation(save, "interview");
      return runProfessionalDraft(save).football.professional;
    };
    expect(run()).toEqual(run());
  });
});
