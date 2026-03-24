/**
 * Linting preset for Taskmaster loop - fix lint and type errors
 */
export const LINTING_PRESET = `# Taskmaster Loop - Linting

Fix lint errors and type errors one by one. ONE fix per session.

## Files Available

- @.taskmaster/loop-progress.txt - Progress log (errors fixed, remaining count)

## Process

1. Run lint command (\`pnpm lint\`, \`npm run lint\`, \`eslint .\`, etc.)
2. Run type check (\`pnpm typecheck\`, \`tsc --noEmit\`, etc.)
3. Pick ONE error to fix - prioritize:
   - Type errors (breaks builds)
   - Security-related lint errors
   - Errors in frequently-changed files
4. Fix the error with minimal changes - don't refactor surrounding code
5. Run lint/typecheck again to verify the fix doesn't introduce new errors
6. Commit with message: \`fix(<file>): <describe the lint/type error fixed>\`
7. Append to progress file: error fixed, remaining error count

## Important

- Complete ONLY ONE fix per session
- Keep changes minimal and focused
- Do NOT start another fix after completing one

## Completion Criteria

- If zero lint errors and zero type errors, output: <loop-complete>ZERO_ERRORS</loop-complete>
`;
