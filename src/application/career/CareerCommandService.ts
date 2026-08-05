import { toGameDateKey } from "../../core/calendar/types";
import { createInitialLifeState } from "../../core/life/createInitialLifeState";
import type { TrainingIntensity, WeeklyPlanTemplateId } from "../../core/life/types";
import { createSeed } from "../../core/random/createSeed";
import { loadSportModule } from "../../core/sports/sportRegistry";
import type { FootballCareerSetup } from "../../sports/football/career/types";
import { finalizeCollegeMatch, isCollegeMatchAwaitingResolution, resolveCollegeHeroDecision } from "../../sports/football/college/heroCareer";
import { reportToCollege, setCollegeOnboardingPriority, signCollegeAgreement } from "../../sports/football/college/transition";
import type { CollegeEntryRoute, CollegeOnboardingPriority } from "../../sports/football/college/types";
import { createFootballEcosystem } from "../../sports/football/ecosystem/createEcosystem";
import { resolveMatchDecision, startMatch } from "../../sports/football/matches/simulateMatch";
import type { MatchParticipationMode } from "../../sports/football/matches/types";
import {
  acceptProfessionalCampInvite,
  advanceProfessionalTrainingCamp,
  completeProfessionalEvaluation,
  openProfessionalDraftProcess,
  resolveProfessionalDeclaration,
  runProfessionalDraft,
  selectProfessionalAgent,
} from "../../sports/football/pro/draft";
import {
  acceptProfessionalFreeAgentOffer,
  advanceProfessionalOffseason,
  advanceProfessionalWeek,
  finalizeProfessionalMatch,
  isProfessionalMatchAwaitingResolution,
  setProfessionalWeekFocus,
} from "../../sports/football/pro/league";
import type {
  ProfessionalCampApproach,
  ProfessionalEvaluationFocus,
  ProfessionalWeekFocus,
} from "../../sports/football/pro/types";
import { performRecruitingAction } from "../../sports/football/recruiting/updateRecruiting";
import type { RecruitingActionId } from "../../sports/football/recruiting/types";
import { commitToCollege, withdrawCollegeCommitment } from "../../sports/football/recruiting/visits";
import { createFootballRelationships } from "../../sports/football/relationships/createFootballRelationships";
import { resolveRelationshipEvent } from "../../sports/football/relationships/relationshipEvents";
import {
  advanceFootballCareerDay,
  updateTrainingPlan as applyTrainingPlan,
  updateWeeklyPlan as applyWeeklyPlan,
} from "../../sports/football/simulation/advanceFootballDay";
import type { TrainingFocusId } from "../../sports/football/training/types";
import { CURRENT_SCHEMA_VERSION, type CareerSave } from "../../storage/saves/schema";
import type { CareerMutationStore } from "./CareerMutationStore";

export class CareerCommandService {
  constructor(private readonly store: CareerMutationStore) {}

  async createFootballCareer(setup: FootballCareerSetup): Promise<CareerSave> {
    const careerId = crypto.randomUUID();
    const worldSeed = createSeed("football");
    const now = new Date().toISOString();
    const footballModule = await loadSportModule("american-football");
    const generated = footballModule.createInitialState(worldSeed, setup) as Pick<CareerSave, "character" | "football">;

    const save: CareerSave = {
      meta: {
        id: careerId,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sport: "american-football",
        worldSeed,
        createdAt: now,
        updatedAt: now,
        currentDate: { year: 2026, month: 8, day: 17 },
        phase: "high-school-preseason",
        revision: 0,
      },
      character: generated.character,
      life: createInitialLifeState(),
      football: generated.football,
      relationships: createFootballRelationships(worldSeed, generated.character, generated.football),
      world: createFootballEcosystem(worldSeed, generated.character, generated.football, { year: 2026, month: 8, day: 17 }),
      history: [
        {
          id: crypto.randomUUID(),
          occurredAt: now,
          type: "career-created",
          title: "Первый день",
          description: `${generated.character.identity.fullName} начинает последний школьный сезон в ${generated.football.school.name}.`,
        },
      ],
    };

    return this.store.save(save);
  }

