---
"task-master-ai": minor
---

Fix: Prevent CLAUDE.md overwrite by using Claude Code's import feature

- Task Master now creates its instructions in `.taskmaster/CLAUDE.md` instead of overwriting the user's `CLAUDE.md`
- Adds an import section to the user's CLAUDE.md that references the Task Master instructions
- Preserves existing user content in CLAUDE.md files
- Removed duplicate profile initialization that was causing files to be written twice

**Breaking Change**: Task Master instructions for Claude Code are now stored in `.taskmaster/CLAUDE.md` and imported into the main CLAUDE.md file. Users who previously had Task Master content directly in their CLAUDE.md will need to run `task-master rules remove claude` followed by `task-master rules add claude` to migrate to the new structure.