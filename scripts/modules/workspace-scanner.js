/**
 * Workspace Scanner Module
 * 
 * This module provides functionality to scan and analyze codebases to automatically
 * generate tasks based on existing code structure.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { callLLMWithRetry } from './ai-services.js';
import { addTask, parsePRD } from './task-manager.js';
import { log } from './utils.js';
import chalk from 'chalk';
import { writeJSON } from './utils.js';

// Define colorize functions to replace the missing import
const colorize = {
  yellow: (text) => chalk.yellow(text),
  green: (text) => chalk.green(text),
  red: (text) => chalk.red(text)
};

/**
 * Validate generated tasks from workspace scanning
 * @param {Array<Object>} tasks - Array of task objects to validate
 * @returns {Array<Object>} Validated tasks with fixed IDs and dependencies
 */
function validateTasks(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    return [];
  }

  // Convert task dependencies from indexes to task IDs
  const validatedTasks = tasks.map((task, index) => {
    const taskId = (index + 1);
    return {
      ...task,
      id: taskId,
      status: task.status || 'pending',
      dependencies: (task.dependencies || []).map(depIndex => (depIndex + 1))
    };
  });

  return validatedTasks;
}

/**
 * Save tasks to a JSON file
 * @param {Array<Object>} tasks - Array of task objects to save
 * @param {string} outputPath - Path where to save the tasks
 */
function saveTasksToFile(tasks, outputPath) {
  // Create the tasks data structure
  const data = {
    tasks: tasks,
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'workspace-scanner'
    }
  };

  // Ensure directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save the file
  writeJSON(outputPath, data);
}

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Recursively scans a directory for code files
 * @param {string} dir - Directory path to scan
 * @param {Array<string>} fileTypes - Array of file extensions to include
 * @param {Array<string>} ignoreDirs - Array of directory names to ignore
 * @returns {Promise<Array<string>>} - Array of file paths
 */
async function scanDirectory(dir, fileTypes = [], ignoreDirs = ['.git', 'node_modules', 'dist', 'build']) {
  let results = [];
  
  try {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        if (!ignoreDirs.includes(entry)) {
          const subResults = await scanDirectory(fullPath, fileTypes, ignoreDirs);
          results = [...results, ...subResults];
        }
      } else if (stats.isFile()) {
        const ext = path.extname(entry).toLowerCase();
        if (fileTypes.length === 0 || fileTypes.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {
    log('error', `Error scanning directory ${dir}: ${err.message}`);
  }
  
  return results;
}

/**
 * Analyzes file content to extract code patterns
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} - Analysis result
 */
async function analyzeFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const fileExt = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    
    return {
      path: filePath,
      ext: fileExt,
      name: fileName,
      content: content,
      size: content.length
    };
  } catch (err) {
    log('error', `Error analyzing file ${filePath}: ${err.message}`);
    return {
      path: filePath,
      error: err.message
    };
  }
}

/**
 * Sample files to reduce the amount of data sent to the LLM
 * @param {Array<Object>} files - Array of file analysis results
 * @param {number} maxFiles - Maximum number of files to include
 * @param {number} maxSizePerFile - Maximum size per file in characters
 * @returns {Array<Object>} - Sampled file array
 */
function sampleFiles(files, maxFiles = 20, maxSizePerFile = 5000) {
  // Sort files by size - smallest first to capture more diverse files
  const sortedFiles = [...files].sort((a, b) => (a.size || 0) - (b.size || 0));
  
  // Take up to maxFiles, truncating content if necessary
  return sortedFiles.slice(0, maxFiles).map(file => {
    if (file.content && file.content.length > maxSizePerFile) {
      return {
        ...file,
        content: file.content.substring(0, maxSizePerFile) + `\n... (${file.content.length - maxSizePerFile} characters truncated)`
      };
    }
    return file;
  });
}

/**
 * Generates the prompt for the LLM to analyze the codebase
 * @param {Array<Object>} sampledFiles - Array of sampled file analysis results
 * @returns {string} - Formatted prompt
 */
