import type { FootballCareerSetup } from "../../sports/football/career/types";
import {
  advanceFootballCareerDay,
  updateTrainingPlan as applyTrainingPlan,
  updateWeeklyPlan as applyWeeklyPlan,
} from "../../sports/football/simulation/advanceFootballDay";
import { createSeed } from "../../core/random/createSeed";
import { createInitialLifeState } from "../../core/life/createInitialLifeState";
import type { TrainingIntensity, WeeklyPlanTemplateId } from "../../core/life/types";
import type { TrainingFocusId } from "../../sports/football/training/types";
import { resolveMatchDecision, startMatch } from "../../sports/football/matches/simulateMatch";
import { createFootballRelationships } from "../../sports/football/relationships/createFootballRelationships";
import { createFootballEcosystem } from "../../sports/football/ecosystem/createEcosystem";
import { resolveRelationshipEvent } from "../../sports/football/relationships/relationshipEvents";
import { performRecruitingAction } from "../../sports/football/recruiting/updateRecruiting";
import { commitToCollege, withdrawCollegeCommitment } from "../../sports/football/recruiting/visits";
import type { RecruitingActionId } from "../../sports/football/recruiting/types";
import type { CollegeEntryRoute, CollegeOnboardingPriority } from "../../sports/football/college/types";
import { reportToCollege, setCollegeOnboardingPriority, signCollegeAgreement } from "../../sports/football/college/transition";
import { finalizeCollegeMatch, isCollegeMatchAwaitingResolution, resolveCollegeHeroDecision } from "../../sports/football/college/heroCareer";
import type { ProfessionalCampApproach, ProfessionalEvaluationFocus } from "../../sports/football/pro/types";
import {
  acceptProfessionalCampInvite,
  advanceProfessionalTrainingCamp,
  completeProfessionalEvaluation,
  openProfessionalDraftProcess,
  resolveProfessionalDeclaration,
  runProfessionalDraft,
  selectProfessionalAgent,
} from "../../sports/football/pro/draft";
import { loadSportModule } from "../../core/sports/sportRegistry";
import { createChecksum } from "./checksum";
import { migrateCareerSave } from "./migrations";
import {
  CURRENT_SCHEMA_VERSION,
  type CareerIndexRecord,
  type CareerSave,
} from "./schema";
import { getDatabase, type SnapshotRecord } from "../indexedDb/database";

const MAX_AUTOSAVE_BACKUPS = 5;

function snapshotId(careerId: string, revision: number): string {
  return `${careerId}:${revision.toString().padStart(8, "0")}`;
}

function toIndexRecord(save: CareerSave): CareerIndexRecord {
  return {
    id: save.meta.id,
    displayName: save.character.identity.fullName,
    sport: save.meta.sport,
    phase: save.meta.phase,
    currentDate: `${save.meta.currentDate.year}-${String(save.meta.currentDate.month).padStart(2, "0")}-${String(save.meta.currentDate.day).padStart(2, "0")}`,
    updatedAt: save.meta.updatedAt,
    revision: save.meta.revision,
    position: save.football.position,
    jerseyNumber: save.football.jerseyNumber,
    schoolName: save.football.professional.contract
      ? save.football.professional.contract.teamName
      : (save.football.college.status === "orientation" || save.football.college.status === "active") && save.football.college.program
        ? save.football.college.program.name
        : save.football.school.name,
    stateCode: save.character.origin.stateCode,
    overall: save.football.ratings.overall,
    potentialBand: save.football.ratings.potentialBand,
  };
}

function toSnapshot(save: CareerSave): SnapshotRecord {
  return {
    id: snapshotId(save.meta.id, save.meta.revision),
    careerId: save.meta.id,
    revision: save.meta.revision,
    schemaVersion: save.meta.schemaVersion,
    checksum: createChecksum(save),
    createdAt: save.meta.updatedAt,
    state: save,
  };
}

