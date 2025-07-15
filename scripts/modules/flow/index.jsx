#!/usr/bin/env node

// Export the run function from the app bootstrap
export { run } from './app/index.jsx';

// Export the useAppContext hook from FlowApp
export { useAppContext } from './FlowApp.jsx';

// If this file is run directly, execute the run function
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		const { run } = await import('./app/index.jsx');
	run().catch((error) => {
		console.error('Error running flow:', error);
		process.exit(1);
	});
	})();
}
