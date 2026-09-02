import {
  boolean,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const permissionEnum = pgEnum('permission', [
  'landing_pages.read',
  'landing_pages.write',
  'experiments.write',
  'data_export.read',
  'webhooks.write',
  'api_keys.write',
  'team.review_access',
  'team.assign_roles',
  'team.manage_external',
  'audit_logs.read',
  'manage_permissions',
]);

export type Permission = (typeof permissionEnum.enumValues)[number];

export const accessRoles = pgTable('roles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  isSystem: boolean('isSystem').notNull().default(false),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: text('roleId')
      .notNull()
      .references(() => accessRoles.id, { onDelete: 'cascade' }),
    permission: permissionEnum('permission').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permission] }),
  }),
);

export const SUPERADMIN_ROLE_KEY = 'superadmin' as const;
export const VIEWER_ROLE_KEY = 'viewer' as const;
export const MEMBER_ROLE_KEY = 'member' as const;
