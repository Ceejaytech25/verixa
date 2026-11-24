import type { SeedModule } from "../../framework.js";
import { SEED_IDS } from "../../ids.js";

const USERS = [
  {
    id: SEED_IDS.users.alice,
    email: "alice@example.com",
    displayName: "Alice Ashworth",
    givenName: "Alice",
    familyName: "Ashworth",
    status: "active" as const,
  },
  {
    id: SEED_IDS.users.bob,
    email: "bob@example.com",
    displayName: "Bob Barker",
    givenName: "Bob",
    familyName: "Barker",
    status: "active" as const,
  },
  {
    // A non-active status in the default data catches code that only ever
    // exercises the happy path locally.
    id: SEED_IDS.users.carol,
    email: "carol@example.com",
    displayName: "Carol Chen",
    givenName: null,
    familyName: null,
    status: "pending" as const,
  },
] as const;

export const identityUsersSeedModule: SeedModule = {
  name: "identity:users",
  dependencies: [],
  async seed({ prisma, seededAt }) {
    for (const { id, ...fields } of USERS) {
      await prisma.user.upsert({
        where: { id },
        create: { id, ...fields, createdAt: seededAt, updatedAt: seededAt },
        update: { ...fields, updatedAt: seededAt },
      });
    }
    return { records: USERS.length };
  },
};
