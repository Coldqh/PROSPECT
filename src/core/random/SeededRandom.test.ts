import { describe, expect, it } from "vitest";
import { SeededRandom } from "./SeededRandom";

describe("SeededRandom", () => {
  it("returns the same sequence for the same seed", () => {
    const first = new SeededRandom("prospect-test");
    const second = new SeededRandom("prospect-test");

    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(),
      second.next(),
      second.next(),
    ]);
  });

  it("creates stable independent forks", () => {
    const first = new SeededRandom("world").fork("recruiting");
    const second = new SeededRandom("world").fork("recruiting");
    const different = new SeededRandom("world").fork("injuries");

    expect(first.next()).toBe(second.next());
    expect(first.next()).not.toBe(different.next());
  });

  it("never uses values outside an integer range", () => {
    const random = new SeededRandom("range");
    const values = Array.from({ length: 100 }, () => random.integer(3, 7));

    expect(values.every((value) => value >= 3 && value <= 7)).toBe(true);
  });
});
