import { execFileSync } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@verixa/database";

/**
 * Real Postgres for the seed integration specs, by whichever route is
 * available:
 *
 * 1. `TEST_DATABASE_URL` when reachable (CI's service container, or a local
 *    `docker compose up postgres`), so CI stays fast.
 * 2. A Testcontainers-managed container otherwise, so each local run gets a
 *    pristine database and Docker-backed CI coverage is exercised.
 *
 * With neither available the specs skip, keeping a fresh clone's `pnpm test`
 * green; `REQUIRE_DATABASE_TESTS=1` turns that skip into a failure for CI.
 * This mirrors packages/identity's harness rather than importing it: a
 * context's testing internals are not another package's public API.
 */

const CONNECT_TIMEOUT_MS = 2_000;
const CONTAINER_START_TIMEOUT_MS = 120_000;

export interface TestDatabase {
  readonly prisma: PrismaClient;
  readonly stop: () => Promise<void>;
}

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolveConnection) => {
    const socket = createConnection({ host, port });
    const finish = (reachable: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolveConnection(reachable);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => finish(false));
  });
}

async function existingDatabaseUrl(): Promise<string | undefined> {
  const configured = process.env["TEST_DATABASE_URL"];
  if (configured === undefined) return undefined;
  const url = new URL(configured);
  return (await canConnect(url.hostname, Number(url.port || 5432))) ? configured : undefined;
}

function dockerAvailable(): boolean {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function applyMigrations(databaseUrl: string): void {
  const databasePackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../database");
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: databasePackageRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
}

export async function startTestDatabase(): Promise<TestDatabase | undefined> {
  const required = process.env["REQUIRE_DATABASE_TESTS"] === "1";
  const existing = await existingDatabaseUrl();
  if (existing !== undefined) {
    const prisma = new PrismaClient({ datasources: { db: { url: existing } } });
    return { prisma, stop: () => prisma.$disconnect() };
  }

  if (!dockerAvailable()) {
    if (required) {
      throw new Error(
        "REQUIRE_DATABASE_TESTS=1 but no database is available: TEST_DATABASE_URL is unset or " +
          "unreachable, and no Docker daemon was found for Testcontainers to use.",
      );
    }
    return undefined;
  }

  let container: StartedPostgreSqlContainer;
  try {
    // Loaded only on this path. Importing Testcontainers at module scope
    // makes its undici dependency load even when a spec is about to skip
    // because neither a database nor Docker is available — which turns a
    // clean "no database" skip into a collection error on a fresh clone.
    const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("verixa_test")
      .withUsername("verixa")
      .withPassword("verixa")
      .withStartupTimeout(CONTAINER_START_TIMEOUT_MS)
      .start();
  } catch (error) {
    if (required) throw error;
    return undefined;
  }

  const url = container.getConnectionUri();
  // Replay the checked-in migrations, not `db push`: a schema built straight
  // from schema.prisma could pass while a migration is broken or missing.
  applyMigrations(url);

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  return {
    prisma,
    stop: async () => {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}

/**
 * Clears every table the seed modules touch, in foreign-key-safe order.
 *
 * Each profile test starts from an empty database so a profile's own module
 * selection is what produces the observed rows — not a previous test's
 * leftovers. Users are deleted last because `organizations.owner_id` is
 * ON DELETE RESTRICT.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.auditLogEntry.deleteMany();
  await prisma.anchorRecord.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.verificationRequest.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.mfaMethod.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.userRoleAssignment.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}
