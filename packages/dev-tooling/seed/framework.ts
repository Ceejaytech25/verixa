import type { PrismaClient } from "@verixa/database";

/**
 * A frozen timestamp for every row a seed writes.
 *
 * A seed that calls `new Date()` produces a different database on every run,
 * so a second run looks like "data drift" even when nothing about the fixture
 * definition changed. Fixing the instant makes snapshotting the whole seeded
 * dataset a meaningful idempotency assertion rather than a comparison that
 * always fails on `updatedAt`.
 */
export const DEFAULT_SEEDED_AT = new Date("2026-01-01T00:00:00.000Z");

/** Everything a module receives. Nothing is imported from the CLI or a test. */
export interface SeedContext {
  readonly prisma: PrismaClient;
  readonly profile: string;
  readonly seededAt: Date;
}

/** A module reports how many rows it upserted, for operator-facing logs. */
export interface SeedModuleResult {
  readonly records: number;
}

/**
 * One bounded context's contribution to a seed run.
 *
 * `seed` must be idempotent: calling it twice against the same database must
 * leave exactly the same rows. Modules upsert against stable keys (a fixed id
 * for fixture rows, a unique natural key for shared catalogs) rather than
 * deleting and reinserting, so a re-run is safe and so locally-added rows in
 * other tables are never swept away.
 *
 * Dependencies are *module names*, not import edges. They describe data that
 * must exist first (users before organizations, roles before assignments),
 * and are resolved by {@link resolveSeedPlan} before anything is executed.
 */
export interface SeedModule {
  readonly name: string;
  readonly dependencies: readonly string[];
  seed(context: SeedContext): Promise<SeedModuleResult>;
}

/** A named selection of modules. Dependencies are added by the resolver. */
export interface SeedProfile {
  readonly name: string;
  readonly description: string;
  readonly modules: readonly string[];
}

/** A validated, ordered set of modules ready to execute. */
export interface SeedPlan {
  readonly profile: string;
  readonly modules: readonly SeedModule[];
}

export interface SeedStepReport {
  readonly module: string;
  readonly records: number;
}

export interface SeedRunReport {
  readonly profile: string;
  readonly modules: readonly SeedStepReport[];
}

/**
 * Resolves a profile's selected modules into a dependency-ordered plan.
 *
 * This is deliberately separate from execution: ordering is a pure function
 * of declarations, so it can be unit-tested without a database, and a cycle
 * or a typo in a dependency is reported before the first write happens.
 *
 * Dependencies that the profile did not name are included transitively. That
 * makes profiles composable — a profile asks for the fixtures it cares about
 * and cannot accidentally omit the users or roles they reference — while the
 * `visiting`/`done` states deduplicate diamond-shaped graphs and catch cycles.
 */
export function resolveSeedPlan(modules: readonly SeedModule[], profile: SeedProfile): SeedPlan {
  const byName = new Map<string, SeedModule>();
  for (const module of modules) {
    if (byName.has(module.name)) {
      throw new Error(`Duplicate seed module name "${module.name}"`);
    }
    byName.set(module.name, module);
  }

  const ordered: SeedModule[] = [];
  const state = new Map<string, "visiting" | "done">();

  const visit = (name: string, trail: readonly string[]): void => {
    const current = state.get(name);
    if (current === "done") return;
    if (current === "visiting") {
      throw new Error(`Cyclic seed module dependency: ${[...trail, name].join(" -> ")}`);
    }

    const module = byName.get(name);
    if (module === undefined) {
      throw new Error(
        `Unknown seed module "${name}" (selected by profile "${profile.name}"). ` +
          `Available modules: ${[...byName.keys()].join(", ")}`,
      );
    }

    state.set(name, "visiting");
    for (const dependency of module.dependencies) {
      if (!byName.has(dependency)) {
        throw new Error(`Seed module "${name}" depends on unknown module "${dependency}"`);
      }
      visit(dependency, [...trail, name]);
    }
    state.set(name, "done");
    ordered.push(module);
  };

  for (const name of profile.modules) {
    visit(name, []);
  }

  return { profile: profile.name, modules: ordered };
}

/**
 * Executes a resolved plan strictly sequentially.
 *
 * Parallel execution would be faster, but every dependency here is a
 * foreign-key or lookup dependency: a role assignment can only be written
 * after its user, organization and role rows exist. Concurrency would turn an
 * explicit ordering guarantee into a race, and idempotency into a matter of
 * timing. The dataset is small enough that correctness is worth more than the
 * saved seconds.
 */
export async function executeSeedPlan(
  prisma: PrismaClient,
  plan: SeedPlan,
  options: { readonly seededAt?: Date } = {},
): Promise<SeedRunReport> {
  const seededAt = options.seededAt ?? DEFAULT_SEEDED_AT;
  const steps: SeedStepReport[] = [];

  for (const module of plan.modules) {
    const result = await module.seed({ prisma, profile: plan.profile, seededAt });
    steps.push({ module: module.name, records: result.records });
  }

  return { profile: plan.profile, modules: steps };
}
