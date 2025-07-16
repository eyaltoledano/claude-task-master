# Flow Database Sync System

A comprehensive SQLite database integration with bi-directional synchronization for Task Master's tasks.json file.

## 🚀 Quick Start

### Installation
The sync system is already integrated! Just run:

```bash
# Generate the database
npm run db:generate

# Test the setup
node scripts/modules/flow/infra/database/test-setup.js
```

### Basic Usage

```javascript
import { setupSync, QuickTriggers } from './scripts/modules/flow/index.js';

// Quick setup with sensible defaults
const sync = await setupSync(process.cwd(), {
  autoSync: true,
  enableMonitoring: true,
  initialSync: true
});

// Trigger sync after operations
await QuickTriggers.taskCreated(process.cwd(), { id: 1, title: 'New Task' });

// Manual sync
await sync.sync('auto');

// Check status
const status = await sync.getStatus();
console.log('Sync health:', status.health);
```

## 📋 Commands

### CLI Commands
```bash
# Main sync command
flow sync                           # Auto-sync
flow sync --direction json-to-db    # Specific direction
flow sync --dry-run                 # Preview changes
flow sync --force-json              # Force JSON as source

# Status and monitoring
flow sync:status                    # Show sync status
flow sync:status --detailed         # Detailed conflicts

# Force sync (conflict resolution)
flow sync:force json               # Force JSON → DB
flow sync:force db                 # Force DB → JSON

# Trigger auto-sync
flow sync:trigger task_created --task-id 5
flow sync:trigger bulk_update --count 10
```

### Programmatic API

#### Core Sync Operations
```javascript
import { 
  SyncCommand, 
  SyncService, 
  SyncTriggers 
} from './scripts/modules/flow/index.js';

// Command-based sync
const syncCmd = new SyncCommand(projectRoot);
const result = await syncCmd.execute('auto');

// Service-based sync (with queue management)
const syncService = new SyncService(projectRoot);
await syncService.syncAfterOperation('task_created', { taskId: 5 });

// Quick triggers
await SyncTriggers.afterTaskOperation(projectRoot, 'task_updated', taskData);
await SyncTriggers.manual(projectRoot, 'json-to-db');
```

#### React Hooks (for UI)
```jsx
import { 
  useSyncStatus, 
  useSync, 
  useAutoSync 
} from './scripts/modules/flow/index.js';

function SyncStatusComponent({ projectRoot }) {
  const { status, loading, error } = useSyncStatus(projectRoot);
  const { executeSync, isLoading } = useSync(projectRoot);
  const { triggerAfterTask } = useAutoSync(projectRoot);

  const handleSync = () => executeSync('auto');
  
  return (
    <div>
      <p>Status: {status?.formatted}</p>
      <button onClick={handleSync} disabled={isLoading}>
        Sync Now
      </button>
    </div>
  );
}
```

## 🔄 Sync Directions

| Direction | Description | Use Case |
|-----------|-------------|----------|
| `auto` | Automatically determine based on timestamps | Default, safest option |
| `json-to-db` | Sync from tasks.json to database | After task operations |
| `db-to-json` | Sync from database to tasks.json | After database operations |
| `force-json` | Force JSON as source of truth | Resolve conflicts in favor of JSON |
| `force-db` | Force database as source of truth | Resolve conflicts in favor of DB |

## 🔍 Monitoring & Status

### Health Scores
- **90-100**: Excellent sync health
- **70-89**: Good, minor issues
- **50-69**: Fair, needs attention
- **0-49**: Poor, immediate action needed

### Status Indicators
- 🔄 Both sources available
- 🗄️ Database only
- 📄 JSON only  
- ❌ No sources
- ⚠️ Conflicts detected
- ✅ No conflicts
- 🕐 Sync timing status

### Conflict Types
- `tag_conflict`: Tag metadata differs
- `task_conflict`: Task data differs
- `dependency_conflict`: Dependencies differ
- `detection_error`: Error during conflict detection

## 🔧 Configuration

### Database Config (`scripts/modules/flow/config/database.json`)
```json
{
  "enabled": true,
  "dialect": "sqlite",
  "autoSync": "bidirectional",
  "syncOnCommand": true,
  "conflictResolution": "timestamp",
  "sync": {
    "batchSize": 100,
    "logOperations": true,
    "retryAttempts": 3
  }
}
```

