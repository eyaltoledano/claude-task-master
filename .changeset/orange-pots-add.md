---
"task-master-ai": minor
---

Add comprehensive Kiro IDE integration with autonomous task management hooks

- **Kiro Profile**: Added full support for Kiro IDE with automatic installation of 7 Taskmaster agent hooks
- **Hook-Driven Workflow**: Introduced natural language automation hooks that eliminate manual task status updates
- **Automatic Hook Installation**: Hooks are now automatically copied to `.kiro/hooks/` when running `task-master rules add kiro`
- **Language-Agnostic Support**: All hooks support multiple programming languages (JS, Python, Go, Rust, Java, etc.)
- **Frontmatter Transformation**: Kiro rules use simplified `inclusion: always` format instead of Cursor's complex frontmatter
- **Special Rule**: Added `taskmaster_hooks_workflow.md` that guides AI assistants to prefer hook-driven completion

Key hooks included:

- Task Dependency Auto-Progression: Automatically starts tasks when dependencies complete
- Code Change Task Tracker: Updates task progress as you save files
- Test Success Task Completer: Marks tasks done when tests pass
- Daily Standup Assistant: Provides personalized task status summaries
- PR Readiness Checker: Validates task completion before creating pull requests
- Complexity Analyzer: Auto-expands complex tasks into manageable subtasks
- Git Commit Task Linker: Links commits to tasks for better traceability

This creates a truly autonomous development workflow where task management happens naturally as you code!
