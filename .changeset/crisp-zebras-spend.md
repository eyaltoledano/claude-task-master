---
"task-master-ai": minor
---

Add Hamster integration for `parse-prd` command

Your tasks are only as good as the context behind them. Now when you run `parse-prd`, you can choose to bring your PRD to Hamster instead of parsing locally.

**New Workflow Choice**
- **Parse locally**: PRD becomes a task list in a local JSON file - great for quick prototyping and vibing solo
- **Bring it to Hamster**: PRD becomes a living brief connected to your team, codebase, and agents

**Why Hamster?**
- Tasks live in a central place with real-time sync across your team
- Collaborate on your PRD/brief together, generate tasks on Hamster, bring them into Taskmaster
- No API keys needed - Hamster handles all AI inference, just need a Hamster account

**Hamster Integration**
- OAuth login flow when choosing Hamster (same as export command)
- Create brief directly from PRD content with auto-generated title/description
- Progress bar showing task generation phases (analyzing → generating → processing)
- Invite teammates during brief creation
- Auto-set context to new brief when complete

**Quality of Life**
- Clickable brief URL and team invite URL in terminal
- Shows task count as they're generated
- Graceful fallback if generation takes longer than expected
