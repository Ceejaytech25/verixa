import type { SeedModule } from "../../framework.js";
import { SEED_IDS } from "../../ids.js";

const ORGANIZATIONS = [
  {
    id: SEED_IDS.organizations.acme,
    name: "Acme Inc",
    slug: "acme",
    ownerId: SEED_IDS.users.alice,
    status: "active" as const,
  },
  {
    id: SEED_IDS.organizations.globex,
    name: "Globex Corporation",
    slug: "globex",
    ownerId: SEED_IDS.users.bob,
    status: "active" as const,
  },
] as const;

const MEMBERSHIPS = [
  {
    id: SEED_IDS.memberships.aliceAcme,
    userId: SEED_IDS.users.alice,
    organizationId: SEED_IDS.organizations.acme,
    status: "active" as const,
  },
  {
    id: SEED_IDS.memberships.bobAcme,
    userId: SEED_IDS.users.bob,
    organizationId: SEED_IDS.organizations.acme,
    status: "active" as const,
  },
  {
    // Bob spans two tenants on purpose: cross-tenant reads are the case
    // naive isolation schemes get wrong, so it belongs in the default data.
    id: SEED_IDS.memberships.bobGlobex,
    userId: SEED_IDS.users.bob,
    organizationId: SEED_IDS.organizations.globex,
    status: "active" as const,
  },
  {
    // A revoked membership makes the partial unique index (which allows
    // rejoining) visible in a real local database.
    id: SEED_IDS.memberships.carolGlobex,
    userId: SEED_IDS.users.carol,
    organizationId: SEED_IDS.organizations.globex,
    status: "revoked" as const,
  },
] as const;

export const identityOrganizationsSeedModule: SeedModule = {
  name: "identity:organizations",
  // Organizations have a Restrict FK to their owner, so users must exist
  // first. The roadmap's example order ("orgs before users") cannot be
  // honored by this schema without dropping referential integrity.
  dependencies: ["identity:users"],
  async seed({ prisma, seededAt }) {
    for (const { id, ...fields } of ORGANIZATIONS) {
      await prisma.organization.upsert({
        where: { id },
        create: { id, ...fields, createdAt: seededAt, updatedAt: seededAt },
        update: { ...fields, updatedAt: seededAt },
      });
    }
    for (const { id, ...fields } of MEMBERSHIPS) {
      await prisma.organizationMembership.upsert({
        where: { id },
        create: { id, ...fields, joinedAt: seededAt },
        update: { ...fields, joinedAt: seededAt },
      });
    }
    return { records: ORGANIZATIONS.length + MEMBERSHIPS.length };
  },
};
