---
"task-master-ai": minor
---

Add autonomous TDD workflow automation system with new `tm autopilot` commands and MCP tools for AI-driven test-driven development.

**New CLI Commands:**

- `tm autopilot start <taskId>` - Initialize TDD workflow
- `tm autopilot next` - Get next action in workflow
- `tm autopilot status` - Check workflow progress
- `tm autopilot complete` - Advance phase with test results
- `tm autopilot commit` - Save progress with metadata
- `tm autopilot resume` - Continue from checkpoint
- `tm autopilot abort` - Cancel workflow

**New MCP Tools:**
Seven new autopilot tools for programmatic control: `autopilot_start`, `autopilot_next`, `autopilot_status`, `autopilot_complete_phase`, `autopilot_commit`, `autopilot_resume`, `autopilot_abort`

**Features:**

- Complete RED → GREEN → COMMIT cycle enforcement
- Intelligent commit message generation with metadata
- Activity logging and state persistence
- Configurable workflow settings via `.taskmaster/config.json`
- Comprehensive AI agent integration documentation

**Documentation:**

- AI Agent Integration Guide (2,800+ lines)
- TDD Quick Start Guide
- Example prompts and integration patterns

> **Learn more:** [TDD Workflow Quickstart Guide](https://dev.task-master.dev/tdd-workflow/quickstart)

This release enables AI agents to autonomously execute test-driven development workflows with full state management and recovery capabilities.
