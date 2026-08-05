import { describe, expect, it } from "vitest";
import type { CareerSave } from "../../storage/saves/schema";
import { CareerCommandService } from "./CareerCommandService";
import type { CareerMutationStore } from "./CareerMutationStore";

function createMemoryStore(): CareerMutationStore & { current(): CareerSave | undefined } {
  let persisted: CareerSave | undefined;

  return {
    current: () => persisted,
    async load(careerId) {
      if (!persisted || persisted.meta.id !== careerId) throw new Error("Career is missing");
      return persisted;
    },
    async save(input) {
      persisted = {
        ...input,
        meta: {
          ...input.meta,
          revision: input.meta.revision + 1,
        },
      };
      return persisted;
    },
    async mutate(careerId, mutation) {
      if (!persisted || persisted.meta.id !== careerId) throw new Error("Career is missing");
      const next = await mutation(persisted);
      return this.save(next);
    },
  };
}

const setup = {
  character: {
    firstName: "Noah",
    lastName: "Price",
    birthDate: "2008-08-17",
    gender: "male" as const,
    handedness: "right" as const,
    originId: "houston",
    familyIncome: "comfortable" as const,
    familyStructure: "two-parent" as const,
    familySupport: "supportive" as const,
    mindset: "composed" as const,
  },
  position: "WR" as const,
  archetypeId: "route-technician",
  jerseyNumber: 11,
};

describe("CareerCommandService", () => {
  it("creates domain state through the persistence port", async () => {
    const store = createMemoryStore();
    const commands = new CareerCommandService(store);

    const created = await commands.createFootballCareer(setup);

    expect(created.meta.revision).toBe(1);
    expect(created.meta.phase).toBe("high-school-preseason");
    expect(created.character.identity.fullName).toBe("Noah Price");
    expect(created.world.players.length).toBeGreaterThan(0);
    expect(store.current()?.meta.id).toBe(created.meta.id);
  });

  it("advances a complete high-school week with one command", async () => {
    const store = createMemoryStore();
    const commands = new CareerCommandService(store);
    const created = await commands.createFootballCareer(setup);

    const result = await commands.advanceWeek(created.meta.id);

    expect(result.save.life.weekNumber).toBe(created.life.weekNumber + 1);
    expect(result.save.relationships.pendingEvent).toBeUndefined();
    expect(result.report.week).toBe(created.life.weekNumber);
    expect(result.report.metrics.some((metric) => metric.id === "overall")).toBe(true);
    expect(result.report.summary.length).toBeGreaterThan(5);
    expect(result.report.changes.length).toBeGreaterThan(0);
    expect(result.report.headlines.length).toBeLessThanOrEqual(3);
  });

  it("keeps phase rules outside the repository", async () => {
    const store = createMemoryStore();
    const commands = new CareerCommandService(store);
    const created = await commands.createFootballCareer(setup);
    const persisted = store.current();
    if (!persisted) throw new Error("Expected persisted career");

    await store.save({
      ...persisted,
      meta: {
        ...persisted.meta,
        phase: "college-orientation",
      },
    });

    await expect(commands.advanceDay(created.meta.id)).rejects.toThrow("College orientation must be completed");
  });
});
