---
"task-master-ai": minor
---

Add automatic cluster detection and visualization for dependency-aware parallel execution

Tasks within tags are now automatically grouped into execution clusters via topological sort on their dependency graph. Clusters identify which tasks can run in parallel and which must run sequentially, giving users clear visibility into execution order.

New features:

- `task-master clusters` command to view tag-level and task-level execution clusters
- Mermaid diagram output (`--diagram mermaid` / `--diagram mermaid-raw`) for cluster visualization
- Inter-tag dependency tracking with circular dependency detection
- Execution Pipeline box in `task-master list` showing per-cluster progress with lane-based visualization
- Progress tracking and orchestration services for cluster-based execution
