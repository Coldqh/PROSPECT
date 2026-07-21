import { describe, expect, it } from "vitest";
import { createFootballCareerState, createLegacyFootballSetup } from "../../sports/football/career/createFootballCareer";
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
  it("migrates foundation saves through player creation into the weekly loop schema", () => {
    const result = migrateCareerSave(legacySave);
    expect(result.migratedFrom).toBe(1);
    expect(result.save.meta.schemaVersion).toBe(3);
    expect(result.save.meta.phase).toBe("high-school-preseason");
    expect(result.save.character.identity.fullName.length).toBeGreaterThan(3);
    expect(result.save.football.stage).toBe("high-school-preseason");
    expect(result.save.life.weekNumber).toBe(1);
    expect(result.save.life.weeklyPlan.templateId).toBe("balanced");
    expect(result.save.history.at(-1)?.type).toBe("save-migrated");
  });

  it("migrates version two saves without regenerating the athlete", () => {
    const generated = createFootballCareerState("football-v2-seed", createLegacyFootballSetup("football-v2-seed"));
    const versionTwo = {
      meta: {
        id: "v2-career",
        schemaVersion: 2,
        sport: "american-football",
        worldSeed: "football-v2-seed",
        createdAt: "2026-07-21T10:00:00.000Z",
        updatedAt: "2026-07-21T10:00:00.000Z",
        currentDate: { year: 2026, month: 8, day: 17 },
        phase: "high-school-preseason",
        revision: 2,
      },
      ...generated,
      history: [],
    };
    const result = migrateCareerSave(versionTwo);
    expect(result.migratedFrom).toBe(2);
    expect(result.save.character).toEqual(generated.character);
    expect(result.save.life.completedDays).toBe(0);
  });

  it("produces the same migrated athlete for the same seed", () => {
    expect(migrateCareerSave(legacySave).save.character).toEqual(migrateCareerSave(legacySave).save.character);
  });
});
