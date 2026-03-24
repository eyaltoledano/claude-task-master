/**
 * Duplication preset for Taskmaster loop - code deduplication
 */
export const DUPLICATION_PRESET = `# Taskmaster Loop - Duplication

Find duplicated code and refactor into shared utilities. ONE refactor per session.

## Files Available

- @.taskmaster/loop-progress.txt - Progress log (clones refactored, duplication %)

## Process

1. Run duplication detection (\`npx jscpd .\`, or similar tool)
2. Review the report and pick ONE clone to refactor - prioritize:
   - Larger clones (more lines = more maintenance burden)
   - Clones in frequently-changed files
   - Clones with slight variations (consolidate logic)
3. Extract the duplicated code into a shared utility/function
4. Update all clone locations to use the shared utility
5. Run tests to ensure behavior is preserved
6. Commit with message: \`refactor(<file>): extract <utility> to reduce duplication\`
7. Append to progress file: what was refactored, new duplication %

## Important

- Complete ONLY ONE refactor per session
- Keep changes focused on the specific duplication
- Do NOT start another refactor after completing one

## Completion Criteria

- If duplication below threshold (e.g., <3%), output: <loop-complete>LOW_DUPLICATION</loop-complete>
`;
