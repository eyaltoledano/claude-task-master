import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Placeholder for logging - needs to be passed or imported properly later
// REMOVED - Logging handled by passed object
// const log = (level, ...args) => { ... };

// Placeholder for utility - needs proper import/passing
// Ensure this uses the passed log object STRICTLY
const ensureDirectoryExists = (dirPath, log) => {
    if (!fs.existsSync(dirPath)) {
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            // Use passed log directly, checking for method existence
            if (log && typeof log.debug === 'function') log.debug(`Created directory: ${dirPath}`); 
        } catch (error) {
            if (log && typeof log.error === 'function') log.error(`Failed to create directory ${dirPath}: ${error.message}`);
            throw error; // Rethrow after logging
        }
    }
};

// Placeholder utility (replace with proper injection/import)
// Ensure this uses the passed log object STRICTLY
const copyTemplateFile = (templateName, targetPath, replacements = {}, log) => {
     // Placeholder: Needs actual template loading logic
     if (log && typeof log.warn === 'function') log.warn(`[copyTemplateFile in node.js] Placeholder implementation used for ${templateName}. Needs proper template source path logic.`);
     const templateContent = `Placeholder for ${templateName}`; 
     let content = templateContent;
     Object.entries(replacements).forEach(([key, value]) => {
         const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
         content = content.replace(regex, value || ''); 
     });
     try {
         // Pass the *same* log object down
         ensureDirectoryExists(path.dirname(targetPath), log); 
         fs.writeFileSync(targetPath, content, 'utf8');
         if (log && typeof log.debug === 'function') log.debug(`Copied/Created placeholder template file: ${targetPath}`);
     } catch (error) {
         if (log && typeof log.error === 'function') log.error(`Failed to copy placeholder template ${templateName} to ${targetPath}: ${error.message}`);
         // Decide if this error should be fatal
     }
 };

// Placeholder utility (replace with proper injection/import)
// Ensure this uses the passed log object STRICTLY
const setupMCPConfiguration = (targetDir, projectName, log) => {
    if (log && typeof log.info === 'function') log.info(`Executing Node-specific MCP setup for ${projectName} in ${targetDir}`);
    const mcpServerDir = path.join(targetDir, 'mcp-server');
    // Pass the *same* log object down
    ensureDirectoryExists(mcpServerDir, log); 
    if (log && typeof log.success === 'function') log.success('Node-specific MCP setup placeholder complete.');
    // Add creation of mcp.json or other specific Node setup here if needed
};

/**
 * Initializes a Node.js/TypeScript project structure.
 * @param {string} targetDir - The root directory for the project.
 * @param {object} options - Contains projectName, projectVersion, authorName, skipInstall, projectDescription.
 * @param {object} log - The logger instance passed from the caller.
 */
export async function initializeProject(
  targetDir,
  options = {}, // Accept options object
  log // Still accept the original log object from the caller
) {
   const {
    projectName = 'new-taskmaster-node-project',
    projectVersion = '0.1.0',
    authorName = '',
    skipInstall = false,
    projectDescription = '' // Extract projectDescription
  } = options; // Destructure options

  // Use passed log directly
  if (log && typeof log.info === 'function') log.info('--- RUNNING NODE INITIALIZER ---');
  if (log && typeof log.info === 'function') log.info(`Initializing Node.js/TypeScript structure in: ${targetDir}`);

  try {
    // 1. Run `npm init -y`
    if (log && typeof log.info === 'function') log.info('Initializing npm project...');
    try {
        execSync('npm init -y', { cwd: targetDir, stdio: 'ignore' });
        if (log && typeof log.success === 'function') log.success('npm project initialized.');
    } catch (npmInitError) {
        if (log && typeof log.warn === 'function') log.warn(`npm init -y failed: ${npmInitError.message}. Attempting to continue...`);
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
        if (log && typeof log.error === 'function') log.error(`Failed to read existing package.json: ${readError.message}. Creating basic one.`);
        packageJson = { name: projectName.toLowerCase().replace(/\s+/g, '-'), version: projectVersion };
    }
    // Define required fields and dependencies
    packageJson.name = packageJson.name || projectName.toLowerCase().replace(/\s+/g, '-');
    packageJson.version = packageJson.version || projectVersion;
    packageJson.author = authorName || packageJson.author;
    packageJson.description = projectDescription || packageJson.description || '';
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
        if (log && typeof log.success === 'function') log.success('Updated package.json with Node.js/TypeScript settings.');
    } catch (writeError) {
        if (log && typeof log.error === 'function') log.error(`Failed to write package.json: ${writeError.message}`);
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
        if (log && typeof log.success === 'function') log.success('Created tsconfig.json.');
    } catch (writeError) {
        if (log && typeof log.error === 'function') log.error(`Failed to write tsconfig.json: ${writeError.message}`);
    }
    
    // 4. Create src/index.ts
    const srcDir = path.join(targetDir, 'src');
    // Pass log to helper
    ensureDirectoryExists(srcDir, log); 
    const indexTsPath = path.join(srcDir, 'index.ts');
    const indexTsContent = 'console.log("Hello from Task Master TypeScript project!");\n';
    if (!fs.existsSync(indexTsPath)) {
        try {
            fs.writeFileSync(indexTsPath, indexTsContent, 'utf8');
            if (log && typeof log.success === 'function') log.success('Created src/index.ts.');
        } catch (writeError) {
            if (log && typeof log.error === 'function') log.error(`Failed to write src/index.ts: ${writeError.message}`);
        }
    } else {
        if (log && typeof log.info === 'function') log.info('src/index.ts already exists, not overwriting.');
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
        if (log && typeof log.info === 'function') log.info('Appended Node.js rules to .gitignore.')
      } else {
        fs.writeFileSync(gitignorePath, nodeGitignoreContent.trim(), 'utf8');
        if (log && typeof log.info === 'function') log.info('Created Node.js .gitignore file.');
      }
    } catch (gitIgnoreError) {
       if (log && typeof log.error === 'function') log.error(`Failed to update .gitignore: ${gitIgnoreError.message}`);
    }

    // 6. Copy dev.js (Node.js specific development script)
    // Use the helper, passing the log object
    copyTemplateFile('dev.js', path.join(targetDir, 'scripts', 'dev.js'), {}, log);

    // 7. Setup MCP configuration - Call helper, passing log
    setupMCPConfiguration(targetDir, projectName, log); 

    // 8. Run `npm install`
    if (!skipInstall) {
      if (log && typeof log.info === 'function') log.info('Running npm install...');
      try {
        execSync('npm install', { cwd: targetDir, stdio: 'ignore', timeout: 300000 });
        if (log && typeof log.success === 'function') log.success('Dependencies installed.');
      } catch (installError) {
        if (log && typeof log.error === 'function') log.error(`npm install failed: ${installError.message}`);
        if (log && typeof log.warn === 'function') log.warn('Please run \'npm install\' manually.');
      }
    } else {
        if (log && typeof log.info === 'function') log.info('Skipping npm install.');
    }

  } catch (error) {
    if (log && typeof log.error === 'function') log.error(`Node.js initialization failed: ${error.message}`);
    if (log && typeof log.debug === 'function') log.debug(error.stack);
    throw error;
  }
}

// TODO: Consider moving setupMCPConfiguration here if it's Node-specific
// function setupMCPConfiguration(targetDir, projectName) { ... } 