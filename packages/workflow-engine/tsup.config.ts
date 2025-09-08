import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/task-execution/index.ts',
    'src/worktree/index.ts', 
    'src/process/index.ts',
    'src/state/index.ts'
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true
});