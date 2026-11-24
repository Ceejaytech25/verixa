# Local development

This guide covers the loop contributors use most often: start the services,
apply migrations, put a predictable dataset in the database, and run the tests.
It complements the [database guide](database.md), which explains migrations and
schema conventions in detail.

## Quickstart

```bash
pnpm install                     # also generates the Prisma client
docker compose up postgres       # preconfigured local database
pnpm db:migrate                  # apply checked-in migrations
pnpm --filter @verixa/dev-tooling run seed -- demo
pnpm test                        # database-backed specs skip without Postgres
```

`pnpm build` is needed before importing workspace packages from their compiled
entry points (for example when running the API). `pnpm typecheck` and
`pnpm lint` cover the whole workspace.

## Seeding

A local database is useful only if two contributors can arrive at the same
state. `packages/dev-tooling` provides a profile-based seed framework for that:
small modules per bounded context, declared dependencies, and a fixed dataset.

```bash
# From the repository root:
pnpm --filter @verixa/dev-tooling run seed -- minimal
pnpm --filter @verixa/dev-tooling run seed -- demo
pnpm --filter @verixa/dev-tooling run seed -- load-test
```

The default profile is `demo`. `DATABASE_URL` selects the target database, so
the same command works against the compose database or a test container. These
profiles are for local and CI databases only; nothing here should ever be
pointed at a production-looking URL.

| Profile     | What it adds                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `minimal`   | Three users, two organizations, four memberships, the RBAC catalog and three role assignments. |
| `demo`      | `minimal` plus two verification cases (one approved, one in review).                           |
| `load-test` | `demo` plus 100 generated users and 100 tenant memberships.                                    |

### Why re-running is safe

Every module implements the same `SeedModule` interface: a name, a list of
dependencies, and a `seed` method. `resolveSeedPlan` turns a profile's selected
names into a dependency-ordered plan; `runSeedProfile` executes that plan one
module at a time. Profiles select leaf modules and dependencies are pulled in
transitively, so a profile cannot forget the users its role assignments need.

Idempotency comes from **stable keys**, not from deleting first:

- Fixture rows upsert against fixed UUIDs. Alice is always
  `00000000-0000-4000-8000-000000000001`, which makes a bug report
  reproducible across machines and resets.
- The shared RBAC catalog upserts against natural keys (`key`, `name`). That
  also avoids colliding with rows installed by the older
  `pnpm --filter @verixa/database run db:seed` script, which uses random ids.
- Timestamps are frozen at `2026-01-01T00:00:00.000Z`. A seed that stamped rows
  with `new Date()` would report "drift" on every run and make snapshot tests
  useless.

This is the same principle as a safe HTTP retry: applying an operation twice
must leave the same state as applying it once. The practical payoff is that a
seed you are not afraid to re-run is a seed people actually run, and one that
contributors can use after pulling new commits without resetting their local
database.

Judgement calls worth recording:

- **Rejected: "clean the tables, then insert everything".** It would guarantee
  an exact dataset, but it destroys any rows a contributor added by hand and
  makes an accidental run against the wrong database irreversible. Upserting
  stable keys leaves unrelated rows alone.
- **Rejected: `INSERT ... ON CONFLICT DO NOTHING`.** That avoids duplicate-key
  errors but not drift: if a fixture definition changes, the old row stays
  forever. Upserts propagate definition changes while remaining safe to repeat.
- **Rejected: running modules with `Promise.all` for speed.** Every dependency
  here is a foreign key or a lookup: a role assignment needs its user,
  organization and role to exist. Concurrency would make correctness depend on
  timing. The datasets are small enough that sequential execution is the right
  trade.
- **Rejected: the issue's example order "orgs before users".**
  `organizations.owner_id` is `ON DELETE RESTRICT` and references `users`, so
  users must be inserted first. The framework declares the order the schema
  actually permits rather than the order a written example assumed.

No credentials, invitations or realistic secrets are seeded. Addresses use
IANA-reserved `example.com`, and the [database guide's seeding section](database.md#seeding)
explains why seed data must be worthless if copied into an issue or a
screenshot.

### Adding a module

1. Create `packages/dev-tooling/seed/modules/<context>/<name>.ts` exporting a
   `SeedModule`. Give it a unique name and list any modules whose rows it
   needs.
2. Upsert by a stable key, and write the same values on update as on create so
   a second run cannot change a row.
3. Add it to `seedModules` in `seed/modules/index.ts` and list it in the
   profiles that should use it. Dependencies do not need to be repeated in a
   profile.
4. Add an integration assertion for the rows it creates. The existing specs
   run every profile twice, so a non-idempotent module fails without a special
   test.

### Testing

The integration specs run each profile twice against a real Postgres — a
Testcontainers-managed container locally, or `TEST_DATABASE_URL` in CI — and
compare a snapshot of every seeded table between runs. Unit tests cover
dependency resolution, including transitive dependencies, diamonds, cycles and
unknown names. With no Docker and no database the specs skip, so a fresh
checkout still gets a green `pnpm test`; CI sets `REQUIRE_DATABASE_TESTS=1` to
turn an accidental skip into a failure.

See [testing conventions](testing.md) for the broader test strategy.
