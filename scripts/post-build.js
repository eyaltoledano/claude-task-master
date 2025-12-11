#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🔧 Fixing bundled imports...');

// Fix the import paths in bundled mcp-server.js
const mcpServerPath = path.join(process.cwd(), 'dist', 'mcp-server.js');
if (fs.existsSync(mcpServerPath)) {
  let content = fs.readFileSync(mcpServerPath, 'utf8');

  // Replace incorrect import paths
  content = content.replace(/from"\.\/mcp-server\/src\//g, 'from"./src/');

  fs.writeFileSync(mcpServerPath, content);
  console.log('✅ Fixed mcp-server.js imports');
}

// Copy mcp-server/src to dist/src
const srcDir = path.join(process.cwd(), 'mcp-server', 'src');
const distSrcDir = path.join(process.cwd(), 'dist', 'src');

if (fs.existsSync(srcDir)) {
  // Remove existing dist/src if it exists
  if (fs.existsSync(distSrcDir)) {
    fs.rmSync(distSrcDir, { recursive: true, force: true });
  }

  // Copy mcp-server/src to dist/src
  fs.cpSync(srcDir, distSrcDir, { recursive: true });
  console.log('✅ Copied mcp-server/src to dist/src');
}

console.log('🎉 Post-build fixes complete!');