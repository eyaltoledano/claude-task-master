---
"task-master-ai": minor
---

Redesign `tm init` with clearer workflow selection and reduced noise

Choose how you want to plan: Solo with Taskmaster or Together with Hamster. The new init flow guides you through setup with context-appropriate options and cleaner output.

**New Workflow Selection**
- Clear framing: "You need a plan before you execute. How do you want to build it?"
- **Solo (Taskmaster)**: Parse PRD → structured tasks → AI agent executes with control
- **Together (Hamster)**: Team writes brief → Hamster refines → aligned execution with Taskmaster

**Cleaner Experience**
- Optional AI IDE rules setup (Y/n prompt instead of always showing)
- 15+ log messages moved to debug level - much less noise
- Skip Git prompts when using Hamster (not needed for cloud storage)
- Skip AI model configuration for Hamster (uses Hamster's AI)

**Hamster Integration**
- OAuth login flow when choosing Hamster workflow
- Context-aware guidance based on your workflow choice

**Quality of Life**
- Run `tm rules --setup` anytime if you declined during init
- Use `--yes` flag for fully non-interactive setup
- Use `--rules cursor,windsurf` to specify rules upfront
