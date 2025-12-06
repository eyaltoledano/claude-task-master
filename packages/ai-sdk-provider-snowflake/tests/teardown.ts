/**
 * Jest global teardown file
 * Ensures all async resources are properly cleaned up after tests complete
 *
 * This file is referenced in jest.config.js as globalTeardown
 */

export default async function globalTeardown(): Promise<void> {
	try {
		// Dynamically import the auth module to handle ESM/CJS context
		const authModule = await import('../src/auth/index.js');

		// Clear the authentication cache
		if (typeof authModule.clearAuthCache === 'function') {
			authModule.clearAuthCache();
		}

		// Clear the token cache
		if (authModule.defaultTokenCache?.clear) {
			authModule.defaultTokenCache.clear();
		}
	} catch {
		// Module not available (happens during partial test runs)
		// This is expected - just skip cleanup
	}

	// Force garbage collection hint (Node.js will handle actual GC)
	if (global.gc) {
		global.gc();
	}

	// Small delay to allow any pending async operations to complete
	await new Promise((resolve) => setTimeout(resolve, 100));

	console.log('🧹 Global teardown complete');
}
