---
"task-master-ai": minor
---

Add simpler positional syntax and Hamster-aware UI improvements

- **Simpler command syntax**: Use positional arguments without flags
  - `tm update-task 1 Added implementation` (no quotes needed for multi-word prompts)
  - `tm set-status 1 done` or `tm set-status 1,1.1,2 in-progress`
  - `tm list done` or `tm list in-progress`
- **Hamster-aware help**: Context-specific command list when connected to Hamster
  - Shows only relevant commands for Hamster workflow
  - Beautiful boxed section headers
  - Clear usage examples
- **Improved context display**: Show 'Brief: [name]' instead of 'tag: [name]' when connected to Hamster
- **Cleaner Hamster updates**: Simplified update display (removed redundant Mode/Prompt info)
- **Auto-detection**: Automatically detects Hamster connection for better UX
- **Backward compatible**: All old flag syntax still works (`--id`, `--status`, etc.)
