Automatically fix dependency issues found during validation.

## Automatic Dependency Repair

Intelligently fixes common dependency problems while preserving project logic.

## Execution

```bash
task-master fix-dependencies
```

## What Gets Fixed

### 1. **Auto-Fixable Issues**
- Remove references to deleted tasks
- Break simple circular dependencies
- Remove self-dependencies
- Clean up duplicate dependencies

### 2. **Smart Resolutions**
- Reorder dependencies to maintain logic
- Suggest task merging for over-dependent tasks
- Flatten unnecessary dependency chains
- Remove redundant transitive dependencies

### 3. **Manual Review Required**
- Complex circular dependencies
- Critical path modifications
- Business logic dependencies
- High-impact changes

## Fix Process

1. **Analysis Phase**
   - Run validation check
   - Categorize issues by type
   - Determine fix strategy

2. **Execution Phase**
   - Apply automatic fixes
   - Log all changes made
   - Preserve task relationships

3. **Verification Phase**
   - Re-validate after fixes
   - Show before/after comparison
   - Highlight manual fixes needed

## Smart Features

- Preserves intended task flow
- Minimal disruption approach
- Creates fix history/log
- Suggests manual interventions

## Output Example

```
Dependency Auto-Fix Report
━━━━━━━━━━━━━━━━━━━━━━━━
Fixed Automatically:
✅ Removed 2 references to deleted tasks
✅ Resolved 1 self-dependency
✅ Cleaned 3 redundant dependencies

Manual Review Needed:
⚠️ Complex circular dependency: #12 → #15 → #18 → #12
  Suggestion: Make #15 not depend on #12
⚠️ Task #45 has 8 dependencies
  Suggestion: Break into subtasks

Run '/project:tm/validate-dependencies' to verify fixes
```

## Safety

- Preview mode available
- Rollback capability
- Change logging
- No data loss