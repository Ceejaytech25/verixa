import type { SeedModule } from "../framework.js";

import { authorizationCatalogSeedModule } from "./authorization/catalog.js";
import { authorizationRoleAssignmentsSeedModule } from "./authorization/role-assignments.js";
import { identityBulkMembersSeedModule } from "./identity/bulk-members.js";
import { identityOrganizationsSeedModule } from "./identity/organizations.js";
import { identityUsersSeedModule } from "./identity/users.js";
import { verificationRequestsSeedModule } from "./verification/requests.js";

/**
 * The registry a profile resolves against. Ordered here for readability, but
 * consumers must not rely on array order: {@link resolveSeedPlan} derives the
 * execution order from each module's declared dependencies instead.
 */
export const seedModules: readonly SeedModule[] = [
  identityUsersSeedModule,
  identityOrganizationsSeedModule,
  authorizationCatalogSeedModule,
  authorizationRoleAssignmentsSeedModule,
  verificationRequestsSeedModule,
  identityBulkMembersSeedModule,
];

export {
  authorizationCatalogSeedModule,
  authorizationRoleAssignmentsSeedModule,
  identityBulkMembersSeedModule,
  identityOrganizationsSeedModule,
  identityUsersSeedModule,
  verificationRequestsSeedModule,
};
