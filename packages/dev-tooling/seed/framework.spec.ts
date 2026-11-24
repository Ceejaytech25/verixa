import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEEDED_AT,
  executeSeedPlan,
  resolveSeedPlan,
  type SeedModule,
  type SeedProfile,
} from "./framework.js";

function module(
  name: string,
  dependencies: readonly string[] = [],
  seed: SeedModule["seed"] = () => Promise.resolve({ records: 0 }),
): SeedModule {
  return { name, dependencies, seed };
}

function profile(modules: readonly string[]): SeedProfile {
  return { name: "test", description: "Unit-test profile", modules };
}

describe("resolveSeedPlan", () => {
  it("runs a dependency before the module that declares it", () => {
    const producer = module("producer");
    const consumer = module("consumer", ["producer"]);

    // Registry order is deliberately reversed: order must come from the
    // declaration, not from how the registry happens to be written.
    const plan = resolveSeedPlan([consumer, producer], profile(["consumer"]));

    expect(plan.modules.map((entry) => entry.name)).toEqual(["producer", "consumer"]);
  });

  it("includes transitive dependencies a profile did not name", () => {
    const base = module("base");
    const middle = module("middle", ["base"]);
    const leaf = module("leaf", ["middle"]);

    const plan = resolveSeedPlan([leaf, middle, base], profile(["leaf"]));

    expect(plan.modules.map((entry) => entry.name)).toEqual(["base", "middle", "leaf"]);
  });

  it("deduplicates a diamond-shaped dependency graph", () => {
    const base = module("base");
    const left = module("left", ["base"]);
    const right = module("right", ["base"]);
    const top = module("top", ["left", "right"]);

    const plan = resolveSeedPlan([top, right, left, base], profile(["top"]));

    expect(plan.modules.map((entry) => entry.name)).toEqual(["base", "left", "right", "top"]);
  });

  it("honors declaration order when a module has several dependencies", () => {
    const first = module("first");
    const second = module("second");
    const consumer = module("consumer", ["second", "first"]);

    const plan = resolveSeedPlan([consumer, first, second], profile(["consumer"]));

    expect(plan.modules.map((entry) => entry.name)).toEqual(["second", "first", "consumer"]);
  });

  it("returns an empty plan when a profile selects nothing", () => {
    expect(resolveSeedPlan([module("unused")], profile([])).modules).toEqual([]);
  });

  it("rejects a profile that selects an unknown module", () => {
    expect(() => resolveSeedPlan([module("known")], profile(["missing"]))).toThrow(
      /Unknown seed module "missing"/,
    );
  });

  it("rejects a module that declares an unknown dependency", () => {
    const broken = module("broken", ["ghost"]);

    expect(() => resolveSeedPlan([broken], profile(["broken"]))).toThrow(
      /module "broken" depends on unknown module "ghost"/,
    );
  });

  it("rejects duplicate module names before any module runs", () => {
    expect(() => resolveSeedPlan([module("same"), module("same")], profile(["same"]))).toThrow(
      /Duplicate seed module name "same"/,
    );
  });

  it("rejects a dependency cycle", () => {
    const first = module("first", ["second"]);
    const second = module("second", ["first"]);

    expect(() => resolveSeedPlan([first, second], profile(["first"]))).toThrow(
      /Cyclic seed module dependency: first -> second -> first/,
    );
  });
});

describe("executeSeedPlan", () => {
  it("executes modules one at a time in plan order", async () => {
    const calls: string[] = [];
    const first = module("first", [], async () => {
      await Promise.resolve();
      calls.push("first");
      return { records: 1 };
    });
    const second = module("second", [], () => {
      calls.push("second");
      return Promise.resolve({ records: 2 });
    });
    const plan = resolveSeedPlan([second, first], profile(["first", "second"]));

    // A concurrent runner would observe "second" first, because `first`
    // yields before recording its call.
    const report = await executeSeedPlan({} as never, plan);

    expect(calls).toEqual(["first", "second"]);
    expect(report).toEqual({
      profile: "test",
      modules: [
        { module: "first", records: 1 },
        { module: "second", records: 2 },
      ],
    });
  });

  it("gives every module the same frozen timestamp", async () => {
    const timestamps: Date[] = [];
    const capture = module("capture", [], ({ seededAt }) => {
      timestamps.push(seededAt);
      return Promise.resolve({ records: 0 });
    });
    const plan = resolveSeedPlan([capture], profile(["capture"]));

    await executeSeedPlan({} as never, plan);

    expect(timestamps).toHaveLength(1);
    expect(timestamps[0]?.toISOString()).toBe(DEFAULT_SEEDED_AT.toISOString());
    expect(timestamps[0]?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("lets a caller override the timestamp", async () => {
    let observed: Date | undefined;
    const capture = module("capture", [], ({ seededAt }) => {
      observed = seededAt;
      return Promise.resolve({ records: 0 });
    });
    const plan = resolveSeedPlan([capture], profile(["capture"]));
    const seededAt = new Date("2030-06-01T00:00:00.000Z");

    await executeSeedPlan({} as never, plan, { seededAt });

    expect(observed).toBe(seededAt);
  });
});