function generateAnalysisPrompt(sampledFiles) {
  const fileCount = sampledFiles.length;
  
  // Create a file structure summary
  const fileStructure = sampledFiles.map(file => file.path).join('\n');
  
  // Count file extensions to determine technologies used
  const extensions = {};
  sampledFiles.forEach(file => {
    const ext = file.ext;
    if (ext) {
      extensions[ext] = (extensions[ext] || 0) + 1;
    }
  });
  
  const extSummary = Object.entries(extensions)
    .map(([ext, count]) => `${ext}: ${count} files`)
    .join('\n');
  
  // Create a file content section with the most important files
  const fileContents = sampledFiles
    .map(file => {
      if (file.content) {
        return `--- FILE: ${file.path} ---\n${file.content}\n--- END FILE ---\n`;
      }
      return `--- FILE: ${file.path} ---\n(Error reading file: ${file.error})\n--- END FILE ---\n`;
    })
    .join('\n');
  
  return `You are a software development expert tasked with analyzing a codebase and generating tasks for implementing improvements.
  
CODEBASE SUMMARY:
- Total files sampled: ${fileCount}
- File extensions found:
${extSummary}

FILE STRUCTURE:
${fileStructure}

FILE CONTENTS:
${fileContents}

INSTRUCTIONS:
Based on the codebase sample provided, generate a set of tasks that would be appropriate for this project. Focus on:

1. Code quality improvements
2. Feature implementations
3. Architecture enhancements
4. Testing improvements
5. Dependency management and updates
6. Performance optimizations
7. User experience improvements
8. Documentation needs
9. Technical debt reduction

For each task, include:
- A clear, actionable title
- A detailed description
- Implementation details including specific files to modify
- A reasonable priority (high/medium/low)
- Dependencies on other tasks when applicable
- A test strategy to verify the implementation

Return ONLY a JSON array of tasks with the following structure:
[
  {
    "title": "Task title",
    "description": "Task description",
    "details": "Detailed implementation steps",
    "testStrategy": "How to verify this task is complete",
    "priority": "high|medium|low",
    "dependencies": [] // Array of task indexes (0-based) that must be completed first
  }
]
`;
}

/**
 * Uses the LLM to analyze codebase samples and generate tasks
 * @param {Array<Object>} sampledFiles - Array of sampled file analysis results
 * @returns {Promise<Array<Object>>} - Generated tasks
 */
async function generateTasksFromCodeAnalysis(sampledFiles) {
  try {
    const prompt = generateAnalysisPrompt(sampledFiles);
    
    log('Analyzing codebase and generating tasks...');
    const response = await callLLMWithRetry({
      messages: [
        { role: 'system', content: 'You are a software development expert that analyzes code and suggests improvements.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.2
    });
    
    if (!response || !response.content) {
      throw new Error('Failed to get a valid response from the AI service');
    }
    
    // Extract JSON array from response
    const jsonMatch = response.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      throw new Error('Could not extract valid JSON from the AI response');
    }
    
    const tasksJson = jsonMatch[0];
    const tasks = JSON.parse(tasksJson);
    
    // Convert task dependencies from indexes to IDs
    const tasksWithProperIds = tasks.map((task, index) => {
      const taskId = (index + 1).toString();
      return {
        ...task,
        id: taskId,
        dependencies: (task.dependencies || []).map(depIndex => (depIndex + 1).toString())
      };
    });
    
    return tasksWithProperIds;
  } catch (err) {
    log('error', `Error generating tasks from code analysis: ${err.message}`);
    throw err;
  }
}

/**
 * Generates a PRD based on codebase analysis
 * @param {Array<Object>} sampledFiles - Array of sampled file analysis results
 * @returns {Promise<string>} - Path to the generated PRD file
 */
async function generatePRDFromCodeAnalysis(sampledFiles, workspacePath) {
  try {
    const fileCount = sampledFiles.length;
    
    // Create a file structure summary
    const fileStructure = sampledFiles.map(file => file.path).join('\n');
    
    // Count file extensions to determine technologies used
    const extensions = {};
    sampledFiles.forEach(file => {
      const ext = file.ext;
      if (ext) {
        extensions[ext] = (extensions[ext] || 0) + 1;
      }
    });
    
    const extSummary = Object.entries(extensions)
      .map(([ext, count]) => `${ext}: ${count} files`)
      .join('\n');
    
    // Create a file content sample with the most important files
    const fileContentSample = sampledFiles
      .slice(0, 5) // Take only first 5 files for brevity in PRD
      .map(file => {
        if (file.content) {
          return `--- FILE: ${file.path} ---\n${file.content.substring(0, 500)}${file.content.length > 500 ? '...(truncated)' : ''}\n`;
        }
        return `--- FILE: ${file.path} ---\n(Error reading file: ${file.error})\n`;
      })
      .join('\n');
    
    log('Generating PRD from codebase analysis...');
    const response = await callLLMWithRetry({
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert software architect and product manager. You analyze codebases and create detailed PRDs (Product Requirements Documents) that outline improvements and feature implementations.' 
        },
        { 
          role: 'user', 
          content: `Based on the codebase sample provided, generate a comprehensive PRD focused on code improvements and feature implementations.

CODEBASE SUMMARY:
- Total files sampled: ${fileCount}
- File extensions found:
${extSummary}

FILE STRUCTURE:
${fileStructure}

SAMPLE FILE CONTENTS:
${fileContentSample}

Create a Product Requirements Document (PRD) in plain text format that:
1. Starts with a high-level overview of the project based on the code
2. Identifies key areas for improvement in the codebase
3. Outlines specific requirements for:
   - Code quality improvements
   - Feature implementations
   - Architecture enhancements
   - Testing improvements
   - Dependency management
   - Performance optimizations
   - User experience improvements
   - Documentation needs
   - Technical debt reduction
4. For each section, provide detailed, actionable requirements that can be implemented

Format as a detailed PRD with sections and numbered requirements. Make it comprehensive enough to generate at least 15-20 specific tasks.
The PRD will be used to generate tasks automatically, so be specific about implementations needed.`
        }
      ],
      max_tokens: 8000,
      temperature: 0.2
    });
    
    if (!response || !response.content) {
      throw new Error('Failed to get a valid response from the AI service for PRD generation');
    }
    
    // Ensure scripts directory exists
    const scriptsDir = path.join(workspacePath, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      await mkdir(scriptsDir, { recursive: true });
    }
    
    // Save the PRD to a file
    const prdPath = path.join(scriptsDir, 'prd.txt');
    await writeFile(prdPath, response.content);
    log(`Generated PRD saved to ${colorize.green(prdPath)}`);
    
    return prdPath;
  } catch (err) {
    log('error', `Error generating PRD: ${err.message}`);
    throw err;
  }
}

