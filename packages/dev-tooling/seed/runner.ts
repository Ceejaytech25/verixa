import type { PrismaClient } from "@verixa/database";

import { executeSeedPlan, resolveSeedPlan, type SeedRunReport } from "./framework.js";
import { seedModules } from "./modules/index.js";
import { getSeedProfile, type ProfileName } from "./profiles.js";

/**
 * Applies a named profile to a database.
 *
 * This is the single entry point the CLI/script consumers need: profile
 * validation, dependency resolution and execution stay in that order, so an
 * invalid profile fails before a write and ordering is never reimplemented at
 * a call site.
 */
export async function runSeedProfile(
  prisma: PrismaClient,
  profileName: ProfileName,
): Promise<SeedRunReport> {
  const profile = getSeedProfile(profileName);
  const plan = resolveSeedPlan(seedModules, profile);
  return executeSeedPlan(prisma, plan);
}
