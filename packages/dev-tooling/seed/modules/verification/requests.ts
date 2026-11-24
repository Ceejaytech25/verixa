import type { SeedModule } from "../../framework.js";
import { SEED_IDS } from "../../ids.js";

const HISTORICAL_CLAIM_EXPIRY = new Date("2026-01-02T00:00:00.000Z");

const REQUESTS = [
  {
    id: SEED_IDS.verificationRequests.aliceIdentity,
    subjectUserId: SEED_IDS.users.alice,
    organizationId: SEED_IDS.organizations.acme,
    type: "identity_document" as const,
    status: "approved" as const,
    assignedReviewerId: SEED_IDS.users.bob,
    assignedAt: HISTORICAL_CLAIM_EXPIRY,
    claimExpiresAt: null,
    decidedByReviewerId: SEED_IDS.users.bob,
    decidedAt: HISTORICAL_CLAIM_EXPIRY,
    decision: "approved" as const,
    decisionNote: "Demo approval",
    needsMoreInfoNote: null,
  },
  {
    id: SEED_IDS.verificationRequests.bobAddress,
    subjectUserId: SEED_IDS.users.bob,
    organizationId: SEED_IDS.organizations.globex,
    type: "address" as const,
    status: "in_review" as const,
    assignedReviewerId: SEED_IDS.users.alice,
    assignedAt: HISTORICAL_CLAIM_EXPIRY,
    claimExpiresAt: HISTORICAL_CLAIM_EXPIRY,
    decidedByReviewerId: null,
    decidedAt: null,
    decision: null,
    decisionNote: null,
    needsMoreInfoNote: null,
  },
] as const;

export const verificationRequestsSeedModule: SeedModule = {
  name: "verification:requests",
  dependencies: ["identity:users", "identity:organizations"],
  async seed({ prisma, seededAt }) {
    for (const { id, ...fields } of REQUESTS) {
      await prisma.verificationRequest.upsert({
        where: { id },
        create: { id, ...fields, createdAt: seededAt, updatedAt: seededAt },
        update: { ...fields, updatedAt: seededAt },
      });
    }
    return { records: REQUESTS.length };
  },
};
