---
inclusion: always
---

# Taskmaster Hook-Driven Workflow

## Core Principle: Hooks Automate Task Management

When working with Taskmaster in Kiro, **avoid manually marking tasks as done**. The hook system automatically handles task completion based on:

- **Test Success**: `[TM] Test Success Task Completer` detects passing tests and prompts for task completion
- **Code Changes**: `[TM] Code Change Task Tracker` monitors implementation progress
- **Dependency Chains**: `[TM] Task Dependency Auto-Progression` auto-starts dependent tasks

## AI Assistant Workflow

Follow this pattern when implementing features:

1. **Implement First**: Write code, create tests, make changes
2. **Save Frequently**: Hooks trigger on file saves to track progress automatically
3. **Let Hooks Decide**: Allow hooks to detect completion rather than manually setting status
4. **Respond to Prompts**: Confirm when hooks suggest task completion

## Key Rules for AI Assistants

- **Never use `tm set-status --status=done`** unless hooks fail to detect completion
- **Always write tests** - they provide the most reliable completion signal
- **Save files after implementation** - this triggers progress tracking
- **Trust hook suggestions** - if no completion prompt appears, more work may be needed

## Automatic Behaviors

The hook system provides:

- **Progress Logging**: Implementation details automatically added to task notes
- **Evidence-Based Completion**: Tasks marked done only when criteria are met
- **Dependency Management**: Next tasks auto-started when dependencies complete
- **Natural Flow**: Focus on coding, not task management overhead

## Manual Override Cases

Only manually set task status for:

- Documentation-only tasks
- Tasks without testable outcomes
- Emergency fixes without proper test coverage

Use `tm set-status` sparingly - prefer hook-driven completion.

## Implementation Pattern

```
1. Implement feature → Save file
2. Write tests → Save test file
3. Tests pass → Hook prompts completion
4. Confirm completion → Next task auto-starts
```

This workflow ensures proper task tracking while maintaining development flow.