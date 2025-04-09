/**
 * workspace-scanner.js
 * Module for scanning workspace files and generating tasks based on codebase analysis
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { CONFIG, log } from './utils.js';
import { getChatCompletion } from './ai-services.js';
import chalk from 'chalk';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

/**
 * Recursively scan a directory to find all files
 * @param {string} dir - Directory to scan
 * @param {object} options - Options for scanning
 * @param {string[]} options.excludeDirs - Directories to exclude
 * @param {string[]} options.includeExtensions - File extensions to include
 * @returns {Promise<string[]>} Array of file paths
 */
async function scanDirectory(dir, options = {}) {
  const excludeDirs = options.excludeDirs || ['node_modules', '.git', 'dist', 'build', 'coverage'];
  const includeExtensions = options.includeExtensions || ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.md', '.json'];
  
  let results = [];
  
  try {
    const files = await readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const fileStat = await stat(filePath);
      
      if (fileStat.isDirectory()) {
        if (!excludeDirs.includes(file)) {
          const subResults = await scanDirectory(filePath, options);
          results = results.concat(subResults);
        }
      } else {
        const ext = path.extname(file).toLowerCase();
        if (includeExtensions.includes(ext) || includeExtensions.includes('*')) {
          results.push(filePath);
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}: ${err.message}`);
  }
  
  return results;
}

/**
 * Extract key files from a project
 * @param {string[]} allFiles - Array of all file paths
 * @returns {string[]} Array of important file paths
 */
function extractKeyFiles(allFiles) {
  const keyFilePatterns = [
    // Configuration files
    'package.json', 'tsconfig.json', '.env.example', 'docker-compose.yml', 'Dockerfile',
    // Documentation
    'README.md', 'SECURITY.md', 'DEPLOYMENT.md',
    // Entry points
    'index.js', 'app.js', 'main.ts', 'server.js',
    // Important directories to sample
    '/src/', '/server/', '/client/', '/api/', '/routes/', '/controllers/',
    '/models/', '/tests/'
  ];
  
  // Max files to return
  const MAX_FILES = 20;
  
  // Extract exact matches first
  const exactMatches = allFiles.filter(file => {
    const fileName = path.basename(file);
    return keyFilePatterns.includes(fileName);
  });
  
  // Then extract pattern matches
  const patternMatches = allFiles.filter(file => {
    return keyFilePatterns.some(pattern => {
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        return file.includes(pattern);
      }
      return false;
    });
  });
  
  // Combine and limit
  let keyFiles = [...exactMatches];
  
  // Add pattern matches until we reach MAX_FILES
  for (const file of patternMatches) {
    if (!keyFiles.includes(file) && keyFiles.length < MAX_FILES) {
      keyFiles.push(file);
    }
  }
  
  // If we still have room, add some random files from different extensions
  if (keyFiles.length < MAX_FILES) {
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rb'];
    
    for (const ext of extensions) {
      const filesWithExt = allFiles.filter(file => 
        path.extname(file).toLowerCase() === ext && !keyFiles.includes(file)
      );
      
      // Add a few files of each extension
      if (filesWithExt.length > 0) {
        const samplesToAdd = Math.min(2, filesWithExt.length);
        keyFiles = keyFiles.concat(filesWithExt.slice(0, samplesToAdd));
        
        if (keyFiles.length >= MAX_FILES) {
          break;
        }
      }
    }
  }
  
  return keyFiles.slice(0, MAX_FILES);
}

/**
 * Read file content with a size limit
 * @param {string} filePath - Path to the file
 * @param {number} maxSize - Maximum size in bytes
 * @returns {Promise<string>} File content
 */
async function readFileWithLimit(filePath, maxSize = 100 * 1024) {
  try {
    const fileBuffer = await readFile(filePath);
    
    if (fileBuffer.length > maxSize) {
      // Return truncated file with a note
      return fileBuffer.slice(0, maxSize).toString() + 
        `\n\n... (file truncated, ${Math.round((fileBuffer.length - maxSize) / 1024)}KB omitted)`;
    }
    
    return fileBuffer.toString();
  } catch (err) {
    return `Error reading file: ${err.message}`;
  }
}

/**
 * Generate project analysis prompt based on files
 * @param {Object} fileContents - Object mapping file paths to contents
 * @returns {string} Prompt for the AI
 */
function generateAnalysisPrompt(fileContents) {
  let prompt = `
You are an expert developer tasked with analyzing a codebase and identifying tasks for a development roadmap.
Below are the contents of key files from the project. Please analyze them and:

1. Identify the project's purpose, architecture, and technology stack
2. Determine the current state and development phase of the project
3. Identify any missing features, improvements, or technical debt that should be addressed
4. Generate a prioritized list of tasks that would improve the project

Key files from the project:
`;

  for (const [filePath, content] of Object.entries(fileContents)) {
    prompt += `\n\n--- ${filePath} ---\n${content}`;
  }

  prompt += `\n\nBased on these files, please create a structured list of 5-15 tasks with:
1. A short, descriptive title
2. A priority (high, medium, low)
3. Dependencies on other tasks (if applicable)
4. A detailed description explaining what needs to be implemented
5. A test strategy for verifying the implementation

Format each task using this structure:
- Task: [Title]
- Priority: [Priority]
- Dependencies: [IDs of prerequisite tasks, or "None"]
- Description: [Detailed implementation description]
- Test Strategy: [How to verify the implementation]

Please focus on creating practical tasks that address:
- Security concerns
- Code quality and maintainability
- Feature completeness
- User experience
- Deployment and operations`;

  return prompt;
}

/**
 * Generate task objects from AI analysis
 * @param {string} aiResponse - The AI's analysis response
 * @returns {Array} Array of task objects
 */
function parseTasks(aiResponse) {
  const tasks = [];
  const taskPattern = /- Task: (.*?)\n- Priority: (.*?)\n- Dependencies: (.*?)\n- Description: (.*?)\n- Test Strategy: (.*?)(?=\n- Task:|$)/gs;
  
  let match;
  let taskId = 1;
  
  while ((match = taskPattern.exec(aiResponse)) !== null) {
    const [_, title, priority, dependencies, description, testStrategy] = match;
    
    // Parse dependencies
    let taskDependencies = [];
    if (dependencies.trim() !== 'None') {
      taskDependencies = dependencies
        .split(',')
        .map(dep => parseInt(dep.trim(), 10))
        .filter(dep => !isNaN(dep));
    }
    
    tasks.push({
      id: taskId,
      title: title.trim(),
      description: title.trim(),
      status: 'pending',
      priority: priority.trim().toLowerCase(),
      dependencies: taskDependencies,
      details: description.trim(),
      testStrategy: testStrategy.trim(),
      subtasks: []
    });
    
    taskId++;
  }
  
  return tasks;
}

/**
 * Scan workspace and generate tasks
 * @param {string} workspacePath - Path to the workspace
 * @param {string} outputPath - Path to save tasks.json
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result object
 */
async function scanWorkspace(workspacePath, outputPath = 'tasks/tasks.json', options = {}) {
  console.log(chalk.blue(`Scanning workspace: ${workspacePath}`));
  console.log(chalk.blue('This may take a few moments...'));
  
  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Scan directory for all files
  const allFiles = await scanDirectory(workspacePath, {
    excludeDirs: options.excludeDirs,
    includeExtensions: options.includeExtensions
  });
  
  console.log(chalk.blue(`Found ${allFiles.length} files. Extracting key files...`));
  
  // Extract key files for analysis
  const keyFiles = extractKeyFiles(allFiles);
  
  console.log(chalk.blue(`Selected ${keyFiles.length} key files for analysis.`));
  
  // Read file contents
  const fileContents = {};
  for (const filePath of keyFiles) {
    const relativePath = path.relative(workspacePath, filePath);
    fileContents[relativePath] = await readFileWithLimit(filePath);
    
    // Add a brief pause to avoid overwhelming the filesystem
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  
  console.log(chalk.blue('Analyzing files and generating tasks...'));
  
  // Generate prompt for AI
  const prompt = generateAnalysisPrompt(fileContents);
  
  // Get AI analysis
  const model = process.env.MODEL || CONFIG.MODEL;
  const response = await getChatCompletion([
    { role: "system", content: "You are an expert developer assistant that specializes in analyzing codebases and creating structured development roadmaps." },
    { role: "user", content: prompt }
  ], { model });
  
  // Parse tasks from the AI response
  const tasks = parseTasks(response.completion);
  
  console.log(chalk.green(`Generated ${tasks.length} tasks based on codebase analysis.`));
  
  // Create tasks.json structure
  const tasksJson = {
    project: {
      name: options.projectName || path.basename(workspacePath),
      version: options.projectVersion || "1.0.0",
      description: `Tasks generated from workspace scan of ${path.basename(workspacePath)}`
    },
    tasks: tasks
  };
  
  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(tasksJson, null, 2));
  
  console.log(chalk.green(`Tasks saved to: ${outputPath}`));
  console.log(chalk.blue('Run `task-master list` to see your tasks, or `task-master generate` to create task files'));
  
  return {
    success: true,
    taskCount: tasks.length,
    outputPath
  };
}

export { scanWorkspace }; 