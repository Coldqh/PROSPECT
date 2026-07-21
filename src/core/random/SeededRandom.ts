export interface RandomSource {
  next(): number;
  integer(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  fork(namespace: string): SeededRandom;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0 || 0x9e3779b9;
}

export class SeededRandom implements RandomSource {
  private state: number;
  private readonly rootSeed: string;

  constructor(seed: string) {
    this.rootSeed = seed;
    this.state = hashSeed(seed);
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new Error(`Invalid integer range: ${min}..${max}`);
    }

    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty collection");
    }

    const selected = items[this.integer(0, items.length - 1)];
    if (selected === undefined) {
      throw new Error("Seeded random selected an invalid index");
    }

    return selected;
  }

  chance(probability: number): boolean {
    if (probability < 0 || probability > 1) {
      throw new Error("Probability must be between 0 and 1");
    }

    return this.next() < probability;
  }

  fork(namespace: string): SeededRandom {
    return new SeededRandom(`${this.rootSeed}:${namespace}`);
  }
}
