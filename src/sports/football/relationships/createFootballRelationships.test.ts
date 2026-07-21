import { describe, expect, it } from "vitest";
import { createFootballCareerState, createLegacyFootballSetup } from "../career/createFootballCareer";
import { createFootballRelationships } from "./createFootballRelationships";

describe("createFootballRelationships", () => {
  it("creates a stable network with one relationship value per npc", () => {
    const seed = "relationships-stable-seed";
    const generated = createFootballCareerState(seed, createLegacyFootballSetup(seed));
    const first = createFootballRelationships(seed, generated.character, generated.football);
    const second = createFootballRelationships(seed, generated.character, generated.football);

    expect(first).toEqual(second);
    expect(first.npcs).toHaveLength(7);
    expect(first.npcs.every((npc) => npc.relationship >= -100 && npc.relationship <= 100)).toBe(true);
    expect(first.npcs.find((npc) => npc.role === "rival")?.linkedEntityId).toBeTruthy();
  });
});
