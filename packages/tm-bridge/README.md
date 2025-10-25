# @tm/bridge

> ⚠️ **TEMPORARY PACKAGE - DELETE WHEN LEGACY CODE IS REMOVED** ⚠️

This package exists solely as a bridge between legacy scripts (`scripts/modules/task-manager/`) and the new tm-core architecture. It provides shared functionality that both CLI and MCP direct functions can use during the migration period.

## Why does this exist?

During the transition from legacy scripts to tm-core, we need a single source of truth for bridge logic that handles:
- API vs file storage detection
- Remote AI service delegation
- Consistent behavior across CLI and MCP interfaces

## When to delete this

Delete this entire package when:
1. ✅ Legacy scripts in `scripts/modules/task-manager/` are removed
2. ✅ MCP direct functions in `mcp-server/src/core/direct-functions/` are removed
3. ✅ All functionality has moved to tm-core
4. ✅ CLI and MCP use tm-core directly via TasksDomain

## Migration path

```text
Current:   CLI → legacy scripts → @tm/bridge → @tm/core
          MCP → direct functions → legacy scripts → @tm/bridge → @tm/core

Future:    CLI → @tm/core (TasksDomain)
          MCP → @tm/core (TasksDomain)

DELETE:    legacy scripts, direct functions, @tm/bridge
```

## Usage

```typescript
import { tryUpdateViaRemote } from '@tm/bridge';

const result = await tryUpdateViaRemote({
  taskId: '1.2',
  prompt: 'Update task...',
  projectRoot: '/path/to/project',
  // ... other params
});
```

## Contents

- `update-bridge.ts` - Shared update bridge logic for task/subtask updates

---

**Remember:** This package should NOT accumulate new features. It's a temporary migration aid only.
