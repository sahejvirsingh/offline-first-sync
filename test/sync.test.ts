import { describe, it, expect, vi } from "vitest";
import { createDb } from "../src/db";
import { SyncEngine, RemoteAPI } from "../src/sync-engine";
import { tasks, syncMutations } from "../src/schema";
import { eq } from "drizzle-orm";

describe("Offline-First Sync Engine", () => {
  it("should queue local mutations and push them to remote", async () => {
    const db = createDb();
    const mockApi: RemoteAPI = {
      pushMutations: vi.fn().mockResolvedValue({ success: true, processedIds: [] }), // populated dynamically
      pullChanges: vi.fn().mockResolvedValue({ changes: [], timestamp: Date.now() })
    };
    
    const engine = new SyncEngine(db, mockApi);
    
    // Create task while offline
    await engine.createTask("task_1", "Buy groceries");
    
    // Verify local DB state
    const localTasks = db.select().from(tasks).all();
    expect(localTasks.length).toBe(1);
    expect(localTasks[0].syncStatus).toBe("pending_push");
    
    const mutations = db.select().from(syncMutations).all();
    expect(mutations.length).toBe(1);
    expect(mutations[0].action).toBe("create");

    // Mock API to successfully process that mutation
    mockApi.pushMutations = vi.fn().mockResolvedValue({ 
      success: true, 
      processedIds: [mutations[0].id] 
    });

    // Run Sync
    await engine.sync(0);

    // Verify queue is cleared and task is marked synced
    const clearedMutations = db.select().from(syncMutations).all();
    expect(clearedMutations.length).toBe(0);

    const syncedTask = db.select().from(tasks).where(eq(tasks.id, "task_1")).get();
    expect(syncedTask?.syncStatus).toBe("synced");
  });

  it("should resolve conflicts using Last Write Wins (LWW)", async () => {
    const db = createDb();
    const mockApi: RemoteAPI = {
      pushMutations: vi.fn().mockResolvedValue({ success: true, processedIds: [] }),
      pullChanges: vi.fn()
    };
    const engine = new SyncEngine(db, mockApi);

    // Local update happened at t=100
    db.insert(tasks).values({
      id: "task_2",
      title: "Local Title",
      completed: false,
      updatedAt: 100,
      syncStatus: "synced"
    }).run();

    // 1. Remote update happened at t=50 (older). Should NOT overwrite local.
    mockApi.pullChanges = vi.fn().mockResolvedValue({
      changes: [{ id: "task_2", title: "Remote Title Old", completed: false, updatedAt: 50 }],
      timestamp: 150
    });
    
    await engine.sync(0);
    expect(db.select().from(tasks).where(eq(tasks.id, "task_2")).get()?.title).toBe("Local Title");

    // 2. Remote update happened at t=200 (newer). SHOULD overwrite local.
    mockApi.pullChanges = vi.fn().mockResolvedValue({
      changes: [{ id: "task_2", title: "Remote Title New", completed: true, updatedAt: 200 }],
      timestamp: 250
    });

    await engine.sync(150);
    const finalTask = db.select().from(tasks).where(eq(tasks.id, "task_2")).get();
    expect(finalTask?.title).toBe("Remote Title New");
    expect(finalTask?.completed).toBe(true);
  });
});
