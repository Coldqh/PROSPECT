class Fnv1aHash {
  private value = 2166136261;

  write(source: string): void {
    for (let index = 0; index < source.length; index += 1) {
      this.value ^= source.charCodeAt(index);
      this.value = Math.imul(this.value, 16777619);
    }
  }

  digest(): string {
    return (this.value >>> 0).toString(16).padStart(8, "0");
  }
}

function hashStableValue(value: unknown, hash: Fnv1aHash): void {
  if (value === null || typeof value !== "object") {
    hash.write(JSON.stringify(value));
    return;
  }

  if (Array.isArray(value)) {
    hash.write("[");
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) hash.write(",");
      hashStableValue(value[index], hash);
    }
    hash.write("]");
    return;
  }

  hash.write("{");
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) continue;
    if (index > 0) hash.write(",");
    hash.write(JSON.stringify(entry[0]));
    hash.write(":");
    hashStableValue(entry[1], hash);
  }
  hash.write("}");
}

export function createChecksum(value: unknown): string {
  const hash = new Fnv1aHash();
  hashStableValue(value, hash);
  return hash.digest();
}
