#!/usr/bin/env node

/**
 * Architecture validation script for Flow refactoring
 * Validates directory structure and basic architectural setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flowDir = __dirname;

// Helper function to check if directories exist
function checkDirectoryStructure() {
  const requiredDirs = [
    'app',
    'app/commands',
    'app/adapters',
    'core',
    'core/ast',
    'core/task-integration',
    'core/analysis',
    'core/services',
    'core/models',
    'core/utils',
    'infra',
    'infra/fs',
    'infra/git',
    'infra/ai',
    'infra/telemetry',
    'infra/config',
    'infra/mcp',
    'ui',
    'ui/components',
    'ui/components/common',
    'ui/components/modals',
    'ui/screens',
    'ui/screens/vibekit',
    'ui/hooks',
    'ui/theme',
    'ui/contexts',
    'tests',
    'tests/fixtures',
    'tests/e2e',
    'tests/integration',
    'tests/unit',
    'new-docs'
  ];

  console.log('📁 Checking directory structure...');
  
  let allDirsExist = true;
  for (const dir of requiredDirs) {
    const dirPath = path.join(flowDir, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`❌ Missing directory: ${dir}`);
      allDirsExist = false;
    }
  }
  
  if (allDirsExist) {
    console.log('✅ Directory structure complete\n');
  }
  
  return allDirsExist;
}

// Check if index.js barrel files exist
function checkBarrelFiles() {
  const barrelFiles = [
    'app/index.js',
    'app/commands/index.js',
    'app/adapters/index.js',
    'core/index.js',
    'core/ast/index.js',
    'core/task-integration/index.js',
    'core/analysis/index.js',
    'core/services/index.js',
    'core/models/index.js',
    'core/utils/index.js',
    'infra/index.js',
    'infra/fs/index.js',
    'infra/git/index.js',
    'infra/ai/index.js',
    'infra/telemetry/index.js',
    'infra/config/index.js',
    'infra/mcp/index.js',
    'ui/index.js',
    'ui/components/index.js',
    'ui/components/common/index.js',
    'ui/screens/index.js',
    'ui/hooks/index.js',
    'ui/theme/index.js',
    'ui/contexts/index.js',
    'tests/index.js'
  ];

  console.log('📄 Checking barrel files...');
  
  let allBarrelsExist = true;
  for (const file of barrelFiles) {
    const filePath = path.join(flowDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Missing barrel file: ${file}`);
      allBarrelsExist = false;
    }
  }
  
  if (allBarrelsExist) {
    console.log('✅ All barrel files present\n');
  }
  
  return allBarrelsExist;
}

// Check if .gitkeep files exist in empty directories
function checkGitkeepFiles() {
  const dirsWithGitkeep = [
    'app',
    'app/commands',
    'app/adapters',
    'core',
    'core/ast',
    'core/task-integration',
    'core/analysis',
    'core/services',
    'core/models',
    'core/utils',
    'infra',
    'infra/fs',
    'infra/git',
    'infra/ai',
    'infra/telemetry',
    'infra/config',
    'infra/mcp',
    'ui',
    'ui/components',
    'ui/components/common',
    'ui/components/modals',
    'ui/screens',
    'ui/screens/vibekit',
    'ui/hooks',
    'ui/theme',
    'ui/contexts',
    'tests',
    'tests/fixtures',
    'tests/e2e',
    'tests/integration',
    'tests/unit',
    'new-docs'
  ];

  console.log('📌 Checking .gitkeep files...');
  
  let allGitkeepExist = true;
  for (const dir of dirsWithGitkeep) {
    const gitkeepPath = path.join(flowDir, dir, '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
      console.log(`❌ Missing .gitkeep file in: ${dir}`);
      allGitkeepExist = false;
    }
  }
  
  if (allGitkeepExist) {
    console.log('✅ All .gitkeep files present\n');
  }
  
  return allGitkeepExist;
}

// Run validation
async function main() {
  console.log('🔍 Validating Flow architecture setup...\n');
  
  const directoryCheck = checkDirectoryStructure();
  const barrelCheck = checkBarrelFiles();
  const gitkeepCheck = checkGitkeepFiles();
  
  if (directoryCheck && barrelCheck && gitkeepCheck) {
    console.log('✅ Phase 1 setup complete!');
    console.log('   - Directory structure created');
    console.log('   - Barrel files in place');
    console.log('   - .gitkeep files added');
    console.log('   - Ready for Phase 2 migration\n');
    process.exit(0);
  } else {
    console.log('❌ Phase 1 setup incomplete - please address the issues above');
    process.exit(1);
  }
}

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { checkDirectoryStructure, checkBarrelFiles, checkGitkeepFiles }; 