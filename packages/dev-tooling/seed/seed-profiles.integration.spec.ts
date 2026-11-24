import type { PrismaClient } from "@verixa/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  BULK_MEMBER_COUNT,
  bulkUserId,
  PROFILE_NAMES,
  runSeedProfile,
  SEED_IDS,
} from "../index.js";

import { resetDatabase, startTestDatabase, type TestDatabase } from "./testing/database-harness.js";

/**
 * Each profile is applied twice to the same database. The second run must not
 * hit a unique constraint (which would throw and fail the test) and must leave
 * every seeded row byte-identical, including timestamps — that is what turns
 * "idempotent" from a claim into an observation.
 */
const database = await startTestDatabase();

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [
    users,
    organizations,
    memberships,
    permissions,
    roles,
    rolePermissions,
    assignments,
    verificationRequests,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.organizationMembership.count(),
    prisma.permission.count(),
    prisma.role.count(),
    prisma.rolePermission.count(),
    prisma.userRoleAssignment.count(),
    prisma.verificationRequest.count(),
  ]);

  return {
    users,
    organizations,
    memberships,
    permissions,
    roles,
    rolePermissions,
    assignments,
    verificationRequests,
  };
}

async function snapshot(prisma: PrismaClient): Promise<string> {
  const [
    users,
    organizations,
    memberships,
    permissions,
    roles,
    rolePermissions,
    assignments,
    verificationRequests,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: "asc" } }),
    prisma.organization.findMany({ orderBy: { id: "asc" } }),
    prisma.organizationMembership.findMany({ orderBy: { id: "asc" } }),
    prisma.permission.findMany({ orderBy: { id: "asc" } }),
    prisma.role.findMany({ orderBy: { id: "asc" } }),
    prisma.rolePermission.findMany({ orderBy: [{ roleId: "asc" }, { permissionId: "asc" }] }),
    prisma.userRoleAssignment.findMany({ orderBy: { id: "asc" } }),
    prisma.verificationRequest.findMany({ orderBy: { id: "asc" } }),
  ]);

  return JSON.stringify({
    users,
    organizations,
    memberships,
    permissions,
    roles,
    rolePermissions,
    assignments,
    verificationRequests,
  });
}

describe.skipIf(database === undefined)("seed profiles (real Postgres)", () => {
  // Safe under skipIf: the body only runs when a database was obtained.
  const db = database as TestDatabase;

  beforeAll(async () => {
    await db.prisma.$connect();
  }, 120_000);

  afterAll(async () => {
    await resetDatabase(db.prisma);
    await db.stop();
  });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
  });

  it.each([...PROFILE_NAMES])(
    "applies the %s profile twice without duplicate keys or data drift",
    async (profileName) => {
      await runSeedProfile(db.prisma, profileName);
      const afterFirst = await snapshot(db.prisma);
      const firstCounts = await counts(db.prisma);

      await runSeedProfile(db.prisma, profileName);

      expect(await snapshot(db.prisma)).toBe(afterFirst);
      expect(await counts(db.prisma)).toEqual(firstCounts);
    },
    120_000,
  );

  it("minimal seeds a coherent identity/RBAC graph and nothing else", async () => {
    await runSeedProfile(db.prisma, "minimal");

    expect(await counts(db.prisma)).toEqual({
      users: 3,
      organizations: 2,
      memberships: 4,
      permissions: 7,
      roles: 4,
      rolePermissions: 12,
      assignments: 3,
      verificationRequests: 0,
    });
  });

  it("demo adds verification cases that reference seeded users and organizations", async () => {
    await runSeedProfile(db.prisma, "demo");

    const result = await counts(db.prisma);
    expect(result.verificationRequests).toBe(2);
    expect(result.users).toBe(3);

    const request = await db.prisma.verificationRequest.findUniqueOrThrow({
      where: { id: SEED_IDS.verificationRequests.aliceIdentity },
    });
    expect(request.subjectUserId).toBe(SEED_IDS.users.alice);
    expect(request.organizationId).toBe(SEED_IDS.organizations.acme);
  });

  it("load-test adds generated, referenceable tenant members", async () => {
    await runSeedProfile(db.prisma, "load-test");

    const result = await counts(db.prisma);
    expect(result.users).toBe(3 + BULK_MEMBER_COUNT);
    expect(result.memberships).toBe(4 + BULK_MEMBER_COUNT);

    const member = await db.prisma.user.findUniqueOrThrow({ where: { id: bulkUserId(1) } });
    expect(member.email).toBe("load-user-0001@example.com");
  });

  it("runs each module after its declared dependencies", async () => {
    const report = await runSeedProfile(db.prisma, "demo");

    expect(report.modules.map((step) => step.module)).toEqual([
      "identity:users",
      "identity:organizations",
      "authorization:catalog",
      "authorization:role-assignments",
      "verification:requests",
    ]);
  });
});
