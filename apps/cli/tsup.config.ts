import { defineConfig } from 'tsup';
import { cliConfig, mergeConfig } from '@tm/build-config';

export default defineConfig(
	mergeConfig(cliConfig, {
		entry: ['src/index.ts']
	})
);
