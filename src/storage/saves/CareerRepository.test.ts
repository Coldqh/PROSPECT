import { describe, expect, it } from "vitest";
import { CareerRepository } from "./CareerRepository";

describe("CareerRepository", () => {
  it("creates, lists, loads, exports and removes a career", async () => {
    const repository = new CareerRepository();
    const created = await repository.createFootballCareer();

    expect(created.meta.sport).toBe("american-football");
    expect(created.meta.revision).toBe(1);

    const list = await repository.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.meta.id);

    const loaded = await repository.load(created.meta.id);
    expect(loaded.meta.worldSeed).toBe(created.meta.worldSeed);
    expect(loaded.football.worldSeed).toBe(created.meta.worldSeed);

    const exported = await repository.export(created.meta.id);
    const exportedText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(exported);
    });
    const parsed = JSON.parse(exportedText) as { meta: { id: string } };
    expect(parsed.meta.id).toBe(created.meta.id);

    await repository.remove(created.meta.id);
    expect(await repository.list()).toEqual([]);
  });
});
