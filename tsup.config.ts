import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points - start with a few, expand as we migrate
  entry: [
    'src/index.ts',
    'scripts/init.ts',
    'scripts/dev.ts',
    'mcp-server/server.ts'
  ],
  
  // Output format
  format: ['esm'],
  
  // Generate TypeScript declarations
  dts: true,
  
  // Source maps for debugging
  sourcemap: true,
  
  // Clean output directory
  clean: true,
  
  // External dependencies (don't bundle)
  external: [
    // All dependencies from package.json
    /^@ai-sdk\//,
    /^@anthropic-ai\//,
    /^@openrouter\//,
    'ai',
    'boxen',
    'chalk',
    'cli-table3',
    'commander',
    'cors',
    'dotenv',
    'express',
    'fastmcp',
    'figlet',
    'fuse.js',
    'gradient-string',
    'helmet',
    'inquirer',
    'jsonwebtoken',
    'lru-cache',
    'ollama-ai-provider',
    'openai',
    'ora',
    'uuid',
    'zod'
  ],
  
  // Node.js target
  target: 'node14',
  
  // Preserve file structure
  splitting: false,
  
  // TypeScript configuration
  tsconfig: './tsconfig.json'
});