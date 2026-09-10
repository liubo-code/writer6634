// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('story_workspaces', {
  owner: text('owner').primaryKey(), data: text('data').notNull(),
  revision: integer('revision').notNull().default(0), updatedAt: text('updated_at').notNull(),
});
export const snapshots = sqliteTable('story_snapshots', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(),
  data: text('data').notNull(), createdAt: text('created_at').notNull(),
}, t => [index('idx_story_snapshots_owner_created').on(t.owner, t.createdAt)]);

export const manuscriptChapters = sqliteTable('story_manuscript_chapters', {
  owner: text('owner').notNull(), bookId: text('book_id').notNull(), outlineCardId: text('outline_card_id').notNull(),
  content: text('content').notNull().default(''), revisionNotes: text('revision_notes').notNull().default(''),
  revision: integer('revision').notNull().default(0), updatedAt: text('updated_at').notNull(),
}, t => [primaryKey({ columns: [t.owner, t.bookId, t.outlineCardId] }), index('idx_story_manuscript_owner_book').on(t.owner, t.bookId)]);
