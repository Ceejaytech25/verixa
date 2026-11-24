import type { SeedModule } from "../../framework.js";
import { SEED_IDS } from "../../ids.js";

const PERMISSIONS = [
  { id: SEED_IDS.permissions.usersRead, key: "users:read", description: "View users" },
  {
    id: SEED_IDS.permissions.usersWrite,
    key: "users:write",
    description: "Create and update users",
  },
  {
    id: SEED_IDS.permissions.rolesRead,
    key: "roles:read",
    description: "View roles and permissions",
  },
  {
    id: SEED_IDS.permissions.rolesWrite,
    key: "roles:write",
    description: "Create and manage roles",
  },
  { id: SEED_IDS.permissions.orgsRead, key: "orgs:read", description: "View organizations" },
  { id: SEED_IDS.permissions.orgsWrite, key: "orgs:write", description: "Manage organizations" },
  {
    id: SEED_IDS.permissions.all,
    key: "*:*",
    description: "Unrestricted platform administration",
  },
] as const;

const ROLES = [
  {
    id: SEED_IDS.roles.superAdmin,
    name: "super-admin",
    description: "Platform administrator",
    permissions: ["*:*"],
  },
  {
    id: SEED_IDS.roles.orgOwner,
    name: "org-owner",
    description: "Organization owner",
    permissions: [
      "users:read",
      "users:write",
      "roles:read",
      "roles:write",
      "orgs:read",
      "orgs:write",
    ],
  },
  {
    id: SEED_IDS.roles.member,
    name: "member",
    description: "Organization member",
    permissions: ["users:read", "orgs:read"],
  },
  {
    id: SEED_IDS.roles.viewer,
    name: "viewer",
    description: "Read-only organization viewer",
    permissions: ["users:read", "orgs:read", "roles:read"],
  },
] as const;

export const authorizationCatalogSeedModule: SeedModule = {
  name: "authorization:catalog",
  // Roles and permissions are global; assigning them to tenants happens in
  // authorization:role-assignments, once users and organizations exist.
  dependencies: [],
  async seed({ prisma, seededAt }) {
    const permissionIds = new Map<string, string>();
    for (const permission of PERMISSIONS) {
      // Upsert by the natural key, not by the fixed id. A developer who
      // already ran `pnpm db:seed` has these rows with random ids; reusing
      // them keeps this framework from colliding with the older script while
      // still producing fixed ids on a fresh database.
      const saved = await prisma.permission.upsert({
        where: { key: permission.key },
        create: {
          id: permission.id,
          key: permission.key,
          description: permission.description,
          createdAt: seededAt,
        },
        update: { description: permission.description },
      });
      permissionIds.set(permission.key, saved.id);
    }

    let records = PERMISSIONS.length;
    for (const role of ROLES) {
      const saved = await prisma.role.upsert({
        where: { name: role.name },
        create: {
          id: role.id,
          name: role.name,
          description: role.description,
          isSystemRole: true,
          createdAt: seededAt,
          updatedAt: seededAt,
        },
        update: {
          description: role.description,
          isSystemRole: true,
          updatedAt: seededAt,
        },
      });

      for (const key of role.permissions) {
        const permissionId = permissionIds.get(key);
        if (permissionId === undefined) {
          throw new Error(`Missing seeded permission "${key}" for role "${role.name}"`);
        }
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: saved.id, permissionId } },
          create: { roleId: saved.id, permissionId },
          update: {},
        });
        records += 1;
      }
    }
    return { records };
  },
};
