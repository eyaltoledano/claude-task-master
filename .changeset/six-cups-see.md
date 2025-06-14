---
"task-master-ai": minor
---

Introduces Tagged Lists: AI Multi-Context Task Management System

This major feature release introduces Tagged Lists, a comprehensive system that transforms Taskmaster into a multi-context task management powerhouse. You can now organize tasks into completely isolated contexts, enabling parallel (agentic) development workflows, team collaboration, and project experimentation without conflicts.

**🏷️ Tagged Task Lists Architecture:**

The new tagged system fundamentally improves how tasks are organized:
- **Legacy Format**: `{ "tasks": [...] }` 
- **New Tagged Format**: `{ "master": { "tasks": [...], "metadata": {...} }, "feature-xyz": { "tasks": [...], "metadata": {...} } }`
- **Automatic Migration**: Existing projects will seamlessly migrate to tagged format with zero user intervention
- **State Management**: New `.taskmaster/state.json` tracks current tag, last switched time, migration status and more.
- **Configuration Integration**: Enhanced `.taskmaster/config.json` with tag-specific settings and defaults.

By default, your existing task list will be migrated to the `master` tag.

**🚀 Complete Tag Management Suite:**

**Core Tag Commands:**
- `task-master tags [--show-metadata]` - List all tags with task counts, completion stats, and metadata
- `task-master add-tag <name> [options]` - Create new tag contexts with optional task copying
- `task-master delete-tag <name> [--yes]` - Delete tags (and attached tasks) with double confirmation protection
- `task-master use-tag <name>` - Switch contexts and immediately see next available task
- `task-master rename-tag <old> <new>` - Rename tags with automatic current tag reference updates
- `task-master copy-tag <source> <target> [options]` - Duplicate tag contexts for experimentation

**🤖 Full MCP Integration for Tag Management:**

Task Master's multi-context capabilities are now fully exposed through the MCP server, enabling powerful agentic workflows:
- **`list_tags`**: List all available tag contexts.
- **`add_tag`**: Programmatically create new tags.
- **`delete_tag`**: Remove tag contexts.
- **`use_tag`**: Switch the agent's active task context.
- **`rename_tag`**: Rename existing tags.
- **`copy_tag`**: Duplicate entire task contexts for experimentation.

**Tag Creation Options:**
- `--copy-from-current` - Copy tasks from currently active tag
- `--copy-from=<tag>` - Copy tasks from specific tag
- `--from-branch` - Creates a new tag using the active git branch name (for `add-tag` only)
- `--description="<text>"` - Add custom tag descriptions
- Empty tag creation for fresh contexts

**🎯 Universal --tag Flag Support:**

Every task operation now supports tag-specific execution:
- `task-master list --tag=feature-branch` - View tasks in specific context
- `task-master add-task --tag=experiment --prompt="..."` - Create tasks in specific tag
- `task-master parse-prd document.txt --tag=v2-redesign` - Parse PRDs into dedicated contexts
- `task-master analyze-complexity --tag=performance-work` - Generate tag-specific reports
- `task-master set-status --tag=hotfix --id=5 --status=done` - Update tasks in specific contexts
- `task-master expand --tag=research --id=3` - Break down tasks within tag contexts

This way you or your agent can store out of context tasks into the appropriate tags for later, allowing you to maintain a groomed and scoped master list. Focus on value, not chores.

**📊 Enhanced Workflow Features:**

**Smart Context Switching:**
- `use-tag` command shows immediate next task after switching
- Automatic tag creation when targeting non-existent tags
- Current tag persistence across terminal sessions
- Branch-tag mapping for future Git integration

**Intelligent File Management:**
- Tag-specific complexity reports: `task-complexity-report_tagname.json`
- Master tag uses default filenames: `task-complexity-report.json`
- Automatic file isolation prevents cross-tag contamination

**Advanced Confirmation Logic:**
- Commands only prompt when target tag has existing tasks
- Empty tags allow immediate operations without confirmation
- Smart append vs overwrite detection

**🔄 Seamless Migration & Compatibility:**

**Zero-Disruption Migration:**
- Existing `tasks.json` files automatically migrate on first command
- Master tag receives proper metadata (creation date, description)
- Migration notice shown once with helpful explanation
- All existing commands work identically to before

**State Management:**
- `.taskmaster/state.json` tracks current tag and migration status
- Automatic state creation and maintenance
- Branch-tag mapping foundation for Git integration
- Migration notice tracking to avoid repeated notifications
- Grounds for future context additions

**Backward Compatibility:**
- All existing workflows continue unchanged
- Legacy commands work exactly as before
- Gradual adoption - users can ignore tags entirely if desired
- No breaking changes to existing tasks or file formats

**💡 Real-World Use Cases:**

**Team Collaboration:**
- `task-master add-tag alice --copy-from-current` - Create teammate-specific contexts
- `task-master add-tag bob --copy-from=master` - Onboard new team members
- `task-master use-tag alice` - Switch to teammate's work context

**Feature Development:**
- `task-master parse-prd feature-spec.txt --tag=user-auth` - Dedicated feature planning
- `task-master add-tag experiment --copy-from=user-auth` - Safe experimentation
- `task-master analyze-complexity --tag=user-auth` - Feature-specific analysis

**Release Management:**
- `task-master add-tag v2.0 --description="Next major release"` - Version-specific planning
- `task-master copy-tag master v2.1` - Release branch preparation
- `task-master use-tag hotfix` - Emergency fix context

**Project Phases:**
- `task-master add-tag research --description="Discovery phase"` - Research tasks
- `task-master add-tag implementation --copy-from=research` - Development phase
- `task-master add-tag testing --copy-from=implementation` - QA phase

**🛠️ Technical Implementation:**

**Data Structure:**
- Tagged format with complete isolation between contexts
- Rich metadata per tag (creation date, description, update tracking)
- Automatic metadata enhancement for existing tags
- Clean separation of tag data and internal state

**Performance Optimizations:**
- Dynamic task counting without stored counters
- Efficient tag resolution and caching
- Minimal file I/O with smart data loading
- Responsive table layouts adapting to terminal width

**Error Handling:**
- Comprehensive validation for tag names (alphanumeric, hyphens, underscores)
- Reserved name protection (master, main, default)
- Graceful handling of missing tags and corrupted data
- Detailed error messages with suggested corrections

This release establishes the foundation for advanced multi-context workflows while maintaining the simplicity and power that makes Task Master effective for individual developers.
