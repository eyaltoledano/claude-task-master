# Bug Report: add-tag --from-branch fails with 'projectRoot is not defined' error

## Bug Description

The `task-master add-tag --from-branch` command fails with the error:
```
Error creating tag: projectRoot is not defined
```

## Root Cause

The issue is in `scripts/modules/commands.js` around lines 4730, 4738, and 4775. The code correctly creates a `context` object with `projectRoot`, but then incorrectly references `projectRoot` directly instead of `context.projectRoot`.

### Current (Broken) Code:
```javascript
const context = {
    projectRoot: taskMaster.getProjectRoot(),
    commandName: 'add-tag',
    outputType: 'cli'
};

// ❌ ERROR: projectRoot is not defined in this scope
if (!(await gitUtils.isGitRepository(projectRoot))) {
    // ...
}
const currentBranch = await gitUtils.getCurrentBranch(projectRoot);
// ...
await (await import('./utils/git-utils.js')).getCurrentBranch(projectRoot)
```

### Expected (Fixed) Code:
```javascript
// ✅ CORRECT: Use context.projectRoot
if (!(await gitUtils.isGitRepository(context.projectRoot))) {
    // ...
}
const currentBranch = await gitUtils.getCurrentBranch(context.projectRoot);
// ...
await (await import('./utils/git-utils.js')).getCurrentBranch(context.projectRoot)
```

## Steps to Reproduce

1. Run `task-master add-tag --from-branch`
2. Observe the error: `Error creating tag: projectRoot is not defined`

## Expected Behavior

The command should create a new tag based on the current git branch name.

## Additional Notes

- The MCP implementation works correctly (uses `projectRoot` from args)
- The CLI implementation has this variable scope bug
- This feature was recently added in commit `be0bf18` (June 13, 2025)
- The bug was introduced during CLI implementation

## Timeline

- **June 13, 18:56**: `be0bf18` - Feature was added with the `--from-branch` option
- **June 13, 19:48**: `d3edd24` - Fixed the tagName argument requirement issue
- **Current**: The projectRoot scope bug was introduced during the CLI implementation

## Files Affected

- `scripts/modules/commands.js` (lines ~4730, ~4738, ~4775)

## Fix Required

Change 3 lines in `scripts/modules/commands.js` to use `context.projectRoot` instead of `projectRoot`.
