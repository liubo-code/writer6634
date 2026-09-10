// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('story_workspaces', {
  owner: text('owner').primaryKey(), data: text('data').notNull(),
  revision: integer('revision').notNull().default(0), updatedAt: text('updated_at').notNull(),
});
export const snapshots = sqliteTable('story_snapshots', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(),
  data: text('data').notNull(), createdAt: text('created_at').notNull(),
}, t => [index('idx_story_snapshots_owner_created').on(t.owner, t.createdAt)]);
