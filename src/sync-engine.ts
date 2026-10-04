import { createDb } from "./db";
import { tasks, syncMutations } from "./schema";
import { eq, asc } from "drizzle-orm";
import crypto from "crypto";

export interface RemoteAPI {
  pushMutations(mutations: any[]): Promise<{ success: boolean; processedIds: string[] }>;
  pullChanges(since: number): Promise<{ changes: any[]; timestamp: number }>;
}

export class SyncEngine {
  constructor(public db: ReturnType<typeof createDb>, private api: RemoteAPI) {}

  async createTask(id: string, title: string) {
    const now = Date.now();
    this.db.transaction((tx) => {
      tx.insert(tasks).values({
        id,
        title,
        updatedAt: now,
        syncStatus: "pending_push"
      }).run();

      tx.insert(syncMutations).values({
        id: crypto.randomUUID(),
        entityId: id,
        action: "create",
        payload: JSON.stringify({ id, title, completed: false }),
        createdAt: now,
      }).run();
    });
  }

  async updateTask(id: string, updates: { title?: string; completed?: boolean }) {
    const now = Date.now();
    this.db.transaction((tx) => {
      const task = tx.select().from(tasks).where(eq(tasks.id, id)).get();
      if (!task) throw new Error("Task not found");

      tx.update(tasks)
        .set({ ...updates, updatedAt: now, syncStatus: "pending_push" })
        .where(eq(tasks.id, id)).run();

      tx.insert(syncMutations).values({
        id: crypto.randomUUID(),
        entityId: id,
        action: "update",
        payload: JSON.stringify(updates),
        createdAt: now,
      }).run();
    });
  }

  async sync(lastSyncTimestamp: number) {
    // 1. Push Phase
    const pending = this.db.select().from(syncMutations).orderBy(asc(syncMutations.createdAt)).all();
    if (pending.length > 0) {
      const result = await this.api.pushMutations(pending);
      if (result.success) {
        this.db.transaction((tx) => {
          for (const id of result.processedIds) {
            tx.delete(syncMutations).where(eq(syncMutations.id, id)).run();
          }
          const entityIds = pending.filter(m => result.processedIds.includes(m.id)).map(m => m.entityId);
          for (const eid of new Set(entityIds)) {
             tx.update(tasks).set({ syncStatus: "synced" }).where(eq(tasks.id, eid)).run();
          }
        });
      }
    }

    // 2. Pull Phase
    const pullResult = await this.api.pullChanges(lastSyncTimestamp);
    if (pullResult.changes.length > 0) {
      this.db.transaction((tx) => {
        for (const change of pullResult.changes) {
          const local = tx.select().from(tasks).where(eq(tasks.id, change.id)).get();
          if (!local) {
            tx.insert(tasks).values({
              id: change.id,
              title: change.title,
              completed: change.completed,
              updatedAt: change.updatedAt,
              syncStatus: "synced"
            }).run();
          } else {
            // Last Write Wins (LWW)
            if (change.updatedAt > local.updatedAt) {
              tx.update(tasks).set({
                title: change.title,
                completed: change.completed,
                updatedAt: change.updatedAt,
                syncStatus: "synced"
              }).where(eq(tasks.id, change.id)).run();
            }
          }
        }
      });
    }

    return pullResult.timestamp;
  }
}
