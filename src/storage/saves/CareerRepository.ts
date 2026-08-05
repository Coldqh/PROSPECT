import type { CareerMutation, CareerMutationStore } from "../../application/career/CareerMutationStore";
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

export class CareerRepository implements CareerMutationStore {
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
