---
"task-master-ai": minor
---

Add simpler positional syntax and Hamster-aware UI improvements

- **Simpler command syntax**: Use positional arguments without flags
  - `tm update-task 1 Added implementation` (no quotes needed for multi-word prompts)
  - `tm status 1 done` (new alias for set-status) or `tm set-status 1,1.1,2 in-progress`
  - `tm list done` or `tm list in-progress` or `tm list all` (shortcut for --with-subtasks)
- **Hamster-aware help**: Context-specific command list when connected to Hamster
  - Shows only relevant commands for Hamster workflow
  - Beautiful boxed section headers with improved spacing
  - Clear usage examples with new positional syntax
  - Better visual alignment and cleaner formatting
- **Progress indicators**: Added loading spinner to `update-task` when connected to Hamster
  - Shows "Updating task X on Hamster..." during AI processing
  - Cleaner, more responsive UX for long-running operations
- **Improved context display**: Show 'Brief: [name]' instead of 'tag: [name]' when connected to Hamster
- **Cleaner Hamster updates**: Simplified update display (removed redundant Mode/Prompt info)
- **Smart messaging**: "NO TASKS AVAILABLE" warning only shows when literally no tasks exist
  - Removed misleading messages when tasks are just completed/in-progress/blocked
  - Better UX for filtered task lists
- **Updated help everywhere**: Regular help menu now shows new positional argument syntax
  - All suggested actions updated across commands
  - Consistent syntax in all UI components
- **Auto-detection**: Automatically detects Hamster connection for better UX
- **Backward compatible**: All old flag syntax still works (`--id`, `--status`, etc.)
