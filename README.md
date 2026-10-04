# 🔄 Offline-First Sync Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-0.30-C5F74F.svg)](https://orm.drizzle.team/)
[![SQLite](https://img.shields.io/badge/SQLite-Better--SQLite3-003B57.svg)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen.svg)]()

> A production-grade Local-First synchronization queue architecture built with SQLite and Drizzle ORM, featuring transactional offline mutation batching and deterministic Last-Write-Wins (LWW) conflict reconciliation.

---

## 🎯 Executive Summary & Problem Space

Traditional client-server applications assume a constant, reliable internet connection. In reality:
1. Mobile devices and edge clients frequently enter offline states or unstable networks.
2. Blocking UI actions on network HTTP round-trips creates perceptible lag and frustrated users.
3. Naive synchronization strategies overwrite data blindly, destroying edits made concurrently on multiple devices during a disconnect.

**Offline-First Sync Engine** implements a **Local-First architecture**: all creates, updates, and deletes write synchronously to an embedded local SQLite database instantly, while an asynchronous two-phase push/pull synchronization engine reconciles state with a remote server using a deterministic **Last-Write-Wins (LWW)** conflict resolution algorithm.

---

## ⚡ Core Technical Features

- **Instant Zero-Latency Local Writes**: User mutations write immediately to local SQLite in microseconds via etter-sqlite3.
- **ACID Transactional Mutation Queue**: Local writes and mutation queue inserts occur inside a single atomic SQLite transaction; if the mutation log fails, the local write rolls back.
- **Two-Phase Synchronization Protocol**:
  1. **Push Phase**: Flushes pending offline mutations ordered by created_at timestamp. Once acknowledged by the remote server, mutations are cleared and local entities transitioned from pending_push to synced.
  2. **Pull Phase**: Fetches upstream changes that occurred since lastSyncTimestamp.
- **Deterministic Last-Write-Wins (LWW) Conflict Resolution**:
  - Compares remote updated_at against local updated_at.
  - Upstream changes overwrite local records if and only if:
    \text{timestamp}_{\text{remote}} > \text{timestamp}_{\text{local}}
  - Prevents stale server updates from overwriting newer local edits made while disconnected.

---

## 📊 Synchronization Protocol Diagram

`mermaid
sequenceDiagram
    autonumber
    participant App as Application UI
    participant LocalDB as Local SQLite (Tasks)
    participant Queue as Sync Queue (sync_mutations)
    participant Engine as Sync Engine
    participant Remote as Remote Server API

    Note over App, Queue: Local Offline Operation
    App->>LocalDB: BEGIN TRANSACTION
    App->>LocalDB: INSERT / UPDATE entity (status: pending_push)
    App->>Queue: INSERT mutation (action, payload, timestamp)
    App->>LocalDB: COMMIT TRANSACTION
    LocalDB-->>App: UI Updates Instantly

    Note over Engine, Remote: Background Sync Triggered (Online)
    Engine->>Queue: SELECT * FROM sync_mutations ORDER BY created_at ASC
    Queue-->>Engine: Return pending mutations array
    
    rect rgb(240, 248, 255)
        Note over Engine, Remote: Phase 1: Push
        Engine->>Remote: POST /sync/push (mutations)
        Remote-->>Engine: { success: true, processedIds: [...] }
        Engine->>Queue: DELETE FROM sync_mutations WHERE id IN (processedIds)
        Engine->>LocalDB: UPDATE tasks SET sync_status = 'synced'
    end

    rect rgb(245, 255, 245)
        Note over Engine, Remote: Phase 2: Pull & LWW Reconciliation
        Engine->>Remote: GET /sync/pull?since=lastTimestamp
        Remote-->>Engine: { changes: [...], timestamp: newTimestamp }
        loop For each remote change
            Engine->>LocalDB: Compare remote.updatedAt vs local.updatedAt
            alt remote.updatedAt > local.updatedAt
                Engine->>LocalDB: UPDATE entity (Remote Wins)
            else local.updatedAt >= remote.updatedAt
                Engine->>LocalDB: Ignore (Local Edit is Newer)
            end
        end
    end
`

---

## 🚀 Installation & Quick Start

`ash
git clone https://github.com/sahejvirsingh/offline-first-sync.git
cd offline-first-sync
npm install
npm test
`

### Usage Example

`	ypescript
import { createDb, SyncEngine, RemoteAPI } from "offline-first-sync";

// 1. Initialize local SQLite database instance
const db = createDb(/* inMemory = */ false);

// 2. Define remote HTTP adapter
const remoteApi: RemoteAPI = {
  pushMutations: async (mutations) => {
    const res = await fetch("https://api.example.com/sync/push", {
      method: "POST",
      body: JSON.stringify({ mutations }),
    });
    return res.json();
  },
  pullChanges: async (since) => {
    const res = await fetch(https://api.example.com/sync/pull?since=);
    return res.json();
  }
};

// 3. Initialize engine
const engine = new SyncEngine(db, remoteApi);

// 4. Perform instantaneous local operations (even if airplane mode is ON!)
await engine.createTask("task_101", "Draft quarterly product vision");

// 5. Trigger synchronization (automatically or on network reconnect)
const newSyncTimestamp = await engine.sync(/* lastSyncTimestamp = */ 0);
console.log(Sync complete. Next delta marker: );
`

---

## 🧪 Testing Verification

Covered by comprehensive Vitest suites:
- **Queue Drain Assertions**: Verifies that successful push requests prune the mutation queue completely and transition entities to synced.
- **LWW Conflict Resolution**: Simulates race conditions where local edits and remote changes arrive concurrently, verifying that the mathematically newer edit always prevails.

---

## 📄 License
MIT © [Sahejvir Singh](https://github.com/sahejvirsingh)
