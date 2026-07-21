import { describe, expect, it } from "vitest";
import { migrateCareerSave } from "./migrations";

const legacySave = {
  meta: {
    id: "legacy-career",
    schemaVersion: 1,
    sport: "american-football",
    worldSeed: "football-legacy-seed",
    createdAt: "2026-07-21T10:00:00.000Z",
    updatedAt: "2026-07-21T10:00:00.000Z",
    currentDate: { year: 2026, month: 8, day: 17 },
    phase: "foundation",
    revision: 1,
  },
  football: {
    moduleVersion: 1,
    worldSeed: "football-legacy-seed",
    stage: "foundation",
  },
  history: [
    {
      id: "history-1",
      occurredAt: "2026-07-21T10:00:00.000Z",
      type: "career-created",
      title: "Карьера создана",
      description: "Технический фундамент.",
    },
  ],
};

describe("migrateCareerSave", () => {
  it("migrates foundation saves to the player creation schema", () => {
    const result = migrateCareerSave(legacySave);
    expect(result.migratedFrom).toBe(1);
    expect(result.save.meta.schemaVersion).toBe(2);
    expect(result.save.meta.phase).toBe("high-school-preseason");
    expect(result.save.character.identity.fullName.length).toBeGreaterThan(3);
    expect(result.save.football.stage).toBe("high-school-preseason");
    expect(result.save.history.at(-1)?.type).toBe("save-migrated");
  });

  it("produces the same migrated athlete for the same seed", () => {
    expect(migrateCareerSave(legacySave).save.character).toEqual(migrateCareerSave(legacySave).save.character);
  });
});
