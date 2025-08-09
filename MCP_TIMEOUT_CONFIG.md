# MCP Timeout Configuration for Roo Code Profile

This document describes the MCP (Model Context Protocol) timeout configuration added to the Roo Code profile in Task Master AI.

## Problem Solved

Long-running MCP operations like `parse_prd`, `expand_task`, and `research` were timing out after the default 60 seconds, causing failures for AI-powered operations that can take several minutes to complete.

## Solution

Added a pre-configured MCP configuration file with extended timeout settings that gets automatically installed when using the Roo Code profile.

## Configuration Details

The MCP configuration includes:

- **Timeout**: 300 seconds (5 minutes) for long-running AI operations
- **Complete tool allowlist**: All taskmaster-ai tools are pre-configured
- **Environment setup**: AWS region configuration included

## Files Modified

1. **`assets/roocode/.roo/mcp.json`** - New MCP configuration file with timeout settings
2. **`src/profiles/roo.js`** - Updated to copy and manage MCP configuration

## Installation

When the Roo Code profile is added to a project:

1. The MCP configuration is automatically copied to `.roo/mcp.json`
2. All taskmaster-ai tools are pre-configured with appropriate permissions
3. Timeout is set to 300 seconds to handle long-running operations

## Removal

When the Roo Code profile is removed:

1. The MCP configuration file is automatically cleaned up
2. No manual intervention required

## Benefits

- ✅ Long-running operations complete successfully without timeout
- ✅ No manual MCP configuration required
- ✅ Consistent timeout settings across projects
- ✅ Automatic cleanup when profile is removed

## Technical Details

- **Timeout value**: 300 seconds (within MCP's valid range of 1-3600 seconds)
- **Timeout units**: Seconds (not milliseconds)
- **Default fallback**: 60 seconds if not specified
- **Internal conversion**: MCP client converts to milliseconds internally

## Testing

The configuration has been tested with:

- Quick operations (< 1 second): `get_tasks`, `set_task_status`
- Long-running operations (~1 minute): `research`, `parse_prd`
- All operations complete successfully without timeout errors

## Compatibility

- Compatible with Roo Code MCP timeout feature (commit 57518e1)
- Follows MCP specification for timeout configuration
- Backward compatible with existing projects