async function pruneBackups(careerId: string): Promise<void> {
  const database = await getDatabase();
  const records = await database.getAllFromIndex("autosaveBackups", "by-careerId", careerId);
  records.sort((left, right) => right.revision - left.revision);

  const obsolete = records.slice(MAX_AUTOSAVE_BACKUPS);
  const transaction = database.transaction("autosaveBackups", "readwrite");
  await Promise.all(obsolete.map((record) => transaction.store.delete(record.id)));
  await transaction.done;
}

export class CareerRepository {
  async list(): Promise<CareerIndexRecord[]> {
    const database = await getDatabase();
    const records = await database.getAll("careerIndex");
    const normalized: CareerIndexRecord[] = [];

    for (const record of records) {
      if ("position" in record && typeof record.position === "string") {
        normalized.push(record);
        continue;
      }

      const migrated = await this.load(record.id);
      normalized.push(toIndexRecord(migrated));
    }

    return normalized.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

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

    return this.save(save);
  }


  async updateWeeklyPlan(
    careerId: string,
    templateId: WeeklyPlanTemplateId,
    intensity: TrainingIntensity,
  ): Promise<CareerSave> {
    const current = await this.load(careerId);
    if (current.meta.phase === "college-orientation") throw new Error("Weekly planning unlocks after college orientation");
    return this.save(applyWeeklyPlan(current, templateId, intensity));
  }


  async updateTrainingPlan(
    careerId: string,
    focusId: TrainingFocusId,
    intensity: TrainingIntensity,
  ): Promise<CareerSave> {
    const current = await this.load(careerId);
    if (current.meta.phase === "college-orientation") throw new Error("Training planning unlocks after college orientation");
    return this.save(applyTrainingPlan(current, focusId, intensity));
  }


  async startMatch(careerId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    if (current.meta.phase === "college-season") {
      if (!isCollegeMatchAwaitingResolution(current)) throw new Error("No college match is ready");
      return this.save(startMatch(current));
    }
    if (current.meta.phase !== "high-school-preseason") throw new Error("Interactive match mode is unavailable");
    if (current.relationships.pendingEvent) throw new Error("Relationship event must be resolved before the match");
    if (current.life.dayIndex !== 5) throw new Error("Match is only available on Saturday");
    return this.save(startMatch(current));
  }

  async resolveMatchDecision(careerId: string, optionId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(resolveMatchDecision(current, optionId));
  }

  async finalizeCollegeMatch(careerId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(finalizeCollegeMatch(current));
  }

  async resolveRelationshipEvent(careerId: string, optionId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(resolveRelationshipEvent(current, optionId));
  }

