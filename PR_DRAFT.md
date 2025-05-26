# Add Claude Code CLI Integration for Cost-Effective AI Operations

## Summary

This PR introduces support for Claude Code CLI as an AI provider in Taskmaster, **enabling users with Claude Code subscriptions** (~$17/month) to use all AI-powered features without per-token API costs.

## Motivation

Many developers have Claude Code subscriptions for their IDE integration. This feature allows them to leverage their existing subscription for Taskmaster's AI features instead of paying per-API-call costs, making the tool more accessible for individual developers and small teams.

## Changes

### Core Implementation

- Added new AI provider module `src/ai-providers/claude-code.js` that interfaces with Claude Code CLI
- Integrated the provider into `ai-services-unified.js` service registry
- Updated configuration management to handle Claude Code's authentication model (no API key required)

### Configuration & Setup

- Added Claude Code to `supported-models.json` with zero-cost pricing
- Enhanced interactive setup (`--setup`) to include Claude Code option
- Updated config validation to recognize `claude-code` as a valid provider

### Testing

- Added comprehensive unit tests for the Claude Code provider
- Created integration tests for configuration and service integration
- Manually tested all AI-dependent commands (parse-prd, update-task, expand, etc.)

### Documentation

- Created user documentation in `docs/claude-code-integration.md`
- Added detailed contributor documentation in `docs/contributor-docs/claude-code-integration.md`
- Updated README to list Claude Code as a supported provider

## Technical Details

The implementation uses Node.js `spawn` instead of `exec` for subprocess communication, which:

- Avoids shell escaping issues with complex prompts
- Provides better control over stdin/stdout streams
- Handles large responses more reliably

## Testing Instructions

1. Install Claude Code CLI (requires active subscription)
2. Configure Taskmaster to use Claude Code:
   ```bash
   task-master --setup
   # Select "Claude Code CLI (Subscription)"
   ```
3. Test any AI command:
   ```bash
   task-master parse-prd --file prd.txt
   task-master expand --id=1
   task-master update-task --id=1 --prompt="Add error handling"
   ```

## Breaking Changes

None. This is an additive feature that doesn't affect existing functionality.

## Future Enhancements

- Add support for model selection (opus/sonnet/haiku) via `--model` flag
- Implement true streaming support
- Leverage Claude Code's MCP capabilities for enhanced features

## Checklist

- [x] Code follows project style guidelines
- [x] Tests pass locally
- [x] Documentation updated
- [x] No breaking changes
- [x] Manually tested all affected commands
