import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CareerIndexRecord, CareerSave } from "../saves/schema";

interface SnapshotRecord {
  id: string;
  careerId: string;
  revision: number;
  schemaVersion: number;
  checksum: string;
  createdAt: string;
  state: CareerSave;
}

interface SettingsRecord {
  key: string;
  value: unknown;
}

interface MigrationLogRecord {
  id?: number;
  careerId: string;
  createdAt: string;
  status: "success" | "failure";
  message: string;
}

interface ProspectDatabase extends DBSchema {
  careerIndex: {
    key: string;
    value: CareerIndexRecord;
    indexes: { "by-updatedAt": string };
  };
  careerSnapshots: {
    key: string;
    value: SnapshotRecord;
    indexes: { "by-careerId": string; "by-career-revision": [string, number] };
  };
  autosaveBackups: {
    key: string;
    value: SnapshotRecord;
    indexes: { "by-careerId": string; "by-career-revision": [string, number] };
  };
  manualSaves: {
    key: string;
    value: SnapshotRecord;
    indexes: { "by-careerId": string; "by-career-revision": [string, number] };
  };
  settings: {
    key: string;
    value: SettingsRecord;
  };
  migrationLog: {
    key: number;
    value: MigrationLogRecord;
    indexes: { "by-careerId": string };
  };
}

let databasePromise: Promise<IDBPDatabase<ProspectDatabase>> | undefined;

export function getDatabase(): Promise<IDBPDatabase<ProspectDatabase>> {
  databasePromise ??= openDB<ProspectDatabase>("prospect-db", 1, {
    upgrade(database) {
      const careerIndex = database.createObjectStore("careerIndex", { keyPath: "id" });
      careerIndex.createIndex("by-updatedAt", "updatedAt");

      const snapshots = database.createObjectStore("careerSnapshots", { keyPath: "id" });
      snapshots.createIndex("by-careerId", "careerId");
      snapshots.createIndex("by-career-revision", ["careerId", "revision"]);

      const backups = database.createObjectStore("autosaveBackups", { keyPath: "id" });
      backups.createIndex("by-careerId", "careerId");
      backups.createIndex("by-career-revision", ["careerId", "revision"]);

      const manualSaves = database.createObjectStore("manualSaves", { keyPath: "id" });
      manualSaves.createIndex("by-careerId", "careerId");
      manualSaves.createIndex("by-career-revision", ["careerId", "revision"]);

      database.createObjectStore("settings", { keyPath: "key" });

      const migrationLog = database.createObjectStore("migrationLog", {
        keyPath: "id",
        autoIncrement: true,
      });
      migrationLog.createIndex("by-careerId", "careerId");
    },
  });

  return databasePromise;
}

export type { SnapshotRecord };
