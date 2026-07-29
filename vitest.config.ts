import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["scripts/**", "node_modules/**", "dist/**"],
  },
});
