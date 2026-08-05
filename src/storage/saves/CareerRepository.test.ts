import { describe, expect, it } from "vitest";
import { CareerRepository, CareerSaveConflictError } from "./CareerRepository";
import { getDatabase } from "../indexedDb/database";
import { advanceRelationshipWorld } from "../../sports/football/relationships/relationshipEvents";
import type { CareerSave } from "./schema";

describe("CareerRepository", () => {
  it("creates, lists, loads, exports and removes a career", async () => {
    const repository = new CareerRepository();
    const created = await repository.createFootballCareer({
      character: {
        firstName: "Jalen",
        lastName: "Cole",
        birthDate: "2008-08-17",
        gender: "male",
        handedness: "right",
        originId: "houston",
        familyIncome: "comfortable",
        familyStructure: "two-parent",
        familySupport: "supportive",
        mindset: "composed",
      },
      position: "WR",
      archetypeId: "route-technician",
      jerseyNumber: 1,
    });

    expect(created.meta.sport).toBe("american-football");
    expect(created.meta.revision).toBe(1);
    expect(created.character.identity.fullName).toBe("Jalen Cole");
    expect(created.football.position).toBe("WR");

    const list = await repository.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.meta.id);
    expect(list[0]?.displayName).toBe("Jalen Cole");
    expect(list[0]?.overall).toBe(created.football.ratings.overall);

    const loaded = await repository.load(created.meta.id);
    expect(loaded.meta.worldSeed).toBe(created.meta.worldSeed);
    expect(loaded.football.worldSeed).toBe(created.meta.worldSeed);
    expect(loaded.character.origin.city).toBe("Houston");

    const conversationCandidate = {
      ...loaded,
      life: { ...loaded.life, completedDays: 1, dayIndex: 1 },
      relationships: {
        ...loaded.relationships,
        lastGeneratedCompletedDay: -1,
        queuedEvents: [{
          id: "repository-conversation",
          type: "teammate-film" as const,
          dueCompletedDay: 1,
          primaryNpcId: "repository-conversation-npc",
        }],
      },
    };
    const withConversation = await repository.save({
      ...conversationCandidate,
      relationships: advanceRelationshipWorld(conversationCandidate),
    });
    const pendingConversation = withConversation.relationships.pendingEvent;
    expect(pendingConversation).toBeTruthy();
    if (!pendingConversation) throw new Error("Expected a pending relationship event");
    const resolvedConversation = await repository.resolveRelationshipEvent(
      created.meta.id,
      pendingConversation.options[0]!.id,
    );
    expect(resolvedConversation.relationships.pendingEvent).toBeUndefined();
    expect((await repository.load(created.meta.id)).relationships.pendingEvent).toBeUndefined();

    let current = resolvedConversation;
    for (let index = 0; index < 8; index += 1) current = await repository.save(current);
    const database = await getDatabase();
    const snapshots = await database.getAllFromIndex("careerSnapshots", "by-careerId", created.meta.id);
    const backups = await database.getAllFromIndex("autosaveBackups", "by-careerId", created.meta.id);
    const worldSlices = await database.getAllFromIndex("careerWorldSlices", "by-careerId", created.meta.id);
    expect(snapshots).toHaveLength(1);
    expect(backups.length).toBeLessThanOrEqual(5);
    expect(worldSlices).toHaveLength(3);
    expect(snapshots[0]?.worldSlices).toBeTruthy();
    expect((snapshots[0]?.state as { world?: { players?: unknown[] } }).world?.players).toEqual([]);
    expect((await repository.load(created.meta.id)).meta.revision).toBe(current.meta.revision);

    const invalid = {
      ...current,
      character: {
        ...current.character,
        condition: { ...current.character.condition, health: 140 },
      },
    } as CareerSave;
    await expect(repository.save(invalid)).rejects.toThrow(/character\.condition\.health/);

    const exported = await repository.export(created.meta.id);
    const exportedText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(exported);
    });
    const parsed = JSON.parse(exportedText) as { meta: { id: string }; character: { identity: { fullName: string } } };
    expect(parsed.meta.id).toBe(created.meta.id);
    expect(parsed.character.identity.fullName).toBe("Jalen Cole");

    await repository.remove(created.meta.id);
    expect(await repository.list()).toEqual([]);
  });

  it("rejects stale writes instead of silently replacing a newer revision", async () => {
    const repository = new CareerRepository();
    const created = await repository.createFootballCareer({
      character: {
        firstName: "Micah",
        lastName: "Stone",
        birthDate: "2008-08-17",
        gender: "male",
        handedness: "right",
        originId: "houston",
        familyIncome: "comfortable",
        familyStructure: "two-parent",
        familySupport: "supportive",
        mindset: "composed",
      },
      position: "CB",
      archetypeId: "press-corner",
      jerseyNumber: 2,
    });

    const firstCopy = await repository.load(created.meta.id);
    const staleCopy = await repository.load(created.meta.id);
    const firstEventId = crypto.randomUUID();
    const staleEventId = crypto.randomUUID();
    const committed = await repository.save({
      ...firstCopy,
      history: [
        ...firstCopy.history,
        {
          id: firstEventId,
          occurredAt: firstCopy.meta.updatedAt,
          type: "career-imported",
          title: "Первая запись",
          description: "Эта запись должна сохраниться.",
        },
      ],
    });

    const staleWrite = repository.save({
      ...staleCopy,
      history: [
        ...staleCopy.history,
        {
          id: staleEventId,
          occurredAt: staleCopy.meta.updatedAt,
          type: "career-imported",
          title: "Устаревшая запись",
          description: "Эта запись не должна затереть новую ревизию.",
        },
      ],
    });
    await expect(staleWrite).rejects.toBeInstanceOf(CareerSaveConflictError);
    await expect(staleWrite).rejects.toMatchObject({
      name: "CareerSaveConflictError",
      careerId: created.meta.id,
      expectedRevision: staleCopy.meta.revision,
      actualRevision: committed.meta.revision,
    });

    const persisted = await repository.load(created.meta.id);
    expect(persisted.meta.revision).toBe(committed.meta.revision);
    expect(persisted.history.some((event) => event.id === firstEventId)).toBe(true);
    expect(persisted.history.some((event) => event.id === staleEventId)).toBe(false);

    await repository.remove(created.meta.id);
  });
});
