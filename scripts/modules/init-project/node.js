import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Placeholder for logging - needs to be passed or imported properly later
// REMOVED - Logging handled by passed object
// const log = (level, ...args) => { ... };

// Placeholder for utility - needs proper import/passing
// Ensure this uses the passed log object STRICTLY
const ensureDirectoryExists = (dirPath, effectiveLog) => {
    if (!effectiveLog || typeof effectiveLog.debug !== 'function' || typeof effectiveLog.error !== 'function') {
        console.error('[ensureDirectoryExists] Error: Invalid logger passed.');
        // Decide how to handle - throw error or attempt to continue silently?
        // For now, let's throw to make the issue obvious during debugging
        throw new Error('Invalid logger provided to ensureDirectoryExists');
    }

    if (!fs.existsSync(dirPath)) {
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            effectiveLog.debug(`Created directory: ${dirPath}`); 
        } catch (error) {
            effectiveLog.error(`Failed to create directory ${dirPath}: ${error.message}`);
            throw error; 
        }
    }
};

// Placeholder utility (replace with proper injection/import)
// Ensure this uses the passed log object STRICTLY
const copyTemplateFile = (templateName, targetPath, replacements = {}, effectiveLog) => {
    if (!effectiveLog || typeof effectiveLog.warn !== 'function' || typeof effectiveLog.debug !== 'function' || typeof effectiveLog.error !== 'function') {
         console.error('[copyTemplateFile] Error: Invalid logger passed.');
         throw new Error('Invalid logger provided to copyTemplateFile');
     }

     // Placeholder: Needs actual template loading logic from a source directory
     // This should probably be passed in or determined more robustly
     effectiveLog.warn(`[copyTemplateFile in node.js] Placeholder implementation used for ${templateName}. Needs proper template source path logic.`);
     const templateContent = `Placeholder for ${templateName}`; 
     let content = templateContent;
     Object.entries(replacements).forEach(([key, value]) => {
         const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
         content = content.replace(regex, value || ''); 
     });
     try {
         // Pass the *same* effectiveLog down
         ensureDirectoryExists(path.dirname(targetPath), effectiveLog); 
         fs.writeFileSync(targetPath, content, 'utf8');
         effectiveLog.debug(`Copied/Created placeholder template file: ${targetPath}`);
     } catch (error) {
         effectiveLog.error(`Failed to copy placeholder template ${templateName} to ${targetPath}: ${error.message}`);
     }
 };

// Placeholder utility (replace with proper injection/import)
// Ensure this uses the passed log object STRICTLY
const setupMCPConfiguration = (targetDir, projectName, effectiveLog) => {
    if (!effectiveLog || typeof effectiveLog.info !== 'function' || typeof effectiveLog.success !== 'function') {
        console.error('[setupMCPConfiguration] Error: Invalid logger passed.');
        throw new Error('Invalid logger provided to setupMCPConfiguration');
    }
    
    effectiveLog.info(`Executing Node-specific MCP setup for ${projectName} in ${targetDir}`);
    const mcpServerDir = path.join(targetDir, 'mcp-server');
    // Pass the *same* effectiveLog down
    ensureDirectoryExists(mcpServerDir, effectiveLog); 
    effectiveLog.success('Node-specific MCP setup placeholder complete.');
};

/**
 * Initializes a Node.js/TypeScript project structure.
 * @param {string} targetDir - The root directory for the project.
 * @param {string} projectName - The name of the project.
 * @param {string} projectVersion - The version of the project.
 * @param {string} authorName - The author's name.
 * @param {boolean} skipInstall - Whether to skip npm install.
 */
