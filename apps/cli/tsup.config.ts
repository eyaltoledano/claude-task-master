import { defineConfig } from 'tsup';
import { baseConfig, mergeConfig } from '@tm/build-config';

export default defineConfig(
	mergeConfig(baseConfig, {
		entry: ['src/index.ts']
	})
);
