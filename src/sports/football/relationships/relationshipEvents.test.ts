import { describe, expect, it } from "vitest";
import { createInitialLifeState } from "../../../core/life/createInitialLifeState";
import type { CareerSave } from "../../../storage/saves/schema";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballRelationships } from "./createFootballRelationships";
import { advanceRelationshipWorld, resolveRelationshipEvent } from "./relationshipEvents";

function makeSave(): CareerSave {
  const worldSeed = "relationship-event-seed";
  const generated = createFootballCareerState(worldSeed, createLegacyFootballSetup(worldSeed));
  return {
    meta: {
      id: "relationship-career",
      schemaVersion: 8,
      sport: "american-football",
      worldSeed,
      createdAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
      currentDate: { year: 2026, month: 8, day: 18 },
      phase: "high-school-preseason",
      revision: 1,
    },
    ...generated,
    life: { ...createInitialLifeState(), completedDays: 1, dayIndex: 1 },
    relationships: createFootballRelationships(worldSeed, generated.character, generated.football),
    history: [],
  };
}

describe("relationship events", () => {
  it("creates a contextual event and writes one relationship memory", () => {
    const save = makeSave();
    const relationships = advanceRelationshipWorld(save);
    const event = relationships.pendingEvent;
    expect(event).toBeTruthy();
    if (!event) throw new Error("Expected a relationship event");

    const withEvent = { ...save, relationships };
    const before = relationships.npcs.find((npc) => npc.id === event.primaryNpcId)?.relationship ?? 0;
    const selected = event.options[0];
    if (!selected) throw new Error("Expected an event option");
    const resolved = resolveRelationshipEvent(withEvent, selected.id);
    const npc = resolved.relationships.npcs.find((item) => item.id === event.primaryNpcId);

    expect(resolved.relationships.pendingEvent).toBeUndefined();
    expect(npc?.relationship).toBe(before + selected.effects.relationship);
    expect(npc?.memories).toHaveLength(1);
    expect(resolved.history.at(-1)?.type).toBe("relationship-event-resolved");
  });

  it("queues a real follow-up after asking the coach for a plan", () => {
    const save = makeSave();
    save.football.depthChart.coachTrust = 35;
    save.relationships = { ...save.relationships, lastGeneratedCompletedDay: 0 };
    const relationships = advanceRelationshipWorld(save);
    expect(relationships.pendingEvent?.type).toBe("coach-accountability");

    const resolved = resolveRelationshipEvent({ ...save, relationships }, "ask-plan");
    expect(resolved.relationships.queuedEvents[0]?.type).toBe("coach-plan-review");
    expect(resolved.relationships.queuedEvents[0]?.dueCompletedDay).toBe(4);
  });
});
