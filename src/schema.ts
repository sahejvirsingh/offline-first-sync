import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at").notNull(),
  syncStatus: text("sync_status", { enum: ["synced", "pending_push"] }).notNull().default("synced"),
});

export const syncMutations = sqliteTable("sync_mutations", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull(),
  action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
  payload: text("payload"),
  createdAt: integer("created_at").notNull(),
});
