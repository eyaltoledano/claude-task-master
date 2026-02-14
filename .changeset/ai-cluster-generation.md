---
"task-master-ai": major
---

AI-powered cluster generation — no empty state, just intelligence

There's no such thing as an empty execution plan. When `tm clusters` detects no inter-tag dependencies, it doesn't error — it offers to build them for you. AI analyzes every tag in parallel, understands what each one does, and synthesizes the dependency graph that connects them into a coherent execution order.

- **Zero-config generation** — run `tm clusters` with no dependencies defined and Taskmaster asks if you'd like AI to figure it out
- **`tm clusters generate`** — explicitly trigger AI-powered dependency analysis across all tags
- **Interactive review** — an in-terminal editor lets you inspect, reorder, and accept or reject the suggested cluster layout before anything is saved
- **`--auto`** — skip the editor and accept AI suggestions directly (ideal for CI or scripted workflows)
- **Analysis caching** — re-runs skip already-analyzed tags, so iterating is fast and cost-efficient
