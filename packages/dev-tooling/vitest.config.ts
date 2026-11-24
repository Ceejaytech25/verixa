import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.config.js";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "@verixa/dev-tooling",
      // Seed profiles write to one shared Postgres. Running the profiles in
      // parallel would interleave resets and inserts exactly like the
      // integration suite's shared tables do, so keep this package serial.
      fileParallelism: false,
      coverage: {
        // The harness is test scaffolding, not shippable behaviour: its only
        // consumers are the integration specs, which are themselves excluded
        // by the shared config. Counting it would measure Docker availability
        // rather than the seed framework.
        exclude: ["**/testing/**", "index.ts", "scripts/**"],
      },
    },
  }),
);
