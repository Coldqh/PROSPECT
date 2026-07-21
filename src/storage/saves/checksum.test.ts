import { describe, expect, it } from "vitest";
import { createChecksum } from "./checksum";

describe("createChecksum", () => {
  it("is stable regardless of object key order", () => {
    expect(createChecksum({ a: 1, b: 2 })).toBe(createChecksum({ b: 2, a: 1 }));
  });

  it("changes when nested content changes", () => {
    expect(createChecksum({ player: { fatigue: 10 } })).not.toBe(
      createChecksum({ player: { fatigue: 11 } }),
    );
  });
});
