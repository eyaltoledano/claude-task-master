# Phase 0: Spike - Autonomous TDD Workflow ✅ COMPLETE

## Objective
Validate feasibility and build foundational understanding before full implementation.

## Status
**COMPLETED** - All deliverables implemented and validated.

See `apps/cli/src/commands/autopilot.command.ts` for implementation.

## Scope
- Implement CLI skeleton `tm autopilot` with dry-run mode
- Show planned steps from a real task with subtasks
- Detect test runner from package.json
- Detect git state and render preflight report

## Deliverables

### 1. CLI Command Skeleton
- Create `apps/cli/src/commands/autopilot.command.ts`
- Support `tm autopilot <taskId>` command
- Implement `--dry-run` flag
- Basic help text and usage information

### 2. Preflight Detection System
- Detect test runner from package.json (npm test, pnpm test, etc.)
- Check git working tree state (clean/dirty)
- Validate required tools are available (git, gh, node/npm)
- Detect default branch

### 3. Dry-Run Execution Plan Display
Display planned execution for a task including:
- Preflight checks status
- Branch name that would be created
- Tag that would be set
- List of subtasks in execution order
- For each subtask:
  - RED phase: test file that would be created
  - GREEN phase: implementation files that would be modified
  - COMMIT: commit message that would be used
- Finalization steps: test suite run, coverage check, push, PR creation

### 4. Task Loading & Validation
- Load task from TaskMaster state
- Validate task exists and has subtasks
- If no subtasks, show message about needing to expand first
- Show dependency order for subtasks

## Example Output

```bash
$ tm autopilot 42 --dry-run

Autopilot Plan for Task #42 [analytics]: User metrics tracking
─────────────────────────────────────────────────────────────

Preflight Checks:
  ✓ Working tree is clean
  ✓ Test command detected: npm test
  ✓ Tools available: git, gh, node, npm
  ✓ Current branch: main (will create new branch)
  ✓ Task has 3 subtasks ready to execute

Branch & Tag:
  → Will create branch: analytics/task-42-user-metrics
  → Will set active tag: analytics

Execution Plan (3 subtasks):

  1. Subtask 42.1: Add metrics schema
     RED:    Generate tests → src/__tests__/schema.test.js
     GREEN:  Implement code → src/schema.js
     COMMIT: "feat(metrics): add metrics schema (task 42.1)"

  2. Subtask 42.2: Add collection endpoint [depends on 42.1]
     RED:    Generate tests → src/api/__tests__/metrics.test.js
     GREEN:  Implement code → src/api/metrics.js
     COMMIT: "feat(metrics): add collection endpoint (task 42.2)"

  3. Subtask 42.3: Add dashboard widget [depends on 42.2]
     RED:    Generate tests → src/components/__tests__/MetricsWidget.test.jsx
     GREEN:  Implement code → src/components/MetricsWidget.jsx
     COMMIT: "feat(metrics): add dashboard widget (task 42.3)"

Finalization:
  → Run full test suite with coverage (threshold: 80%)
  → Push branch to origin (will confirm)
  → Create PR targeting main

Estimated commits: 3
Estimated duration: ~20-30 minutes (depends on implementation complexity)

Run without --dry-run to execute.
```

## Success Criteria
- Dry-run output is clear and matches expected workflow
- Preflight detection works correctly on the project repo
- Task loading integrates with existing TaskMaster state
- No actual git operations or file modifications occur in dry-run mode

## Out of Scope
- Actual test generation
- Actual code implementation
- Git operations (branch creation, commits, push)
- PR creation
- Test execution

## Implementation Notes
- Reuse existing `TaskService` from `packages/tm-core`
- Use existing git utilities from `scripts/modules/utils/git-utils.js`
- Load task/subtask data from `.taskmaster/tasks/tasks.json`
- Detect test command via package.json → scripts.test field

## Dependencies
- Existing TaskMaster CLI structure
- Existing task storage format
- Git utilities

## Estimated Effort
2-3 days

## Validation
Test dry-run mode with:
- Task with 1 subtask
- Task with multiple subtasks
- Task with dependencies between subtasks
- Task without subtasks (should show warning)
- Dirty git working tree (should warn)
- Missing tools (should error with helpful message)
