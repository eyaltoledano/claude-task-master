import { defineConfig } from 'tsup';
import { baseConfig, mergeConfig } from './src/tsup.base.js';

export default defineConfig(
	mergeConfig(baseConfig, {
		entry: ['src/tsup.base.ts'],
		external: ['tsup']
	})
);