  async performRecruitingAction(careerId: string, programId: string, actionId: RecruitingActionId): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(performRecruitingAction(current, programId, actionId));
  }

  async commitToCollege(careerId: string, programId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(commitToCollege(current, programId));
  }

  async withdrawCollegeCommitment(careerId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(withdrawCollegeCommitment(current));
  }


  async signCollegeAgreement(careerId: string, programId: string, route: CollegeEntryRoute): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(signCollegeAgreement(current, programId, route));
  }

  async reportToCollege(careerId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(reportToCollege(current));
  }

  async setCollegeOnboardingPriority(careerId: string, priority: CollegeOnboardingPriority): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(setCollegeOnboardingPriority(current, priority));
  }


  async resolveCollegeHeroDecision(careerId: string, optionId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(resolveCollegeHeroDecision(current, optionId));
  }

  async openProfessionalDraft(careerId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(openProfessionalDraftProcess(current));
  }

  async resolveProfessionalDeclaration(careerId: string, optionId: "return-college" | "declare"): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(resolveProfessionalDeclaration(current, optionId));
  }

  async selectProfessionalAgent(careerId: string, agentId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(selectProfessionalAgent(current, agentId));
  }

  async completeProfessionalEvaluation(careerId: string, focus: ProfessionalEvaluationFocus): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(completeProfessionalEvaluation(current, focus));
  }

  async runProfessionalDraft(careerId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(runProfessionalDraft(current));
  }

  async acceptProfessionalCampInvite(careerId: string, teamId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(acceptProfessionalCampInvite(current, teamId));
  }

  async advanceProfessionalTrainingCamp(careerId: string, approach: ProfessionalCampApproach): Promise<CareerSave> {
    const current = await this.load(careerId);
    return this.save(advanceProfessionalTrainingCamp(current, approach));
  }

  async advanceDay(careerId: string): Promise<CareerSave> {
    const current = await this.load(careerId);
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
    return this.save(advanceFootballCareerDay(current));
  }

  async save(input: CareerSave): Promise<CareerSave> {
    const now = new Date().toISOString();
    const save: CareerSave = {
      ...input,
      meta: {
        ...input.meta,
        updatedAt: now,
        revision: input.meta.revision + 1,
      },
    };

    const validated = careerSaveSchemaSafeParse(save);
    const database = await getDatabase();
    const snapshot = toSnapshot(validated);
    const previous = await this.readLatestSnapshot(validated.meta.id);
    const transaction = database.transaction(
      ["careerIndex", "careerSnapshots", "autosaveBackups"],
      "readwrite",
    );

    if (previous) {
      await transaction.objectStore("autosaveBackups").put(previous);
    }

    await transaction.objectStore("careerSnapshots").put(snapshot);
    await transaction.objectStore("careerIndex").put(toIndexRecord(validated));
    await transaction.done;
    await pruneBackups(validated.meta.id);

    return validated;
  }

  async load(careerId: string): Promise<CareerSave> {
    const latest = await this.readLatestSnapshot(careerId);

    if (latest && latest.checksum === createChecksum(latest.state)) {
      const migration = migrateCareerSave(latest.state);
      if (migration.migratedFrom !== undefined) {
        return this.save({ ...migration.save, meta: { ...migration.save.meta, revision: latest.revision } });
      }
      return migration.save;
    }

    const database = await getDatabase();
    const backups = await database.getAllFromIndex("autosaveBackups", "by-careerId", careerId);
    backups.sort((left, right) => right.revision - left.revision);

    for (const backup of backups) {
      if (backup.checksum !== createChecksum(backup.state)) {
        continue;
      }
      const migration = migrateCareerSave(backup.state);
      return migration.migratedFrom !== undefined ? this.save(migration.save) : migration.save;
    }

    throw new Error("Career save is missing or corrupted");
  }

  async remove(careerId: string): Promise<void> {
    const database = await getDatabase();
    const transaction = database.transaction(
      ["careerIndex", "careerSnapshots", "autosaveBackups", "manualSaves"],
      "readwrite",
    );

    await transaction.objectStore("careerIndex").delete(careerId);

    for (const storeName of ["careerSnapshots", "autosaveBackups", "manualSaves"] as const) {
      const store = transaction.objectStore(storeName);
      const records = await store.index("by-careerId").getAll(careerId);
      await Promise.all(records.map((record) => store.delete(record.id)));
    }

    await transaction.done;
  }

  async export(careerId: string): Promise<Blob> {
    const save = await this.load(careerId);
    return new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
  }

  async import(file: File): Promise<CareerSave> {
    const raw = JSON.parse(await file.text()) as unknown;
    const imported = migrateCareerSave(raw).save;
    const now = new Date().toISOString();
    const save: CareerSave = {
      ...imported,
      meta: {
        ...imported.meta,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        revision: 0,
      },
      history: [
        ...imported.history,
        {
          id: crypto.randomUUID(),
          occurredAt: now,
          type: "career-imported",
          title: "Карьера импортирована",
          description: "Импорт создан как отдельная карьера и не перезаписал исходное сохранение.",
        },
      ],
    };

    return this.save(save);
  }

  private async readLatestSnapshot(careerId: string): Promise<SnapshotRecord | undefined> {
    const database = await getDatabase();
    const records = await database.getAllFromIndex("careerSnapshots", "by-careerId", careerId);
    records.sort((left, right) => right.revision - left.revision);
    return records[0];
  }
}

function careerSaveSchemaSafeParse(save: CareerSave): CareerSave {
  return migrateCareerSave(save).save;
}

export const careerRepository = new CareerRepository();
