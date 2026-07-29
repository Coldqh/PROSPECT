import "fake-indexeddb/auto";
import { afterEach } from "vitest";

afterEach(() => {
  globalThis.localStorage?.clear();
});
