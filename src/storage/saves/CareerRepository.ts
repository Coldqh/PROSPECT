import type { FootballCareerSetup } from "../../sports/football/career/types";
import {
  advanceFootballCareerDay,
  updateTrainingPlan as applyTrainingPlan,
  updateWeeklyPlan as applyWeeklyPlan,
} from "../../sports/football/simulation/advanceFootballDay";
import { createSeed } from "../../core/random/createSeed";
import { toGameDateKey } from "../../core/calendar/types";
import { createInitialLifeState } from "../../core/life/createInitialLifeState";
import type { TrainingIntensity, WeeklyPlanTemplateId } from "../../core/life/types";
import type { TrainingFocusId } from "../../sports/football/training/types";
import { resolveMatchDecision, startMatch } from "../../sports/football/matches/simulateMatch";
import type { MatchParticipationMode } from "../../sports/football/matches/types";
import { createFootballRelationships } from "../../sports/football/relationships/createFootballRelationships";
import { createFootballEcosystem } from "../../sports/football/ecosystem/createEcosystem";
import { resolveRelationshipEvent } from "../../sports/football/relationships/relationshipEvents";
import { performRecruitingAction } from "../../sports/football/recruiting/updateRecruiting";
import { commitToCollege, withdrawCollegeCommitment } from "../../sports/football/recruiting/visits";
import type { RecruitingActionId } from "../../sports/football/recruiting/types";
import type { CollegeEntryRoute, CollegeOnboardingPriority } from "../../sports/football/college/types";
import { reportToCollege, setCollegeOnboardingPriority, signCollegeAgreement } from "../../sports/football/college/transition";
import { finalizeCollegeMatch, isCollegeMatchAwaitingResolution, resolveCollegeHeroDecision } from "../../sports/football/college/heroCareer";
import type { ProfessionalCampApproach, ProfessionalEvaluationFocus, ProfessionalWeekFocus } from "../../sports/football/pro/types";
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
  setProfessionalWeekFocus,
  finalizeProfessionalMatch,
  isProfessionalMatchAwaitingResolution,
} from "../../sports/football/pro/league";
import { loadSportModule } from "../../core/sports/sportRegistry";
import { createChecksum } from "./checksum";
import { migrateCareerSave } from "./migrations";
import {
  CURRENT_SCHEMA_VERSION,
  careerSaveSchema,
  type CareerIndexRecord,
  type CareerSave,
} from "./schema";
import { getDatabase, type SnapshotRecord, type WorldSliceRecord } from "../indexedDb/database";
import {
  compactCareerSave,
  createWorldSliceRecords,
  decodeWorldSlices,
  hydrateCareerSave,
} from "./worldSlices";

const MAX_AUTOSAVE_BACKUPS = 5;
const AUTOSAVE_BACKUP_INTERVAL = 5;

export class CareerSaveConflictError extends Error {
  readonly careerId: string;
  readonly expectedRevision: number;
  readonly actualRevision: number | undefined;

