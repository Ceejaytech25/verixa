// Curated public surface of @verixa/dev-tooling. Consumers (the local-dev CLI
// in Issue 331, CI fixtures, and contributor scripts) should import from here
// rather than deep paths into seed/modules, so the registry and execution
// order can change without breaking callers.

export type {
  SeedContext,
  SeedModule,
  SeedModuleResult,
  SeedPlan,
  SeedProfile,
  SeedRunReport,
  SeedStepReport,
} from "./seed/framework.js";
export { DEFAULT_SEEDED_AT, executeSeedPlan, resolveSeedPlan } from "./seed/framework.js";

export { SEED_IDS, bulkMembershipId, bulkUserId } from "./seed/ids.js";

export {
  authorizationCatalogSeedModule,
  authorizationRoleAssignmentsSeedModule,
  identityBulkMembersSeedModule,
  identityOrganizationsSeedModule,
  identityUsersSeedModule,
  seedModules,
  verificationRequestsSeedModule,
} from "./seed/modules/index.js";

export {
  getSeedProfile,
  isProfileName,
  PROFILE_NAMES,
  SEED_PROFILES,
  type ProfileName,
} from "./seed/profiles.js";

export { runSeedProfile } from "./seed/runner.js";

export { BULK_MEMBER_COUNT } from "./seed/modules/identity/bulk-members.js";
