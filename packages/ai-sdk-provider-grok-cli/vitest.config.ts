import {
	baseVitestConfig,
	defineConfig,
	mergeConfig
} from '@tm/build-config/vitest';

/**
 * Grok CLI provider Vitest configuration
 * Uses base config from @tm/build-config
 * No tests yet, so disable coverage
 */
export default mergeConfig(
	baseVitestConfig,
	defineConfig({
		test: {
			passWithNoTests: true,
			coverage: {
				enabled: false
			}
		}
	})
);
