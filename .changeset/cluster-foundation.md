---
"task-master-ai": minor
---

Introduce Execution Phases — manage what gets built and in what order

Taskmaster now understands your project's execution topology. Instead of a flat task list, your tags are automatically organized into **execution phases** — groups of work that can run in parallel, sequenced by their dependencies.

This is the foundation for Taskmaster 1.0's autonomous execution: think at the tag level, not the task level.

New capabilities:

- **`task-master clusters`** — visualize your execution plan as phases, with parallel lanes showing what runs concurrently
- **`task-master clusters --tag <tag>`** — drill into any tag to see task-level execution order within it
- **Execution Pipeline in `task-master list`** — see per-cluster progress at a glance with lane-based visualization
- **Inter-tag dependencies** — tags can now depend on other tags, with automatic circular dependency detection
- **Mermaid diagram export** (`--diagram mermaid`) — share your execution plan as a visual dependency graph