export async function initializeProject(
  targetDir,
  projectName,
  projectVersion,
  authorName,
  skipInstall,
  log // Still accept the original log object from the caller
) {
  // --- Define effectiveLog ONCE here, using the passed 'log' object --- 
  const effectiveLog = {
      info: (msg, ...args) => log && typeof log.info === 'function' ? log.info(msg, ...args) : (() => {}), // No console fallback
      warn: (msg, ...args) => log && typeof log.warn === 'function' ? log.warn(msg, ...args) : (() => {}), // No console fallback
      error: (msg, ...args) => log && typeof log.error === 'function' ? log.error(msg, ...args) : (() => {}), // No console fallback
      // Debug can fallback to no-op if not present
      debug: (msg, ...args) => log && typeof log.debug === 'function' ? log.debug(msg, ...args) : (() => {}), 
      // Success can map to info if not present, or no-op
      success: (msg, ...args) => log && typeof log.success === 'function' ? log.success(msg, ...args) : (log && typeof log.info === 'function' ? log.info(`[SUCCESS] ${msg}`, ...args) : (() => {}))
  };
  // --- End effectiveLog Definition ---

  effectiveLog.info(`Initializing Node.js/TypeScript structure in: ${targetDir}`);

  try {
    // 1. Run `npm init -y`
    effectiveLog.info('Initializing npm project...');
    try {
        execSync('npm init -y', { cwd: targetDir, stdio: 'ignore' });
        effectiveLog.success('npm project initialized.');
    } catch (npmInitError) {
        effectiveLog.warn(`npm init -y failed: ${npmInitError.message}. Attempting to continue...`);
    }

    // 2. Modify package.json
    const packageJsonPath = path.join(targetDir, 'package.json');
    let packageJson = {};
    try {
        if (fs.existsSync(packageJsonPath)) {
            packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        } else {
            packageJson = { name: projectName.toLowerCase().replace(/\s+/g, '-'), version: projectVersion };
        }
    } catch (readError) {
        effectiveLog.error(`Failed to read existing package.json: ${readError.message}. Creating basic one.`);
        packageJson = { name: projectName.toLowerCase().replace(/\s+/g, '-'), version: projectVersion };
    }
    // Define required fields and dependencies
    packageJson.name = packageJson.name || projectName.toLowerCase().replace(/\s+/g, '-');
    packageJson.version = packageJson.version || projectVersion;
    packageJson.author = authorName || packageJson.author;
    packageJson.description = packageJson.description || ''; 
    packageJson.type = 'module';
    packageJson.main = 'dist/index.js'; 
    packageJson.scripts = {
        ...(packageJson.scripts || {}),
        dev: 'nodemon --watch src --ext ts,json --exec tsx src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
        lint: 'eslint . --ext .ts',
        test: 'jest' 
    };
    packageJson.dependencies = {
        ...(packageJson.dependencies || {}),
        dotenv: '^16.3.1',
    };
    packageJson.devDependencies = {
        ...(packageJson.devDependencies || {}),
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
        nodemon: '^3.0.0',
        tsx: '^4.0.0',
        eslint: '^8.0.0',
        jest: '^29.0.0', 
        '@types/jest': '^29.0.0',
        'ts-jest': '^29.0.0'
    };
    try {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
        effectiveLog.success('Updated package.json with Node.js/TypeScript settings.');
    } catch (writeError) {
        effectiveLog.error(`Failed to write package.json: ${writeError.message}`);
        throw writeError;
    }

    // 3. Create tsconfig.json
    const tsconfig = {
        compilerOptions: {
            target: 'ES2020',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true 
        },
        include: ['src/**/*'],
        exclude: ['node_modules', '**/*.spec.ts', '**/*.test.ts']
    };
    const tsconfigPath = path.join(targetDir, 'tsconfig.json');
    try {
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');
        effectiveLog.success('Created tsconfig.json.');
    } catch (writeError) {
        effectiveLog.error(`Failed to write tsconfig.json: ${writeError.message}`);
    }
    
    // 4. Create src/index.ts
    const srcDir = path.join(targetDir, 'src');
    // Pass effectiveLog to helper
    ensureDirectoryExists(srcDir, effectiveLog); 
    const indexTsPath = path.join(srcDir, 'index.ts');
    const indexTsContent = 'console.log("Hello from Task Master TypeScript project!");\n';
    if (!fs.existsSync(indexTsPath)) {
        try {
            fs.writeFileSync(indexTsPath, indexTsContent, 'utf8');
            effectiveLog.success('Created src/index.ts.');
        } catch (writeError) {
            effectiveLog.error(`Failed to write src/index.ts: ${writeError.message}`);
        }
    } else {
        effectiveLog.info('src/index.ts already exists, not overwriting.');
    }

    // 5. Append Node-specific .gitignore content 
    const gitignorePath = path.join(targetDir, '.gitignore');
    const nodeGitignoreContent = `
# Node.js / TypeScript
node_modules
dist
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.env
.env.*
!\.env.example
`;
    try {
      if (fs.existsSync(gitignorePath)) {
        fs.appendFileSync(gitignorePath, nodeGitignoreContent, 'utf8');
        effectiveLog.info('Appended Node.js rules to .gitignore.')
      } else {
        fs.writeFileSync(gitignorePath, nodeGitignoreContent.trim(), 'utf8');
        effectiveLog.info('Created Node.js .gitignore file.');
      }
    } catch (gitIgnoreError) {
       effectiveLog.error(`Failed to update .gitignore: ${gitIgnoreError.message}`);
    }

    // 6. dev.js script now handled via package.json

    // 7. Setup MCP configuration - Call helper, passing effectiveLog
    setupMCPConfiguration(targetDir, projectName, effectiveLog); 

    // 8. Run `npm install`
    if (!skipInstall) {
      effectiveLog.info('Running npm install...');
      try {
        execSync('npm install', { cwd: targetDir, stdio: 'ignore', timeout: 300000 });
        effectiveLog.success('Dependencies installed.');
      } catch (installError) {
        effectiveLog.error(`npm install failed: ${installError.message}`);
        effectiveLog.warn('Please run \'npm install\' manually.');
      }
    } else {
        effectiveLog.info('Skipping npm install.');
    }

  } catch (error) {
    effectiveLog.error(`Node.js initialization failed: ${error.message}`);
    effectiveLog.debug(error.stack);
    throw error;
  }
}

// TODO: Consider moving setupMCPConfiguration here if it's Node-specific
// function setupMCPConfiguration(targetDir, projectName) { ... } 