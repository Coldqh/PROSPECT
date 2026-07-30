import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../../storage/saves/schema";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { collegeDecisionPrograms, reportToCollege, setCollegeOnboardingPriority, signCollegeAgreement } from "../college/transition";
import { createFootballEcosystem } from "../ecosystem/createEcosystem";
import { createFootballRelationships } from "../relationships/createFootballRelationships";
import {
  acceptProfessionalCampInvite,
  advanceProfessionalTrainingCamp,
  completeProfessionalEvaluation,
  openProfessionalDraftProcess,
  resolveProfessionalDeclaration,
  runProfessionalDraft,
  selectProfessionalAgent,
} from "./draft";

export function cloneCareer(save: CareerSave): CareerSave {
  return structuredClone(save);
}

export function draftEligibleCareer(seed = "professional-draft-test"): CareerSave {
  const legacySetup = createLegacyFootballSetup(seed);
  const generated = createFootballCareerState(seed, {
    ...legacySetup,
    position: "EDGE",
    archetypeId: "speed-rusher",
    jerseyNumber: 55,
  });
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

export function lowStockCareer(seed = "professional-undrafted"): CareerSave {
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

export function reachCamp(save: CareerSave): CareerSave {
  let next = openProfessionalDraftProcess(save);
  next = resolveProfessionalDeclaration(next, "declare");
  next = selectProfessionalAgent(next, next.football.professional.agents[0]!.id);
  next = completeProfessionalEvaluation(next, "technical");
  next = runProfessionalDraft(next);
  const invite = next.football.professional.campInvites[0];
  if (!invite) throw new Error("No camp invite");
  return acceptProfessionalCampInvite(next, invite.teamId);
}

export function activateProfessionalCareer(save: CareerSave): CareerSave {
  const camp = save.football.professional.camp;
  if (!camp) throw new Error("No professional camp");
  let next: CareerSave = {
    ...save,
    character: {
      ...save.character,
      condition: { ...save.character.condition, health: 100, fatigue: 0, confidence: 90 },
      personality: { ...save.character.personality, coachability: 96 },
    },
    football: {
      ...save.football,
      ratings: { ...save.football.ratings, overall: 94, athleticism: 94, technique: 94, footballIq: 94 },
      professional: {
        ...save.football.professional,
        camp: { ...camp, coachTrust: 92, rosterRank: 1 },
      },
    },
  };
  for (let day = 0; day < 4; day += 1) next = advanceProfessionalTrainingCamp(next, "controlled");
  if (next.football.professional.status !== "roster") throw new Error("Test career did not reach the active roster");
  return next;
}

export function activeProfessionalCareer(seed = "professional-active-season"): CareerSave {
  return activateProfessionalCareer(reachCamp(draftEligibleCareer(seed)));
}

export function weakenCampProspect(save: CareerSave): CareerSave {
  const camp = save.football.professional.camp;
  if (!camp) throw new Error("No professional camp");
  return {
    ...save,
    character: {
      ...save.character,
      condition: { ...save.character.condition, health: 20, fatigue: 85, confidence: 20 },
      physical: { ...save.character.physical, speed: 20, explosiveness: 20, agility: 20, strength: 20, stamina: 20 },
      personality: { ...save.character.personality, coachability: 20 },
    },
    football: {
      ...save.football,
      ratings: { ...save.football.ratings, overall: 20, athleticism: 20, technique: 20, footballIq: 20 },
      professional: {
        ...save.football.professional,
        draftStock: 20,
        camp: {
          ...camp,
          coachTrust: 20,
          rosterRank: camp.playersAtPosition,
        },
      },
    },
  };
}
