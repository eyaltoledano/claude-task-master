import { defineConfig } from 'tsup';
import { baseConfig, mergeConfig } from '@tm/build-config';

export default defineConfig(
	mergeConfig(baseConfig, {
		entry: {
			index: 'src/index.ts',
			'auth/index': 'src/auth/index.ts',
			'config/index': 'src/config/index.ts',
			'services/index': 'src/services/index.ts',
			'logger/index': 'src/logger/index.ts',
			'interfaces/index': 'src/interfaces/index.ts',
			'types/index': 'src/types/index.ts',
			'providers/index': 'src/providers/index.ts',
			'storage/index': 'src/storage/index.ts',
			'parser/index': 'src/parser/index.ts',
			'utils/index': 'src/utils/index.ts',
			'errors/index': 'src/errors/index.ts'
		},
		tsconfig: './tsconfig.json',
		outDir: 'dist',
		external: ['zod', '@supabase/supabase-js']
	})
);
