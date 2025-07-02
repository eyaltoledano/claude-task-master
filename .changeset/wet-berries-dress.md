---
"task-master-ai": minor
---

Add Claude Code provider support

Introduces a new provider that enables using Claude models (Opus and Sonnet) through the Claude Code CLI without requiring an API key. 

Key features:
- New claude-code provider with support for opus and sonnet models
- No API key required - uses local Claude Code CLI installation
- Optional dependency - won't affect users who don't need Claude Code
- Lazy loading ensures the provider only loads when requested
- Full integration with existing Task Master commands and workflows
- Comprehensive test coverage for reliability
- New --claude-code flag for the models command

Users can now configure Claude Code models with:
  task-master models --set-main sonnet --claude-code
  task-master models --set-research opus --claude-code

The @anthropic-ai/claude-code package is optional and won't be installed unless explicitly needed.
