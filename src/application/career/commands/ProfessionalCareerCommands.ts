import {
  acceptProfessionalCampInvite,
  advanceProfessionalTrainingCamp,
  completeProfessionalEvaluation,
  openProfessionalDraftProcess,
  resolveProfessionalDeclaration,
  runProfessionalDraft,
  selectProfessionalAgent,
} from "../../../sports/football/pro/draft";
import {
  acceptProfessionalFreeAgentOffer,
  advanceProfessionalOffseason,
  advanceProfessionalWeek,
  finalizeProfessionalMatch,
  setProfessionalWeekFocus,
} from "../../../sports/football/pro/league";
import type {
  ProfessionalCampApproach,
  ProfessionalEvaluationFocus,
  ProfessionalWeekFocus,
} from "../../../sports/football/pro/types";
import type { CareerSave } from "../../../storage/saves/schema";
import type { CareerMutationStore } from "../CareerMutationStore";

export class ProfessionalCareerCommands {
  constructor(private readonly store: CareerMutationStore) {}

  async openDraft(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, openProfessionalDraftProcess);
  }

  async resolveDeclaration(
    careerId: string,
    optionId: "return-college" | "declare",
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => resolveProfessionalDeclaration(current, optionId));
  }

  async selectAgent(careerId: string, agentId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => selectProfessionalAgent(current, agentId));
  }

  async completeEvaluation(
    careerId: string,
    focus: ProfessionalEvaluationFocus,
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => completeProfessionalEvaluation(current, focus));
  }

  async runDraft(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, runProfessionalDraft);
  }

  async acceptCampInvite(careerId: string, teamId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => acceptProfessionalCampInvite(current, teamId));
  }

  async advanceTrainingCamp(
    careerId: string,
    approach: ProfessionalCampApproach,
  ): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => advanceProfessionalTrainingCamp(current, approach));
  }

  async finalizeMatch(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, finalizeProfessionalMatch);
  }

  async setWeekFocus(careerId: string, focus: ProfessionalWeekFocus): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => setProfessionalWeekFocus(current, focus));
  }

  async advanceWeek(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, advanceProfessionalWeek);
  }

  async advanceOffseason(careerId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, advanceProfessionalOffseason);
  }

  async acceptFreeAgentOffer(careerId: string, teamId: string): Promise<CareerSave> {
    return this.store.mutate(careerId, (current) => acceptProfessionalFreeAgentOffer(current, teamId));
  }
}
