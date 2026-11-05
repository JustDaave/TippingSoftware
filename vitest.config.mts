import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["lib/**/*.test.ts", "supabase/tests/**/*.test.ts"], exclude: ["archive/**", "node_modules/**"] },
});
