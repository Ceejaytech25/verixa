import { describe, expect, it } from "vitest";

import { resolveSeedPlan } from "./framework.js";
import { seedModules } from "./modules/index.js";
import {
  getSeedProfile,
  isProfileName,
  PROFILE_NAMES,
  SEED_PROFILES,
  type ProfileName,
} from "./profiles.js";

function plannedModules(name: ProfileName): string[] {
  return resolveSeedPlan(seedModules, getSeedProfile(name)).modules.map((entry) => entry.name);
}

describe("seed profiles", () => {
  it("minimal selects only the coherent identity/RBAC graph", () => {
    expect(plannedModules("minimal")).toEqual([
      "identity:users",
      "identity:organizations",
      "authorization:catalog",
      "authorization:role-assignments",
    ]);
  });

  it("demo adds verification cases without adding load data", () => {
    const modules = plannedModules("demo");

    expect(modules).toContain("verification:requests");
    expect(modules).not.toContain("identity:bulk-members");
    expect(modules).toHaveLength(plannedModules("minimal").length + 1);
  });

  it("load-test adds generated tenant members after their dependencies", () => {
    const modules = plannedModules("load-test");

    expect(modules.at(-1)).toBe("identity:bulk-members");
    expect(modules).toContain("verification:requests");
    expect(modules).toHaveLength(plannedModules("demo").length + 1);
  });

  it("runs identity users before organizations and assignments for every profile", () => {
    for (const name of PROFILE_NAMES) {
      const modules = plannedModules(name);

      expect(modules.indexOf("identity:users")).toBeLessThan(
        modules.indexOf("identity:organizations"),
      );
      expect(modules.indexOf("identity:organizations")).toBeLessThan(
        modules.indexOf("authorization:role-assignments"),
      );
      expect(modules.indexOf("authorization:catalog")).toBeLessThan(
        modules.indexOf("authorization:role-assignments"),
      );
    }
  });

  it("rejects an unrecognised profile name", () => {
    expect(() => getSeedProfile("smoke")).toThrow(/Unknown seed profile "smoke"/);
    expect(isProfileName("smoke")).toBe(false);
  });

  it("defines a profile for every published profile name", () => {
    expect(Object.keys(SEED_PROFILES).sort()).toEqual([...PROFILE_NAMES].sort());
    expect(PROFILE_NAMES).toEqual(["minimal", "demo", "load-test"]);
  });
});
