# SQLite Storage Backend with JSONL Sync

## Overview

Add SQLite as a configurable storage backend for TaskMaster that uses JSONL for git-friendly synchronization. SQLite serves as the local working database while JSONL provides version-controlled, merge-conflict-free persistence.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    IStorage Interface                    │
│         (unchanged - all adapters implement this)        │
└─────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │  File    │      │  SQLite  │      │   API    │
   │ Storage  │      │ Storage  │      │ Storage  │
   │(tasks.json)     │(tasks.db)│      │(Supabase)│
   └──────────┘      └────┬─────┘      └──────────┘
                          │
                          ▼ (on every write)
                   ┌──────────────┐
                   │ JSONL Sync   │
                   │.taskmaster/  │
                   │ tasks.jsonl  │
                   └──────────────┘
```

### Key Principles

1. **SQLite is the local source of truth** - all reads/writes go through SQLite
2. **JSONL is the git-synced format** - every SQLite write triggers JSONL export
3. **Self-healing on startup** - if `tasks.db` is missing, rebuild from `tasks.jsonl`
4. **`tasks.db` is gitignored** - it's a local cache, not the canonical data
5. **Line-based JSONL** - each task is one line, enabling clean git diffs

## Storage Configuration

### Config Schema (`.taskmaster/config.json`)

```json
{
  "storage": {
    "type": "sqlite",
    "options": {
      "dbPath": ".taskmaster/tasks.db",
      "jsonlPath": ".taskmaster/tasks.jsonl",
      "walMode": true
    }
  }
}
```

### Storage Types

| Type | Description | Files |
|------|-------------|-------|
| `file` (default) | Current JSON-based storage | `tasks.json` |
| `sqlite` | SQLite + JSONL sync | `tasks.db` + `tasks.jsonl` |
| `api` | Supabase remote | None local |

## Database Schema

```sql
-- Schema version tracking
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Core tasks table
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  details TEXT,
  test_strategy TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  effort INTEGER,
  actual_effort INTEGER,
  complexity TEXT CHECK(complexity IN ('simple', 'moderate', 'complex', 'very-complex')),
  assignee TEXT,
  expansion_prompt TEXT,
  complexity_reasoning TEXT,
  implementation_approach TEXT,
  tag TEXT NOT NULL DEFAULT 'master'
);

-- Task dependencies (many-to-many)
CREATE TABLE task_dependencies (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id),
  CHECK(task_id != depends_on_id)
);

-- Task tags (many-to-many, distinct from "tag" context)
CREATE TABLE task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  PRIMARY KEY (task_id, tag_name)
);

-- Subtasks
CREATE TABLE subtasks (
  id TEXT NOT NULL,
  parent_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review', 'completed')),
  acceptance_criteria TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (parent_id, id)
);

-- Subtask dependencies
CREATE TABLE subtask_dependencies (
  parent_id TEXT NOT NULL,
  subtask_id TEXT NOT NULL,
  depends_on_subtask_id TEXT NOT NULL,
  FOREIGN KEY (parent_id, subtask_id) REFERENCES subtasks(parent_id, id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, subtask_id, depends_on_subtask_id)
);

-- Task metadata (JSON blob for extensibility)
CREATE TABLE task_metadata (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  relevant_files TEXT,  -- JSON array
  codebase_patterns TEXT,  -- JSON array
  existing_infrastructure TEXT,  -- JSON array
  scope_boundaries TEXT,  -- JSON object
  technical_constraints TEXT,  -- JSON array
  acceptance_criteria TEXT,  -- JSON array
  skills TEXT,  -- JSON array
  category TEXT,
  extra TEXT  -- JSON object for any additional fields
);

