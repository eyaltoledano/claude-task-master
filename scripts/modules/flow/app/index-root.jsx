#!/usr/bin/env node

// Export the run function from the app bootstrap
export { run } from './index.jsx';

// Export the useAppContext hook from FlowApp
export { useAppContext } from './FlowApp.jsx';

// If this file is run directly, execute the run function
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		const { run } = await import('./index.jsx');
		
		// Build options from environment variables when run directly
		const options = {};
		if (process.env.TASKMASTER_PROJECT_ROOT) {
			options.projectRoot = process.env.TASKMASTER_PROJECT_ROOT;
		}
		if (process.env.TASKMASTER_BACKEND) {
			options.backend = process.env.TASKMASTER_BACKEND;
		}
		if (process.env.TASKMASTER_MCP_SERVER_ID) {
			options.mcpServerId = process.env.TASKMASTER_MCP_SERVER_ID;
		}
		
		run(options).catch((error) => {
			console.error('Error running flow:', error);
			process.exit(1);
		});
	})();
}