### Service Configuration
```javascript
const syncService = new SyncService(projectRoot, {
  autoSync: true,
  syncDirection: 'auto',
  silentMode: false,
  retryAttempts: 3,
  retryDelay: 1000
});
```

## 🎯 Auto-Sync Triggers

### Automatic Triggers
Auto-sync is triggered after these operations:
- Task created/updated/deleted
- Subtask operations
- Dependency changes
- Tag operations
- Bulk updates
- File imports

### Operation Mapping
```javascript
const operationMappings = {
  'task_created': 'json-to-db',
  'task_updated': 'json-to-db', 
  'task_deleted': 'json-to-db',
  'db_restore': 'db-to-json',
  'conflict_resolved': 'auto'
};
```

### Manual Triggers
```javascript
// After task operations
await SyncTriggers.afterTaskOperation(projectRoot, 'task_created', {
  id: 5,
  tag: 'feature-branch'
});

// After bulk operations  
await SyncTriggers.afterBulkOperation(projectRoot, 'bulk_update', 10);

// Manual sync
await SyncTriggers.manual(projectRoot, 'auto');
```

## 🚦 Middleware & Hooks

### Sync Middleware
```javascript
import { withAutoSync } from './scripts/modules/flow/index.js';

const wrappedFunction = withAutoSync(projectRoot, 'task_created');

const result = await wrappedFunction(async () => {
  // Your operation here
  return { success: true, taskId: 5 };
});
// Auto-sync happens after successful operation
```

### React HOC
```jsx
import { withSyncTrigger } from './scripts/modules/flow/index.js';

const TaskComponent = withSyncTrigger(projectRoot, 'task_updated')(
  ({ handleOperation, ...props }) => {
    const updateTask = async () => {
      await handleOperation(async () => {
        // Your task update logic
        return { success: true };
      });
    };

    return <button onClick={updateTask}>Update Task</button>;
  }
);
```

## 📊 Performance Tracking

```javascript
import { getGlobalPerformanceTracker } from './scripts/modules/flow/index.js';

const tracker = getGlobalPerformanceTracker();

// Metrics are automatically recorded during sync operations
const metrics = tracker.getMetrics();
console.log(`Success rate: ${metrics.successRate}%`);
console.log(`Average duration: ${metrics.averageDuration}ms`);
```

## 🔄 Database Operations

### Direct Database Access
```javascript
import { createDatabase } from './scripts/modules/flow/index.js';

const db = await createDatabase(projectRoot);

// Create a tag
const tag = await db.createTag('my-feature', 'Feature development tasks');

// Create a task
const task = await db.createTask(tag.id, {
  id: 1,
  title: 'New Task',
  status: 'pending'
});

// Query tasks
const tasks = await db.getTasksByTag('my-feature');
```

### Data Transformation
```javascript
import { DataTransformer } from './scripts/modules/flow/index.js';

const transformer = new DataTransformer();

// Convert JSON to SQLite format
const sqliteData = transformer.jsonToSqlite(tasksJsonData);

// Convert back to JSON
const jsonData = transformer.sqliteToJson(tags, tasks, dependencies);

// Validate integrity
const validation = transformer.validateDataIntegrity(jsonData, sqliteData);
```

## 🛠️ Database Management

### Database Commands

#### Local Database Operations
```bash
# Generate migrations
npm run db:generate

# Apply migrations  
npm run db:migrate

# Push schema changes
npm run db:push

# Reset database (delete local .taskmaster/tasks/tasks.db)
npm run db:reset

# Setup database with schema and data sync
npm run db:setup

# Open database studio
npm run db:studio
```

#### Remote Database Operations
```bash
# Generate migrations for remote project
npm run db:generate:remote <project-path>

# Apply migrations to remote project
npm run db:migrate:remote <project-path>

# Push schema changes to remote project
npm run db:push:remote <project-path>

# Reset database with safety warnings and automatic backup
npm run db:reset

# Reset remote project database with safety warnings and backup
npm run db:reset:remote <project-path>

# NUCLEAR: Remove entire .taskmaster directory (EXTREMELY DANGEROUS!)
npm run db:nuke

# NUCLEAR: Remove entire remote .taskmaster directory (EXTREMELY DANGEROUS!)
npm run db:nuke:remote <project-path>

# Setup remote project database with schema and data sync
npm run db:setup:remote <project-path>

# Open database studio for remote project
npm run db:studio:remote <project-path>
```

