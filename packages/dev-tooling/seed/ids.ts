/**
 * Stable ids for every fixture row.
 *
 * The `4` and `8` nibbles keep these valid UUIDv4-shaped values, so anything
 * that validates the format still accepts them. Fixed ids are what make a
 * second run an update rather than an insert, and what make a row
 * referenceable in a bug report: `...0001` is Alice on every machine and
 * after every reset.
 */
function fixtureId(suffix: number): string {
  return `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, "0")}`;
}

export const SEED_IDS = {
  users: {
    alice: fixtureId(0x0001),
    bob: fixtureId(0x0002),
    carol: fixtureId(0x0003),
  },
  organizations: {
    acme: fixtureId(0x000a),
    globex: fixtureId(0x000b),
  },
  memberships: {
    aliceAcme: fixtureId(0x0101),
    bobAcme: fixtureId(0x0102),
    bobGlobex: fixtureId(0x0103),
    carolGlobex: fixtureId(0x0104),
  },
  permissions: {
    usersRead: fixtureId(0x0301),
    usersWrite: fixtureId(0x0302),
    rolesRead: fixtureId(0x0303),
    rolesWrite: fixtureId(0x0304),
    orgsRead: fixtureId(0x0305),
    orgsWrite: fixtureId(0x0306),
    all: fixtureId(0x0307),
  },
  roles: {
    superAdmin: fixtureId(0x0201),
    orgOwner: fixtureId(0x0202),
    member: fixtureId(0x0203),
    viewer: fixtureId(0x0204),
  },
  assignments: {
    aliceAcmeOwner: fixtureId(0x0401),
    bobGlobexOwner: fixtureId(0x0402),
    bobAcmeMember: fixtureId(0x0403),
  },
  verificationRequests: {
    aliceIdentity: fixtureId(0x0501),
    bobAddress: fixtureId(0x0502),
  },
} as const;

/** Ids for the load-test profile's generated users and memberships. */
export function bulkUserId(index: number): string {
  return fixtureId(0x100000 + index);
}

export function bulkMembershipId(index: number): string {
  return fixtureId(0x200000 + index);
}
