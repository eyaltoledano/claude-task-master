---
"task-master-ai": patch
---

Add new `scope-up` and `scope-down` commands for dynamic task complexity adjustment

This release introduces two powerful new commands that allow you to dynamically adjust the complexity of your tasks and subtasks without recreating them from scratch.

**New CLI Commands:**
- `task-master scope-up` - Increase task complexity (add more detail, requirements, or implementation steps)
- `task-master scope-down` - Decrease task complexity (simplify, remove unnecessary details, or streamline)

**Key Features:**
- **Multiple tasks**: Support comma-separated IDs to adjust multiple tasks at once (`--id=5,7,12`)
- **Strength levels**: Choose adjustment intensity with `--strength=light|regular|heavy` (defaults to regular)
- **Custom prompts**: Use `--prompt` flag to specify exactly how you want tasks adjusted
- **MCP integration**: Available as `scope_up_task` and `scope_down_task` tools in Cursor and other MCP environments
- **Smart context**: AI considers your project context and task dependencies when making adjustments

**Usage Examples:**
```bash
# Make a task more detailed
task-master scope-up --id=5

# Simplify multiple tasks with light touch
task-master scope-down --id=10,11,12 --strength=light

# Custom adjustment with specific instructions  
task-master scope-up --id=7 --prompt="Add more error handling and edge cases"
```

**Why use this?**
- **Iterative refinement**: Adjust task complexity as your understanding evolves
- **Project phase adaptation**: Scale tasks up for implementation, down for planning
- **Team coordination**: Adjust complexity based on team member experience levels
- **Milestone alignment**: Fine-tune tasks to match project phase requirements

Perfect for agile workflows where task requirements change as you learn more about the problem space.