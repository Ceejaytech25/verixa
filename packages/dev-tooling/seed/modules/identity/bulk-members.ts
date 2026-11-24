import type { SeedModule } from "../../framework.js";
import { bulkMembershipId, bulkUserId, SEED_IDS } from "../../ids.js";

/**
 * Enough tenant-scoped rows to make load-test scenarios meaningful without
 * making a twice-per-profile integration test slow. The count is fixed rather
 * than configurable: a load-test result is only comparable between runs if
 * the starting dataset is the same shape.
 */
export const BULK_MEMBER_COUNT = 100;

export const identityBulkMembersSeedModule: SeedModule = {
  name: "identity:bulk-members",
  dependencies: ["identity:users", "identity:organizations"],
  async seed({ prisma, seededAt }) {
    for (let index = 1; index <= BULK_MEMBER_COUNT; index += 1) {
      const label = String(index).padStart(4, "0");
      const userId = bulkUserId(index);
      const email = `load-user-${label}@example.com`;
      const displayName = `Load User ${label}`;

      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email,
          displayName,
          givenName: null,
          familyName: null,
          status: "active",
          createdAt: seededAt,
          updatedAt: seededAt,
        },
        update: {
          email,
          displayName,
          givenName: null,
          familyName: null,
          status: "active",
          updatedAt: seededAt,
        },
      });

      const organizationId =
        index % 2 === 0 ? SEED_IDS.organizations.acme : SEED_IDS.organizations.globex;
      await prisma.organizationMembership.upsert({
        where: { id: bulkMembershipId(index) },
        create: {
          id: bulkMembershipId(index),
          userId,
          organizationId,
          status: "active",
          joinedAt: seededAt,
        },
        update: { userId, organizationId, status: "active", joinedAt: seededAt },
      });
    }
    return { records: BULK_MEMBER_COUNT * 2 };
  },
};
