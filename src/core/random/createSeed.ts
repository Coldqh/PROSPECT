export function createSeed(prefix = "world"): string {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes, (part) => part.toString(36)).join("");
  return `${prefix}-${value}`;
}
