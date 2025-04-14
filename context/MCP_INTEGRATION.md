# Task Master MCP Integration

This document outlines how Task Master CLI functionality is integrated with MCP (Master Control Program) architecture to provide both CLI and programmatic API access to features.

## Architecture Overview

The MCP integration uses a layered approach:

1. **Core Functions** - In `scripts/modules/` contain the main business logic
2. **Source Parameter** - Core functions check the `source` parameter to determine behavior
3. **Task Master Core** - In `mcp-server/src/core/task-master-core.js` provides direct function imports
4. **MCP Tools** - In `mcp-server/src/tools/` register the functions with the MCP server

```
┌─────────────────┐         ┌─────────────────┐
│    CLI User     │         │    MCP User     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         ▼                           ▼
┌────────────────┐         ┌────────────────────┐
│  commands.js   │         │   MCP Tool API     │
└────────┬───────┘         └──────────┬─────────┘
         │                            │
         │                            │
         ▼                            ▼
┌───────────────────────────────────────────────┐
│                                               │
│     Core Modules (task-manager.js, etc.)      │
│                                               │
└───────────────────────────────────────────────┘
```

## Core Function Pattern

Core functions should follow this pattern to support both CLI and MCP use:

```javascript
/**
 * Example function with source parameter support
 * @param {Object} options - Additional options including source
 * @returns {Object|undefined} - Returns data when source is 'mcp'
 */
function exampleFunction(param1, param2, options = {}) {
	try {
		// Skip UI for MCP
		if (options.source !== 'mcp') {
			displayBanner();
			console.log(chalk.blue('Processing operation...'));
		}

		// Do the core business logic
		const result = doSomething(param1, param2);

		// For MCP, return structured data
		if (options.source === 'mcp') {
			return {
				success: true,
				data: result
			};
		}

		// For CLI, display output
		console.log(chalk.green('Operation completed successfully!'));
	} catch (error) {
		// Handle errors based on source
		if (options.source === 'mcp') {
			return {
				success: false,
				error: error.message
			};
		}

		// CLI error handling
		console.error(chalk.red(`Error: ${error.message}`));
		process.exit(1);
	}
}
```

## Source-Adapter Utilities

For convenience, you can use the source adapter helpers in `scripts/modules/source-adapter.js`:

```javascript
import { adaptForMcp, sourceSplitFunction } from './source-adapter.js';

// Simple adaptation - just adds source parameter support
export const simpleFunction = adaptForMcp(originalFunction);

// Split implementation - completely different code paths for CLI vs MCP
export const complexFunction = sourceSplitFunction(
	// CLI version with UI
	function (param1, param2) {
		displayBanner();
		console.log(`Processing ${param1}...`);
		// ... CLI implementation
	},
	// MCP version with structured return
	function (param1, param2, options = {}) {
		// ... MCP implementation
		return { success: true, data };
	}
);
```

## Adding New Features

When adding new features, follow these steps to ensure CLI and MCP compatibility:

1. **Implement Core Logic** in the appropriate module file
2. **Add Source Parameter Support** using the pattern above
3. **Add to task-master-core.js** to make it available for direct import
4. **Update Command Map** in `mcp-server/src/tools/utils.js`
5. **Create Tool Implementation** in `mcp-server/src/tools/`
6. **Register the Tool** in `mcp-server/src/tools/index.js`

### Core Function Implementation

```javascript
// In scripts/modules/task-manager.js
export async function newFeature(param1, param2, options = {}) {
	try {
		// Source-specific UI
		if (options.source !== 'mcp') {
			displayBanner();
			console.log(chalk.blue('Running new feature...'));
		}

		// Shared core logic
		const result = processFeature(param1, param2);

		// Source-specific return handling
		if (options.source === 'mcp') {
			return {
				success: true,
				data: result
			};
		}

		// CLI output
		console.log(chalk.green('Feature completed successfully!'));
		displayOutput(result);
	} catch (error) {
		// Error handling based on source
		if (options.source === 'mcp') {
			return {
				success: false,
				error: error.message
			};
		}

		console.error(chalk.red(`Error: ${error.message}`));
		process.exit(1);
	}
}
```

### Task Master Core Update

```javascript
// In mcp-server/src/core/task-master-core.js
import { newFeature } from '../../../scripts/modules/task-manager.js';

// Add to exports
export default {
	// ... existing functions

	async newFeature(args = {}, options = {}) {
		const { param1, param2 } = args;
		return executeFunction(newFeature, [param1, param2], options);
	}
};
```

### Command Map Update

```javascript
// In mcp-server/src/tools/utils.js
const commandMap = {
	// ... existing mappings
	'new-feature': 'newFeature'
};
```

### Tool Implementation

```javascript
// In mcp-server/src/tools/newFeature.js
import { z } from 'zod';
import {
	executeTaskMasterCommand,
	createContentResponse,
	createErrorResponse
} from './utils.js';

export function registerNewFeatureTool(server) {
	server.addTool({
		name: 'newFeature',
		description: 'Run the new feature',
		parameters: z.object({
			param1: z.string().describe('First parameter'),
			param2: z.number().optional().describe('Second parameter'),
			file: z.string().optional().describe('Path to the tasks file'),
			projectRoot: z.string().describe('Root directory of the project')
		}),
		execute: async (args, { log }) => {
			try {
				log.info(`Running new feature with args: ${JSON.stringify(args)}`);

				const cmdArgs = [];
				if (args.param1) cmdArgs.push(`--param1=${args.param1}`);
				if (args.param2) cmdArgs.push(`--param2=${args.param2}`);
				if (args.file) cmdArgs.push(`--file=${args.file}`);

				const projectRoot = args.projectRoot;

				// Execute the command
				const result = await executeTaskMasterCommand(
					'new-feature',
					log,
					cmdArgs,
					projectRoot
				);

				if (!result.success) {
					throw new Error(result.error);
				}

				return createContentResponse(result.stdout);
			} catch (error) {
				log.error(`Error in new feature: ${error.message}`);
				return createErrorResponse(`Error in new feature: ${error.message}`);
			}
		}
	});
}
```

### Tool Registration

```javascript
// In mcp-server/src/tools/index.js
import { registerNewFeatureTool } from './newFeature.js';

export function registerTaskMasterTools(server) {
	// ... existing registrations
	registerNewFeatureTool(server);
}
```

## Testing

Always test your MCP-compatible features with both CLI and MCP interfaces:

```javascript
// Test CLI usage
node scripts/dev.js new-feature --param1=test --param2=123

// Test MCP usage
node mcp-server/tests/test-command.js newFeature
```

## Best Practices

1. **Keep Core Logic DRY** - Share as much logic as possible between CLI and MCP
2. **Structured Data for MCP** - Return clean JSON objects from MCP source functions
3. **Consistent Error Handling** - Standardize error formats for both interfaces
4. **Documentation** - Update MCP tool documentation when adding new features
5. **Testing** - Test both CLI and MCP interfaces for any new or modified feature