/**
 * Main function to scan a workspace and generate tasks
 * @param {string} workspacePath - Path to the workspace to scan
 * @param {Object} options - Additional options
 * @returns {Promise<Array<Object>>} - Generated tasks
 */
export async function scanWorkspace(workspacePath, options = {}) {
  const {
    fileTypes = ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.java', '.php', '.rb', '.cs', '.cpp', '.c', '.html', '.css', '.json'],
    ignoreDirs = ['.git', 'node_modules', 'dist', 'build', 'vendor', 'bin'],
    outputPath = 'tasks/tasks.json',
    maxFiles = 20,
    maxSizePerFile = 5000,
    numTasks = 15,
    generatePRD = true // New option to control PRD generation
  } = options;
  
  try {
    // Validate workspace path
    const workspaceStats = await stat(workspacePath);
    if (!workspaceStats.isDirectory()) {
      throw new Error(`Workspace path is not a directory: ${workspacePath}`);
    }
    
    log(`Scanning workspace: ${colorize.yellow(workspacePath)}`);
    
    // Find all matching files
    const filePaths = await scanDirectory(workspacePath, fileTypes, ignoreDirs);
    log(`Found ${colorize.green(filePaths.length)} files to analyze`);
    
    // Analyze files in parallel
    const fileAnalysisPromises = filePaths.map(filePath => analyzeFile(filePath));
    const fileAnalysisResults = await Promise.all(fileAnalysisPromises);
    
    // Sample files to keep within token limits
    const sampledFiles = sampleFiles(fileAnalysisResults, maxFiles, maxSizePerFile);
    log(`Sampled ${colorize.green(sampledFiles.length)} files for deep analysis`);
    
    let tasks;
    
    if (generatePRD) {
      // Generate PRD and then use it to generate tasks
      const prdPath = await generatePRDFromCodeAnalysis(sampledFiles, workspacePath);
      log(`Using generated PRD to create tasks via parse-prd...`);
      
      // Create tasks directory if it doesn't exist
      const tasksDir = path.dirname(outputPath);
      if (!fs.existsSync(tasksDir)) {
        await mkdir(tasksDir, { recursive: true });
      }
      
      // Use the parsePRD function to generate tasks from the PRD
      tasks = await parsePRD(prdPath, outputPath, numTasks);
      log(`Generated ${colorize.green(tasks.length)} tasks from PRD`);
    } else {
      // Use direct codebase analysis to generate tasks (original approach)
      tasks = await generateTasksFromCodeAnalysis(sampledFiles);
      log(`Generated ${colorize.green(tasks.length)} tasks from codebase analysis`);
      
      // Validate generated tasks
      const validatedTasks = validateTasks(tasks);
      
      // Save tasks to file
      if (outputPath) {
        await saveTasksToFile(validatedTasks, outputPath);
        log(`Tasks saved to ${colorize.green(outputPath)}`);
      }
      
      tasks = validatedTasks;
    }
    
    return tasks;
  } catch (err) {
    log('error', `Workspace scanning failed: ${err.message}`);
    throw err;
  }
}