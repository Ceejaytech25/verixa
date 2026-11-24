import type { SeedProfile } from "./framework.js";

export const PROFILE_NAMES = ["minimal", "demo", "load-test"] as const;

export type ProfileName = (typeof PROFILE_NAMES)[number];

/**
 * The smallest graph that is still usable: users, their organizations and
 * memberships, plus the RBAC catalog and assignments needed to authorize
 * against them. Verification and generated load data are deliberately absent.
 */
const BASE_MODULES = [
  "identity:users",
  "identity:organizations",
  "authorization:catalog",
  "authorization:role-assignments",
] as const;

export const SEED_PROFILES: Record<ProfileName, SeedProfile> = {
  minimal: {
    name: "minimal",
    description: "One coherent multi-tenant graph with the default RBAC catalog",
    modules: BASE_MODULES,
  },
  demo: {
    name: "demo",
    description: "Minimal plus a small set of verification cases for UI walkthroughs",
    modules: [...BASE_MODULES, "verification:requests"],
  },
  "load-test": {
    name: "load-test",
    description: "Demo plus generated tenant members for load scenarios",
    modules: [...BASE_MODULES, "verification:requests", "identity:bulk-members"],
  },
};

export function isProfileName(name: string): name is ProfileName {
  return (PROFILE_NAMES as readonly string[]).includes(name);
}

/** Validates CLI input early, before a Prisma client is even constructed. */
export function getSeedProfile(name: string): SeedProfile {
  // A switch rather than `SEED_PROFILES[name]`: the key comes from argv, and
  // a checked switch keeps the public lookup free of dynamic property access.
  switch (name) {
    case "minimal":
      return SEED_PROFILES.minimal;
    case "demo":
      return SEED_PROFILES.demo;
    case "load-test":
      return SEED_PROFILES["load-test"];
    default:
      throw new Error(
        `Unknown seed profile "${name}". Available profiles: ${PROFILE_NAMES.join(", ")}`,
      );
  }
}
