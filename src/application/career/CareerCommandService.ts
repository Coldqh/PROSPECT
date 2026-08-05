import type { TrainingIntensity, WeeklyPlanTemplateId } from "../../core/life/types";
import type { FootballCareerSetup } from "../../sports/football/career/types";
import type { CollegeEntryRoute, CollegeOnboardingPriority } from "../../sports/football/college/types";
import type { MatchParticipationMode } from "../../sports/football/matches/types";
import type {
  ProfessionalCampApproach,
  ProfessionalEvaluationFocus,
  ProfessionalWeekFocus,
} from "../../sports/football/pro/types";
import type { RecruitingActionId } from "../../sports/football/recruiting/types";
import type { TrainingFocusId } from "../../sports/football/training/types";
import type { CareerSave } from "../../storage/saves/schema";
import type { CareerMutationStore } from "./CareerMutationStore";
import { CareerPlanningCommands } from "./commands/CareerPlanningCommands";
import { CollegeCareerCommands } from "./commands/CollegeCareerCommands";
import { MatchCommands } from "./commands/MatchCommands";
import { ProfessionalCareerCommands } from "./commands/ProfessionalCareerCommands";
import { SchoolCareerCommands } from "./commands/SchoolCareerCommands";

export class CareerCommandService {
  private readonly planning: CareerPlanningCommands;
  private readonly school: SchoolCareerCommands;
  private readonly college: CollegeCareerCommands;
  private readonly match: MatchCommands;
  private readonly professional: ProfessionalCareerCommands;

  constructor(private readonly store: CareerMutationStore) {
    this.planning = new CareerPlanningCommands(store);
    this.school = new SchoolCareerCommands(store);
    this.college = new CollegeCareerCommands(store);
    this.match = new MatchCommands(store);
    this.professional = new ProfessionalCareerCommands(store);
  }

  createFootballCareer(setup: FootballCareerSetup): Promise<CareerSave> {
    return this.school.createFootballCareer(setup);
  }

  updateWeeklyPlan(
    careerId: string,
    templateId: WeeklyPlanTemplateId,
    intensity: TrainingIntensity,
  ): Promise<CareerSave> {
    return this.planning.updateWeeklyPlan(careerId, templateId, intensity);
  }

  updateTrainingPlan(
    careerId: string,
    focusId: TrainingFocusId,
    intensity: TrainingIntensity,
  ): Promise<CareerSave> {
    return this.planning.updateTrainingPlan(careerId, focusId, intensity);
  }

  startMatch(careerId: string, mode: MatchParticipationMode, analysisMode: boolean): Promise<CareerSave> {
    return this.match.start(careerId, mode, analysisMode);
  }

  resolveMatchDecision(careerId: string, optionId: string): Promise<CareerSave> {
    return this.match.resolveDecision(careerId, optionId);
  }

  finalizeCollegeMatch(careerId: string): Promise<CareerSave> {
    return this.college.finalizeMatch(careerId);
  }

  resolveRelationshipEvent(careerId: string, optionId: string): Promise<CareerSave> {
    return this.school.resolveRelationshipEvent(careerId, optionId);
  }

  performRecruitingAction(
    careerId: string,
    programId: string,
    actionId: RecruitingActionId,
  ): Promise<CareerSave> {
    return this.school.performRecruitingAction(careerId, programId, actionId);
  }

  commitToCollege(careerId: string, programId: string): Promise<CareerSave> {
    return this.school.commitToCollege(careerId, programId);
  }

  withdrawCollegeCommitment(careerId: string): Promise<CareerSave> {
    return this.school.withdrawCollegeCommitment(careerId);
  }

  signCollegeAgreement(
    careerId: string,
    programId: string,
    route: CollegeEntryRoute,
  ): Promise<CareerSave> {
    return this.college.signCollegeAgreement(careerId, programId, route);
  }

  reportToCollege(careerId: string): Promise<CareerSave> {
    return this.college.reportToCollege(careerId);
  }

  setCollegeOnboardingPriority(
    careerId: string,
    priority: CollegeOnboardingPriority,
  ): Promise<CareerSave> {
    return this.college.setCollegeOnboardingPriority(careerId, priority);
  }

  resolveCollegeHeroDecision(careerId: string, optionId: string): Promise<CareerSave> {
    return this.college.resolveCollegeHeroDecision(careerId, optionId);
  }

  openProfessionalDraft(careerId: string): Promise<CareerSave> {
    return this.professional.openDraft(careerId);
  }

  resolveProfessionalDeclaration(
    careerId: string,
    optionId: "return-college" | "declare",
  ): Promise<CareerSave> {
    return this.professional.resolveDeclaration(careerId, optionId);
  }

  selectProfessionalAgent(careerId: string, agentId: string): Promise<CareerSave> {
    return this.professional.selectAgent(careerId, agentId);
  }

  completeProfessionalEvaluation(
    careerId: string,
    focus: ProfessionalEvaluationFocus,
  ): Promise<CareerSave> {
    return this.professional.completeEvaluation(careerId, focus);
  }

  runProfessionalDraft(careerId: string): Promise<CareerSave> {
    return this.professional.runDraft(careerId);
  }

  acceptProfessionalCampInvite(careerId: string, teamId: string): Promise<CareerSave> {
    return this.professional.acceptCampInvite(careerId, teamId);
  }

  advanceProfessionalTrainingCamp(
    careerId: string,
    approach: ProfessionalCampApproach,
  ): Promise<CareerSave> {
    return this.professional.advanceTrainingCamp(careerId, approach);
  }

  finalizeProfessionalMatch(careerId: string): Promise<CareerSave> {
    return this.professional.finalizeMatch(careerId);
  }

  setProfessionalWeekFocus(careerId: string, focus: ProfessionalWeekFocus): Promise<CareerSave> {
    return this.professional.setWeekFocus(careerId, focus);
  }

  advanceProfessionalWeek(careerId: string): Promise<CareerSave> {
    return this.professional.advanceWeek(careerId);
  }

  advanceProfessionalOffseason(careerId: string): Promise<CareerSave> {
    return this.professional.advanceOffseason(careerId);
  }

  acceptProfessionalFreeAgentOffer(careerId: string, teamId: string): Promise<CareerSave> {
    return this.professional.acceptFreeAgentOffer(careerId, teamId);
  }

  async advanceDay(careerId: string): Promise<CareerSave> {
    const current = await this.store.load(careerId);

    if (current.meta.phase === "high-school-preseason") {
      return this.school.advanceDay(careerId);
    }
    if (current.meta.phase === "college-season") {
      return this.college.advanceDay(careerId);
    }
    if (current.meta.phase === "college-orientation") {
      throw new Error("College orientation must be completed before advancing");
    }
    throw new Error("Use professional career actions in this phase");
  }
}