  async updateWeeklyPlan(
    careerId: string,
    templateId: WeeklyPlanTemplateId,
    intensity: TrainingIntensity,
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => {
      if (current.meta.phase === "college-orientation") throw new Error("Weekly planning unlocks after college orientation");
      return applyWeeklyPlan(current, templateId, intensity);
    });
  }

  async updateTrainingPlan(
    careerId: string,
    focusId: TrainingFocusId,
    intensity: TrainingIntensity,
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => {
      if (current.meta.phase === "college-orientation") throw new Error("Training planning unlocks after college orientation");
      return applyTrainingPlan(current, focusId, intensity);
    });
  }

  async startMatch(careerId: string, mode: MatchParticipationMode, analysisMode: boolean): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => {
      if (current.meta.phase === "college-season") {
        if (!isCollegeMatchAwaitingResolution(current)) throw new Error("No college match is ready");
        return startMatch(current, mode, analysisMode);
      }
      if (current.meta.phase === "professional-career") {
        const weeklyPlan = current.football.professional.heroCareer?.weeklyPlan;
        const prepared = weeklyPlan && !weeklyPlan.resolved ? setProfessionalWeekFocus(current, weeklyPlan.focus) : current;
        if (!isProfessionalMatchAwaitingResolution(prepared)) throw new Error("No professional match is ready");
        return startMatch(prepared, mode, analysisMode);
      }
      if (current.meta.phase !== "high-school-preseason") throw new Error("Interactive match mode is unavailable");
      if (current.relationships.pendingEvent) throw new Error("Relationship event must be resolved before the match");
      if (toGameDateKey(current.meta.currentDate) !== toGameDateKey(current.football.match.scheduledDate)) throw new Error("Match is not scheduled for today");
      return startMatch(current, mode, analysisMode);
    });
  }

  async resolveMatchDecision(careerId: string, optionId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => resolveMatchDecision(current, optionId));
  }

  async finalizeCollegeMatch(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, finalizeCollegeMatch);
  }

  async resolveRelationshipEvent(careerId: string, optionId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => resolveRelationshipEvent(current, optionId));
  }

  async performRecruitingAction(careerId: string, programId: string, actionId: RecruitingActionId): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => performRecruitingAction(current, programId, actionId));
  }

  async commitToCollege(careerId: string, programId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => commitToCollege(current, programId));
  }

  async withdrawCollegeCommitment(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, withdrawCollegeCommitment);
  }

  async signCollegeAgreement(careerId: string, programId: string, route: CollegeEntryRoute): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => signCollegeAgreement(current, programId, route));
  }

  async reportToCollege(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, reportToCollege);
  }

  async setCollegeOnboardingPriority(careerId: string, priority: CollegeOnboardingPriority): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => setCollegeOnboardingPriority(current, priority));
  }

  async resolveCollegeHeroDecision(careerId: string, optionId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => resolveCollegeHeroDecision(current, optionId));
  }

  async openProfessionalDraft(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, openProfessionalDraftProcess);
  }

  async resolveProfessionalDeclaration(careerId: string, optionId: "return-college" | "declare"): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => resolveProfessionalDeclaration(current, optionId));
  }

  async selectProfessionalAgent(careerId: string, agentId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => selectProfessionalAgent(current, agentId));
  }

  async completeProfessionalEvaluation(careerId: string, focus: ProfessionalEvaluationFocus): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => completeProfessionalEvaluation(current, focus));
  }

  async runProfessionalDraft(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, runProfessionalDraft);
  }

  async acceptProfessionalCampInvite(careerId: string, teamId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => acceptProfessionalCampInvite(current, teamId));
  }

  async advanceProfessionalTrainingCamp(careerId: string, approach: ProfessionalCampApproach): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => advanceProfessionalTrainingCamp(current, approach));
  }

  async finalizeProfessionalMatch(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, finalizeProfessionalMatch);
  }

  async setProfessionalWeekFocus(careerId: string, focus: ProfessionalWeekFocus): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => setProfessionalWeekFocus(current, focus));
  }

  async advanceProfessionalWeek(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, advanceProfessionalWeek);
  }

  async advanceProfessionalOffseason(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, advanceProfessionalOffseason);
  }

  async acceptProfessionalFreeAgentOffer(careerId: string, teamId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => acceptProfessionalFreeAgentOffer(current, teamId));
  }

  async advanceDay(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => {
      if (current.meta.phase === "professional-draft" || current.meta.phase === "professional-career") throw new Error("Use professional career actions in this phase");
      if (current.meta.phase === "college-orientation") throw new Error("College orientation must be completed before advancing");
      if (current.meta.phase === "high-school-preseason" && current.relationships.pendingEvent) {
        throw new Error("Relationship event must be resolved before advancing");
      }
      if (current.meta.phase === "high-school-preseason" && current.life.dayIndex === 5 && current.football.match.status !== "complete") {
        throw new Error("Match must be completed before advancing Saturday");
      }
      if (current.meta.phase === "college-season" && isCollegeMatchAwaitingResolution(current)) {
        throw new Error(current.football.match.status === "complete" ? "College match must be finalized" : "College match must be played");
      }
      return advanceFootballCareerDay(current);
    });
  }
}
