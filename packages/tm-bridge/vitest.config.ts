import {
	baseVitestConfig,
	defineConfig,
	mergeConfig
} from '@tm/build-config/vitest';

/**
 * Bridge package Vitest configuration
 * Uses base config from @tm/build-config
 * Passes with no tests since this is a temporary migration bridge
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