#### Enhanced Database Safety Features

**Database Reset (`db:reset` / `db:reset:remote`)**:
- **Comprehensive Analysis**: Shows exactly what data will be deleted before proceeding
- **Automatic Backups**: Creates timestamped backups before deletion (unless using nuclear option)
- **Interactive Confirmation**: Requires explicit "yes" confirmation to proceed  
- **Recent Task Preview**: Shows the 5 most recent tasks that will be lost
- **Safety Flags**:
  - `--force` or `-f`: Skip confirmation prompts (use with caution)
  - `--quiet` or `-q`: Suppress detailed output except errors
- **Recovery Information**: Provides clear instructions for recreating the database

**Nuclear Removal (`db:nuke` / `db:nuke:remote`)**:
- **⚠️ MOST DESTRUCTIVE OPTION**: Removes the ENTIRE `.taskmaster` directory
- **What Gets Deleted**:
  - All databases and task data
  - All backups (no recovery possible)
  - All configuration files  
  - All logs and history
  - All tags and metadata
- **Triple Confirmation Required**:
  1. Understand the consequences ("yes")
  2. Type the full directory path
  3. Type "DELETE EVERYTHING" exactly
- **NO BACKUPS CREATED**: This operation creates no backups - data is permanently lost
- **Use Cases**: Factory reset, corrupted installations, complete project restart
- **Safety Features**: Path verification, graceful interruption handling, comprehensive analysis

**Safety Best Practices**:
```bash
# Always run without flags first to see what will be deleted
npm run db:reset

# Create manual backup before dangerous operations  
cp .taskmaster/tasks/tasks.db .taskmaster/backups/manual-backup-$(date +%s).db

# Use quiet mode for scripting
npm run db:reset -- --quiet --force

# Nuclear option requires extreme caution
npm run db:nuke  # Only when you want to completely start over
```

#### Enhanced Logging
All database scripts now include comprehensive logging:
- **Pre/post operation statistics** (table counts, row counts)
- **Schema information** (tables, indexes, views)
- **Change tracking** (what was added/modified)
- **Tag information** (available tags in database)
- **Clear progress indicators** and error handling

### Database Files
- Database: `.taskmaster/tasks/tasks.db`
- Backups: `.taskmaster/backups/`
- Migrations: `scripts/modules/flow/infra/database/migrations/`

## 🐛 Troubleshooting

### Common Issues

1. **"No such table" error**
   ```bash
   npm run db:generate
   rm -f .taskmaster/tasks/tasks.db
   node scripts/modules/flow/infra/database/test-setup.js
   ```

2. **Conflicts not resolving**
   ```bash
   flow sync:force json  # or 'db'
   ```

3. **Auto-sync not working**
   ```javascript
   const syncService = getSyncService(projectRoot);
   syncService.setAutoSync(true);
   ```

4. **Performance issues**
   ```javascript
   // Reduce sync frequency
   syncService.updateConfig({ retryDelay: 5000 });
   ```

### Debug Mode
```javascript
const sync = await setupSync(projectRoot, {
  logLevel: 'debug',
  silentMode: false
});
```

## 📁 File Structure

```
scripts/modules/flow/
├── infra/database/           # Database infrastructure
│   ├── schema.js            # Drizzle schema
│   ├── sqlite-manager.js    # Database operations
│   ├── data-transformer.js  # JSON ↔ SQLite conversion
│   ├── sync-engine.js       # Sync logic
│   └── migrations/          # Auto-generated migrations
├── app/commands/            # CLI commands
│   └── sync-command.js      # Main sync command
├── shared/                  # Shared utilities
│   ├── services/           # Core services
│   ├── hooks/              # React hooks
│   └── utils/              # Utilities
├── config/                 # Configuration
│   └── database.json       # Database settings
└── index.js               # Main exports
```

## 🎯 Best Practices

1. **Always use auto-sync for normal operations**
2. **Use dry-run before force syncing**
3. **Monitor sync health regularly**
4. **Keep backups enabled**
5. **Handle conflicts promptly**
6. **Use appropriate sync directions**
7. **Test sync operations in development**

## 🔮 Future Enhancements

- PostgreSQL/MySQL support via Drizzle
- Real-time sync with WebSockets
- Conflict resolution UI
- Sync scheduling
- Multi-user collaboration
- Sync analytics dashboard 