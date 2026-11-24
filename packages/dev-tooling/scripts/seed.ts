import { PrismaClient } from "@verixa/database";

import { isProfileName, PROFILE_NAMES, runSeedProfile } from "../index.js";

/**
 * Thin executable wrapper around the seed framework. Deliberately does no
 * seeding itself: the CLI in Issue 331 will call the same public API, so the
 * path contributors run by hand and the path CI runs are the same code.
 */
async function main(): Promise<void> {
  const requested = process.argv[2] ?? "demo";
  if (!isProfileName(requested)) {
    throw new Error(
      `Unknown seed profile "${requested}". Available profiles: ${PROFILE_NAMES.join(", ")}`,
    );
  }

  const prisma = new PrismaClient();
  try {
    const report = await runSeedProfile(prisma, requested);
    const records = report.modules.reduce((total, step) => total + step.records, 0);
    console.log(
      `Seeded profile "${report.profile}" via ${report.modules.length} modules ` +
        `(${String(records)} row upserts).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
