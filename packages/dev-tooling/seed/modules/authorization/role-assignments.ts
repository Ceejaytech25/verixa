import type { SeedModule } from "../../framework.js";
import { SEED_IDS } from "../../ids.js";

const ASSIGNMENTS = [
  {
    id: SEED_IDS.assignments.aliceAcmeOwner,
    userId: SEED_IDS.users.alice,
    organizationId: SEED_IDS.organizations.acme,
    roleName: "org-owner",
  },
  {
    id: SEED_IDS.assignments.bobGlobexOwner,
    userId: SEED_IDS.users.bob,
    organizationId: SEED_IDS.organizations.globex,
    roleName: "org-owner",
  },
  {
    // The same user holding a weaker role in another tenant: the reason
    // assignments carry organization_id rather than living on the user.
    id: SEED_IDS.assignments.bobAcmeMember,
    userId: SEED_IDS.users.bob,
    organizationId: SEED_IDS.organizations.acme,
    roleName: "member",
  },
] as const;

export const authorizationRoleAssignmentsSeedModule: SeedModule = {
  name: "authorization:role-assignments",
  dependencies: ["identity:users", "identity:organizations", "authorization:catalog"],
  async seed({ prisma, seededAt }) {
    for (const assignment of ASSIGNMENTS) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: assignment.roleName } });
      const fields = {
        userId: assignment.userId,
        organizationId: assignment.organizationId,
        roleId: role.id,
        assignedAt: seededAt,
        assignedBy: null,
        expiresAt: null,
      };

      await prisma.userRoleAssignment.upsert({
        where: { id: assignment.id },
        create: { id: assignment.id, ...fields },
        update: fields,
      });
    }
    return { records: ASSIGNMENTS.length };
  },
};
