// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const songs = sqliteTable('songs', { id: text('id').primaryKey(), data: text('data').notNull(), revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull() });
export const sessions = sqliteTable('sessions', { id: text('id').primaryKey(), data: text('data').notNull(), createdAt: text('created_at').notNull() });
export const licks = sqliteTable('licks', { id: text('id').primaryKey(), data: text('data').notNull(), revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull() });
