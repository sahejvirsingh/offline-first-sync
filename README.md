# 🔄 Offline-First Sync Engine

A standalone reference implementation of a Local-First synchronization queue using SQLite and Drizzle ORM.

## ✨ Features

- **Local-First Writes**: Immediate, synchronous writes to a local database (etter-sqlite3).
- **Mutation Queue**: Automatically records all mutations (create, update, delete) to a sync_mutations table when offline.
- **Batched Syncing**: Drains the local queue, pushes to a remote API, and pulls new changes.
- **Conflict Resolution**: Implements a strict Last-Write-Wins (LWW) merge strategy based on updated_at timestamps to safely override local data with remote truth.
- **Drizzle ORM**: Fully type-safe local database queries.

## 🚀 Quick Start

`ash
npm install
npm test
`

## 🧠 Architecture

`mermaid
sequenceDiagram
    participant UI as Application
    participant Local as Local SQLite
    participant Queue as Mutation Queue
    participant Remote as Remote API

    UI->>Local: Update record
    Local->>Queue: Log mutation (action, payload)
    
    Note over Queue, Remote: --- Push Phase ---
    Queue->>Remote: Send pending mutations
    Remote-->>Queue: Acknowledge processed IDs
    Queue->>Queue: Clear processed IDs
    
    Note over Queue, Remote: --- Pull Phase ---
    Remote-->>Local: Send recent changes
    Local->>Local: Merge using Last-Write-Wins
`

## 📄 License
MIT