  constructor(careerId: string, expectedRevision: number, actualRevision: number | undefined) {
    super(
      actualRevision === undefined
        ? `Career ${careerId} no longer exists at revision ${expectedRevision}`
        : `Career ${careerId} changed from revision ${expectedRevision} to ${actualRevision}`,
    );
    this.name = "CareerSaveConflictError";
    this.careerId = careerId;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

interface SaveOptions {
  createIfMissing?: boolean;
  archivePrevious?: boolean;
}

type CareerMutation = (current: CareerSave) => CareerSave | Promise<CareerSave>;

function snapshotId(careerId: string, revision: number): string {
  return `${careerId}:${revision.toString().padStart(8, "0")}`;
}

function careerSeasonLabel(save: CareerSave): string {
  if (save.meta.phase === "college-season" && save.football.college.heroCareer) {
    return `${save.football.college.heroCareer.seasonYear} · ${save.football.college.heroCareer.classYear}`;
  }
  if (save.meta.phase === "college-orientation") return `${save.meta.currentDate.year} · Arrival`;
  if (save.meta.phase === "professional-draft" || save.meta.phase === "professional-career") {
    return `${save.football.professional.draftYear} · Pro`;
  }
  return `${save.football.season.year} · Senior`;
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
    seasonLabel: careerSeasonLabel(save),
    stateCode: save.character.origin.stateCode,
    overall: save.football.ratings.overall,
    potentialBand: save.football.ratings.potentialBand,
  };
}

function toSnapshot(save: CareerSave, worldSlices: SnapshotRecord["worldSlices"]): SnapshotRecord {
  return {
    id: snapshotId(save.meta.id, save.meta.revision),
    careerId: save.meta.id,
    revision: save.meta.revision,
    schemaVersion: save.meta.schemaVersion,
    checksum: createChecksum(save),
    createdAt: save.meta.updatedAt,
    state: compactCareerSave(save),
    worldSlices,
  };
}

async function hydrateSnapshot(snapshot: SnapshotRecord): Promise<CareerSave | undefined> {
  if (!snapshot.worldSlices) {
    const legacy = snapshot.state as CareerSave;
    return snapshot.checksum === createChecksum(legacy) ? legacy : undefined;
  }
  const database = await getDatabase();
  const ids = [snapshot.worldSlices.players, snapshot.worldSlices.social, snapshot.worldSlices.careerRegistry];
  const records = await Promise.all(ids.map((id) => database.get("careerWorldSlices", id)));
  if (records.some((record) => !record)) return undefined;
  const slices = decodeWorldSlices(records as WorldSliceRecord[]);
  if (!slices) return undefined;
  const hydrated = hydrateCareerSave(snapshot.state, slices);
  return snapshot.checksum === createChecksum(hydrated) ? hydrated : undefined;
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

async function pruneWorldSlices(careerId: string): Promise<void> {
  const database = await getDatabase();
  const snapshots = [
    ...(await database.getAllFromIndex("careerSnapshots", "by-careerId", careerId)),
    ...(await database.getAllFromIndex("autosaveBackups", "by-careerId", careerId)),
    ...(await database.getAllFromIndex("manualSaves", "by-careerId", careerId)),
  ];
  const referenced = new Set<string>();
  for (const snapshot of snapshots) {
    if (!snapshot.worldSlices) continue;
    referenced.add(snapshot.worldSlices.players);
    referenced.add(snapshot.worldSlices.social);
    referenced.add(snapshot.worldSlices.careerRegistry);
  }
  const slices = await database.getAllFromIndex("careerWorldSlices", "by-careerId", careerId);
  const obsolete = slices.filter((slice) => !referenced.has(slice.id));
  if (obsolete.length === 0) return;
  const transaction = database.transaction("careerWorldSlices", "readwrite");
  await Promise.all(obsolete.map((slice) => transaction.store.delete(slice.id)));
  await transaction.done;
}

export class CareerRepository {
  async list(): Promise<CareerIndexRecord[]> {
    const database = await getDatabase();
    const records = await database.getAll("careerIndex");
    const normalized: CareerIndexRecord[] = [];

    for (const record of records) {
      if ("position" in record && typeof record.position === "string" && "seasonLabel" in record && typeof record.seasonLabel === "string") {
        normalized.push(record);
        continue;
      }

      const migrated = await this.load(record.id);
      const index = toIndexRecord(migrated);
      const transaction = database.transaction("careerIndex", "readwrite");
      await transaction.store.put(index);
      await transaction.done;
      normalized.push(index);
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
    return this.mutate(careerId, (current) => {
      if (current.meta.phase === "college-orientation") throw new Error("Weekly planning unlocks after college orientation");
      return applyWeeklyPlan(current, templateId, intensity);
    });
  }


  async updateTrainingPlan(
    careerId: string,
    focusId: TrainingFocusId,
    intensity: TrainingIntensity,
  ): Promise<CareerSave> {
    return this.mutate(careerId, (current) => {
      if (current.meta.phase === "college-orientation") throw new Error("Training planning unlocks after college orientation");
      return applyTrainingPlan(current, focusId, intensity);
    });
  }


  async startMatch(careerId: string, mode: MatchParticipationMode, analysisMode: boolean): Promise<CareerSave> {
    return this.mutate(careerId, (current) => {
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
    return this.mutate(careerId, (current) => resolveMatchDecision(current, optionId));
  }

  async finalizeCollegeMatch(careerId: string): Promise<CareerSave> {
    return this.mutate(careerId, finalizeCollegeMatch);
  }

  async resolveRelationshipEvent(careerId: string, optionId: string): Promise<CareerSave> {
    return this.mutate(careerId, (current) => resolveRelationshipEvent(current, optionId));
  }

  async performRecruitingAction(careerId: string, programId: string, actionId: RecruitingActionId): Promise<CareerSave> {
    return this.mutate(careerId, (current) => performRecruitingAction(current, programId, actionId));
  }

  async commitToCollege(careerId: string, programId: string): Promise<CareerSave> {
    return this.mutate(careerId, (current) => commitToCollege(current, programId));
  }

  async withdrawCollegeCommitment(careerId: string): Promise<CareerSave> {
    return this.mutate(careerId, withdrawCollegeCommitment);
  }


  async signCollegeAgreement(careerId: string, programId: string, route: CollegeEntryRoute): Promise<CareerSave> {
    return this.mutate(careerId, (current) => signCollegeAgreement(current, programId, route));
  }

  async reportToCollege(careerId: string): Promise<CareerSave> {
    return this.mutate(careerId, reportToCollege);
  }

  async setCollegeOnboardingPriority(careerId: string, priority: CollegeOnboardingPriority): Promise<CareerSave> {
    return this.mutate(careerId, (current) => setCollegeOnboardingPriority(current, priority));
  }


  async resolveCollegeHeroDecision(careerId: string, optionId: string): Promise<CareerSave> {
    return this.mutate(careerId, (current) => resolveCollegeHeroDecision(current, optionId));
  }

  async openProfessionalDraft(careerId: string): Promise<CareerSave> {
    return this.mutate(careerId, openProfessionalDraftProcess);
  }

  async resolveProfessionalDeclaration(careerId: string, optionId: "return-college" | "declare"): Promise<CareerSave> {
    return this.mutate(careerId, (current) => resolveProfessionalDeclaration(current, optionId));
  }

  async selectProfessionalAgent(careerId: string, agentId: string): Promise<CareerSave> {
    return this.mutate(careerId, (current) => selectProfessionalAgent(current, agentId));
  }

  async completeProfessionalEvaluation(careerId: string, focus: ProfessionalEvaluationFocus): Promise<CareerSave> {
    return this.mutate(careerId, (current) => completeProfessionalEvaluation(current, focus));
  }

  async runProfessionalDraft(careerId: string): Promise<CareerSave> {
    return this.mutate(careerId, runProfessionalDraft);
  }

  async acceptProfessionalCampInvite(careerId: string, teamId: string): Promise<CareerSave> {
    return this.mutate(careerId, (current) => acceptProfessionalCampInvite(current, teamId));
  }

  async advanceProfessionalTrainingCamp(careerId: string, approach: ProfessionalCampApproach): Promise<CareerSave> {
    return this.mutate(careerId, (current) => advanceProfessionalTrainingCamp(current, approach));
  }


  async finalizeProfessionalMatch(careerId: string): Promise<CareerSave> {
    return this.mutate(careerId, finalizeProfessionalMatch);
  }

  async setProfessionalWeekFocus(careerId: string, focus: ProfessionalWeekFocus): Promise<CareerSave> {
    return this.mutate(careerId, (current) => setProfessionalWeekFocus(current, focus));
  }

  async advanceProfessionalWeek(careerId: string): Promise<CareerSave> {
    return this.mutate(careerId, advanceProfessionalWeek);
  }

  async advanceProfessionalOffseason(careerId: string): Promise<CareerSave> {
    return this.mutate(careerId, advanceProfessionalOffseason);
  }

  async acceptProfessionalFreeAgentOffer(careerId: string, teamId: string): Promise<CareerSave> {
    return this.mutate(careerId, (current) => acceptProfessionalFreeAgentOffer(current, teamId));
  }

  async advanceDay(careerId: string): Promise<CareerSave> {
    return this.mutate(careerId, (current) => {
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

  async mutate(careerId: string, mutation: CareerMutation): Promise<CareerSave> {
    const current = await this.load(careerId);
    const next = await mutation(current);
    if (next.meta.id !== current.meta.id) throw new Error("Career mutation cannot change the career id");
    if (next.meta.revision !== current.meta.revision) throw new Error("Career mutation cannot change the revision directly");
    return this.save(next);
  }

  async save(input: CareerSave, options: SaveOptions = {}): Promise<CareerSave> {
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
    const world = createWorldSliceRecords(validated);
    const snapshot = toSnapshot(validated, world.refs);
    const transaction = database.transaction(
      ["careerIndex", "careerSnapshots", "autosaveBackups", "careerWorldSlices"],
      "readwrite",
    );

    const snapshotStore = transaction.objectStore("careerSnapshots");
    const previousCursor = await snapshotStore.index("by-career-revision").openCursor(
      IDBKeyRange.bound([validated.meta.id, 0], [validated.meta.id, Number.MAX_SAFE_INTEGER]),
      "prev",
    );
    const previous = previousCursor?.value;
    const actualRevision = previous?.revision;
    const expectedRevision = input.meta.revision;
    const missingAllowed = options.createIfMissing === true || expectedRevision === 0;

    if (actualRevision === undefined ? !missingAllowed : actualRevision !== expectedRevision) {
      throw new CareerSaveConflictError(validated.meta.id, expectedRevision, actualRevision);
    }

    const shouldArchivePrevious = options.archivePrevious !== false
      && previous !== undefined
      && validated.meta.revision % AUTOSAVE_BACKUP_INTERVAL === 0;
    if (previous) {
      if (shouldArchivePrevious) await transaction.objectStore("autosaveBackups").put(previous);
      await snapshotStore.delete(previous.id);
    }

    for (const record of world.records) {
      const existing = await transaction.objectStore("careerWorldSlices").get(record.id);
      if (!existing) await transaction.objectStore("careerWorldSlices").put(record);
    }
    await snapshotStore.put(snapshot);
    await transaction.objectStore("careerIndex").put(toIndexRecord(validated));
    await transaction.done;
    if (shouldArchivePrevious) await pruneBackups(validated.meta.id);
    await pruneWorldSlices(validated.meta.id);

    return validated;
  }

  async load(careerId: string): Promise<CareerSave> {
    const latest = await this.readLatestSnapshot(careerId);

    if (latest) {
      const hydrated = await hydrateSnapshot(latest);
      if (hydrated) {
        const migration = migrateCareerSave(hydrated);
        if (migration.migratedFrom !== undefined) {
          return this.save({ ...migration.save, meta: { ...migration.save.meta, revision: latest.revision } });
        }
        return careerSaveSchemaSafeParse(migration.save);
      }
    }

    const database = await getDatabase();
    const backups = await database.getAllFromIndex("autosaveBackups", "by-careerId", careerId);
    backups.sort((left, right) => right.revision - left.revision);

    for (const backup of backups) {
      const hydrated = await hydrateSnapshot(backup);
      if (!hydrated) continue;
      const migration = migrateCareerSave(hydrated);
      const recovered = careerSaveSchemaSafeParse(migration.save);
      return this.save(
        {
          ...recovered,
          meta: {
            ...recovered.meta,
            revision: latest?.revision ?? recovered.meta.revision,
          },
        },
        { createIfMissing: true, archivePrevious: false },
      );
    }

    throw new Error("Career save is missing or corrupted");
  }

  async remove(careerId: string): Promise<void> {
    const database = await getDatabase();
    const transaction = database.transaction(
      ["careerIndex", "careerSnapshots", "autosaveBackups", "manualSaves", "careerWorldSlices"],
      "readwrite",
    );

    await transaction.objectStore("careerIndex").delete(careerId);

    for (const storeName of ["careerSnapshots", "autosaveBackups", "manualSaves", "careerWorldSlices"] as const) {
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
    const transaction = database.transaction("careerSnapshots", "readonly");
    const cursor = await transaction.store.index("by-career-revision").openCursor(
      IDBKeyRange.bound([careerId, 0], [careerId, Number.MAX_SAFE_INTEGER]),
      "prev",
    );
    return cursor?.value;
  }
}

function careerSaveSchemaSafeParse(save: CareerSave): CareerSave {
  const current = save.meta.schemaVersion === CURRENT_SCHEMA_VERSION
    ? save
    : migrateCareerSave(save).save;
  const parsed = careerSaveSchema.safeParse(current);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const path = issue?.path.join(".") || "save";
  throw new Error(`Career save validation failed at ${path}: ${issue?.message ?? "invalid state"}`);
}

export const careerRepository = new CareerRepository();