-- Context/tag metadata
CREATE TABLE tag_metadata (
  tag TEXT PRIMARY KEY,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_tag ON tasks(tag);
CREATE INDEX idx_subtasks_parent ON subtasks(parent_id);
CREATE INDEX idx_subtasks_status ON subtasks(status);
```

## JSONL Format

Each line in `tasks.jsonl` represents one task with all its data:

```jsonl
{"id":"1","title":"Setup project","description":"...","status":"done","priority":"high","dependencies":[],"subtasks":[{"id":"1","title":"..."}],"tag":"master","_v":1,"_ts":"2025-02-05T12:00:00Z"}
{"id":"2","title":"Implement feature","description":"...","status":"pending","priority":"medium","dependencies":["1"],"subtasks":[],"tag":"master","_v":1,"_ts":"2025-02-05T12:01:00Z"}
```

### JSONL Fields

- Standard task fields (matching Task entity)
- `_v`: Schema version (for future migrations)
- `_ts`: Last modified timestamp (for conflict detection)
- `_deleted`: Soft delete marker (optional, for sync)

### Sync Behavior

**On Write:**
1. Update SQLite
2. Read back the full task with relations
3. Find existing line in JSONL (by id) and replace, or append new line
4. JSONL file maintains insertion order (new tasks at end)

**On Startup:**
1. Check if `tasks.db` exists
2. If missing but `tasks.jsonl` exists, rebuild SQLite from JSONL
3. If both exist, verify last sync timestamp matches
4. If neither exists, initialize empty

## File Locations

```
.taskmaster/
├── config.json          # Storage configuration
├── tasks.db             # SQLite database (gitignored)
├── tasks.db-wal         # WAL file (gitignored)
├── tasks.db-shm         # Shared memory (gitignored)
├── tasks.jsonl          # Git-synced task data
└── tasks/
    └── tasks.json       # Legacy format (if using file storage)
```

## Implementation Structure

```
packages/tm-core/src/modules/storage/
├── adapters/
│   ├── file-storage/           # Existing
│   ├── api-storage.ts          # Existing
│   └── sqlite-storage/         # NEW
│       ├── index.ts
│       ├── sqlite-storage.ts   # Main IStorage implementation
│       ├── database.ts         # Database connection & setup
│       ├── schema.ts           # SQL schema definitions
│       ├── migrations.ts       # Schema migration runner
│       ├── queries.ts          # SQL query builders
│       ├── jsonl-sync.ts       # JSONL read/write/sync
│       └── types.ts            # SQLite-specific types
├── services/
│   └── storage-factory.ts      # Update to support 'sqlite' type
└── index.ts
```

## Legacy Shim

For `scripts/modules/utils.js` compatibility:

```javascript
// In utils.js, wrap readJSON/writeJSON

async function readJSON(filepath, projectRoot, tag) {
  const config = await getStorageConfig(projectRoot);

  if (config.storage?.type === 'sqlite') {
    // Route through tm-core SQLite adapter
    const storage = await getStorageInstance(projectRoot);
    const tasks = await storage.loadTasks(tag);
    return { tasks, metadata: await storage.loadMetadata(tag) };
  }

  // Existing file-based implementation
  return readJSONFile(filepath, projectRoot, tag);
}
```

## CLI Commands

```bash
# Check current storage backend
task-master storage --status

# Switch to SQLite (migrates existing data)
task-master storage --type=sqlite

# Switch back to file storage
task-master storage --type=file

# Force rebuild SQLite from JSONL
task-master storage --rebuild

# Export current data to JSONL (manual sync)
task-master storage --export
```

## MCP Tool

```typescript
// storage_config tool
{
  name: "storage_config",
  description: "Get or set storage backend configuration",
  parameters: {
    action: "get" | "set" | "migrate" | "rebuild",
    type?: "file" | "sqlite",
    options?: object
  }
}
```

## Migration Path

### From tasks.json to SQLite

1. Read all tasks from `tasks.json` (handling both formats)
2. Create `tasks.db` with schema
3. Insert all tasks, subtasks, dependencies
4. Write `tasks.jsonl` from SQLite (canonical format)
5. Update `config.json` to `storage.type = "sqlite"`
6. Add `tasks.db*` to `.gitignore`

### From SQLite back to tasks.json

1. Export all tasks from SQLite
2. Write to `tasks.json` in tagged format
3. Update `config.json` to `storage.type = "file"`

## Testing Strategy

1. **Unit tests** for SQLite adapter against IStorage interface contract
2. **JSONL sync tests** - verify round-trip integrity
3. **Migration tests** - json → sqlite → jsonl → sqlite matches original
4. **Concurrency tests** - parallel writes don't corrupt data
5. **Rebuild tests** - delete db, verify rebuild from jsonl works

## Dependencies

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

Note: `better-sqlite3` is a direct dependency (not optional) since users explicitly opt into SQLite mode.
