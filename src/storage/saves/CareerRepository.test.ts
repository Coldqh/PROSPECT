import { describe, expect, it } from "vitest";
import { CareerRepository } from "./CareerRepository";

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
});
