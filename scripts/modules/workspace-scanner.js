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
import { log, archiveTasksBeforeOverwrite } from './utils.js';
import chalk from 'chalk';
import { writeJSON } from './utils.js';
import readline from 'readline';

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
  // Check if tasks file already exists and archive it if needed
  if (fs.existsSync(outputPath)) {
    const archiveResult = archiveTasksBeforeOverwrite(outputPath);
    if (!archiveResult.success) {
      log('warn', `Could not archive existing tasks file: ${archiveResult.error}. Proceeding with overwrite.`);
    } else if (archiveResult.archived) {
      log('info', `Existing tasks file has been archived to ${archiveResult.archivePath}`);
    }
  }

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
 * Split sampled files into smaller batches for parallel processing
 * @param {Array<Object>} sampledFiles - Array of file analysis results 
 * @param {number} batchSize - Number of files per batch
 * @returns {Array<Array<Object>>} - Array of file batches
 */
function createFileBatches(sampledFiles, batchSize = 5) {
  const batches = [];
  for (let i = 0; i < sampledFiles.length; i += batchSize) {
    batches.push(sampledFiles.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Process file batches in parallel to generate partial analyses
 * @param {Array<Array<Object>>} batches - Array of file batches
 * @param {Function} updateProgressFn - Progress update function
 * @returns {Promise<Array<string>>} - Array of partial analyses
 */
async function processFileBatchesInParallel(batches, workspacePath, updateProgressFn) {
  const batchPromises = batches.map(async (batch, index) => {
    if (updateProgressFn) {
      updateProgressFn(
        8, // Using a higher step number to keep existing steps intact
        `Processing batch ${index + 1} of ${batches.length}`
      );
    }
    
    // Create a simplified summary for this batch
    const fileCount = batch.length;
    const fileStructure = batch.map(file => file.path).join('\n');
    
    // Count file extensions
    const extensions = {};
    batch.forEach(file => {
      const ext = file.ext;
      if (ext) {
        extensions[ext] = (extensions[ext] || 0) + 1;
      }
    });
    
    const extSummary = Object.entries(extensions)
      .map(([ext, count]) => `${ext}: ${count} files`)
      .join('\n');
    
    // Create a sample of file contents
    const fileContentSample = batch
      .map(file => {
        if (file.content) {
          return `--- FILE: ${file.path} ---\n${file.content.substring(0, 1000)}${file.content.length > 1000 ? '...(truncated)' : ''}\n`;
        }
        return `--- FILE: ${file.path} ---\n(Error reading file: ${file.error})\n`;
      })
      .join('\n');
    
    try {
      // Define a retry callback for this batch
      const onRetryCallback = (retryCount, delayMs, error) => {
        if (updateProgressFn) {
          updateProgressFn(
            8,
            `Batch ${index + 1}: Retry ${retryCount} needed. Waiting ${Math.round(delayMs/1000)}s...`
          );
        }
      };
      
      // Process this batch with improved retry behavior
      const response = await callLLMWithRetry({
        system: 'You are analyzing a batch of code files to identify patterns, technologies, and potential improvements.',
        messages: [
          { 
            role: 'user', 
            content: `Analyze this batch of files and provide a thorough analysis covering:

BATCH SUMMARY:
- Files in batch: ${fileCount}
- File extensions:
${extSummary}

FILE STRUCTURE:
${fileStructure}

FILE CONTENTS:
${fileContentSample}

Provide an analysis that covers:
1. Technologies and frameworks identified
2. Architecture patterns observed
3. Specific improvement areas
4. Feature opportunities
5. Code quality observations
6. Potential refactoring needs
7. Dependencies and libraries in use

Focus on being detailed, specific, and actionable. This is just one batch of files from a larger codebase.`
          }
        ],
        max_tokens: 2000, // Smaller output size for faster processing
        temperature: 0.2,
        retries: 2, // Fewer retries for parallel operations
        onRetry: onRetryCallback,
        fastFail: true // Fail quickly on permanent errors
      });
      
      return response.content;
    } catch (error) {
      log('error', `Error processing batch ${index + 1}: ${error.message}`);
      return `Batch ${index + 1} analysis failed: ${error.message}`;
    }
  });
  
  // Process batches with some concurrency control
  // Instead of using Promise.all, we'll process in smaller concurrent groups
  const concurrencyLimit = 3; // Increased from 2 to 3 for better parallelism
  const results = [];
  
  // Process batches at limited concurrency to balance performance and reliability
  try {
    for (let i = 0; i < batches.length; i += concurrencyLimit) {
      // Slice the current batch group
      const batchGroup = batches.slice(i, i + concurrencyLimit);
      const groupPromises = batchPromises.slice(i, i + concurrencyLimit);
      
      if (updateProgressFn) {
        updateProgressFn(
          8,
          `Processing batch group ${Math.floor(i/concurrencyLimit) + 1} of ${Math.ceil(batches.length/concurrencyLimit)}`
        );
      }
      
      // Add timeout to each promise to avoid hanging
      const timeoutPromises = groupPromises.map(promise => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Batch processing timeout after 60s')), 60000)
          )
        ]);
      });
      
      // Process this batch group in parallel
      try {
        const groupResults = await Promise.all(timeoutPromises);
        results.push(...groupResults);
      } catch (batchError) {
        // If one batch fails, log the error but continue with other batches
        log('error', `Error in batch group ${Math.floor(i/concurrencyLimit) + 1}: ${batchError.message}`);
        
        // For each promise in the group, try to resolve it individually to salvage partial results
        for (let j = 0; j < groupPromises.length; j++) {
          try {
            // Add a short delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
            const result = await Promise.race([
              groupPromises[j],
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Individual batch timeout')), 30000)
              )
            ]);
            results.push(result);
          } catch (individualError) {
            // If individual retry fails, add a placeholder result
            log('warn', `Could not process batch ${i + j + 1}: ${individualError.message}`);
            results.push(`Batch ${i + j + 1} analysis failed: ${individualError.message}`);
          }
        }
      }
      
      // Add a small delay between batch groups to avoid rate limits
      if (i + concurrencyLimit < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (processError) {
    log('error', `Error in batch processing: ${processError.message}`);
    
    // If overall process fails, try sequential processing as a fallback
    if (results.length < batches.length / 2) {
      log('info', 'Falling back to sequential processing for remaining batches');
      
      for (let i = results.length; i < batches.length; i++) {
        try {
          // Add a short delay between sequential calls
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (updateProgressFn) {
            updateProgressFn(8, `Sequential fallback: processing batch ${i + 1} of ${batches.length}`);
          }
          
          // Process with a longer timeout
          const result = await Promise.race([
            batchPromises[i],
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Sequential batch timeout')), 45000)
            )
          ]);
          results.push(result);
        } catch (fallbackError) {
          log('warn', `Sequential fallback failed for batch ${i + 1}: ${fallbackError.message}`);
          results.push(`Batch ${i + 1} analysis failed: ${fallbackError.message}`);
        }
      }
    }
  }
  
  return results;
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
      system: 'You are a software development expert that analyzes code and suggests improvements.',
      messages: [
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
 * Generates a PRD document from code analysis
 * @param {Array<Object>} sampledFiles - Sampled files to analyze
 * @param {string} workspacePath - Path to the workspace
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Path to the generated PRD file
 */
async function generatePRDFromCodeAnalysis(sampledFiles, workspacePath, options = {}) {
  try {
    const { force = false, useParallel = true } = options;
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
    
    // Enhanced progress tracking function
    let currentStep = 0;
    const totalSteps = 10; // Increasing step granularity for more detailed updates
    
    // Define more detailed steps for PRD generation to provide finer-grained progress updates
    const prdGenerationSteps = [
      'Analyzing code patterns and structure',
      'Identifying project architecture',
      'Detecting technology stack and dependencies',
      'Analyzing code organization and patterns',
      'Formulating feature requirements',
      'Identifying improvement opportunities',
      'Creating implementation specifications',
      'Organizing requirements hierarchy',
      'Structuring comprehensive PRD document',
      'Finalizing and optimizing output'
    ];
    
    // Update progress reporting function for the LLM call
    const updateProgressDuringGeneration = options.reportProgress ? (step, detail) => {
      currentStep = step;
      if (options.reportProgress) {
        options.reportProgress({
          phase: 5,
          message: 'Generating Product Requirements Document',
          detail: `${prdGenerationSteps[step]}: ${detail || ''}`,
          progress: 50 + Math.floor((step / totalSteps) * 15) // 50-65% progress range
        });
      }
    } : null;
    
    // Initial progress update
    if (updateProgressDuringGeneration) {
      updateProgressDuringGeneration(0, 'Starting analysis of sampled code files');
    }
    
    let prdContent;
    
    if (useParallel && fileCount > 5) {
      // Use parallel processing for larger codebases
      if (updateProgressDuringGeneration) {
        updateProgressDuringGeneration(1, 'Splitting codebase into smaller batches for parallel analysis');
      }
      
      // Create batches of files for parallel processing
      const batches = createFileBatches(sampledFiles, 5);
      
      if (updateProgressDuringGeneration) {
        updateProgressDuringGeneration(2, `Created ${batches.length} batches for parallel processing`);
      }
      
      // Process batches in parallel
      const batchAnalyses = await processFileBatchesInParallel(batches, workspacePath, updateProgressDuringGeneration);
      
      if (updateProgressDuringGeneration) {
        updateProgressDuringGeneration(8, 'Combining batch analyses into comprehensive PRD');
      }
      
      // Fast path: For small codebases (3 or fewer batches), use a direct approach
      if (batchAnalyses.length <= 3) {
        log('info', 'Small analysis dataset, using direct PRD generation');
        
        // Combine all batches into a single analysis for faster processing
        const combinedBatchContent = batchAnalyses.join('\n\n');
        
        // Process with timeout
        try {
          const timeoutMs = 45000; // 45 second timeout
          const combinedResponse = await Promise.race([
            callLLMWithRetry({
              system: 'You are a technical writer creating a concise PRD document.',
              messages: [{
                role: 'user',
                content: `Create a concise Product Requirements Document based on these code analyses:

ANALYSES:
${combinedBatchContent}

Create a brief PRD with:
1. Project overview
2. Core technology identification
3. Key requirements only, organized by category
4. Make it concise but comprehensive`
              }],
              max_tokens: 4000,
              temperature: 0.2
            }),
            // Timeout promise
            new Promise((resolve) => {
              setTimeout(() => {
                log('warn', `Direct PRD generation timed out after ${timeoutMs}ms`);
                resolve({ 
                  content: `# Project Requirements Document\n\n## Overview\nThis document captures key requirements identified from codebase analysis.\n\n## Requirements\n1. Implement core functionality\n2. Improve error handling\n3. Add proper documentation\n4. Enhance test coverage` 
                });
              }, timeoutMs);
            })
          ]);
          
          prdContent = combinedResponse?.content || 'PRD generation failed.';
        } catch (error) {
          log('error', `Error in direct PRD generation: ${error.message}`);
          prdContent = `# Project Requirements Document\n\n## Overview\nThis document captures key requirements identified from codebase analysis.\n\n## Requirements\n1. Implement core functionality\n2. Improve error handling\n3. Add proper documentation\n4. Enhance test coverage`;
        }
      } else {
        // Original approach for larger codebases
        try {
          const timeoutMs = 60000; // 60 second timeout
          const combinedAnalysis = await Promise.race([
            callLLMWithRetry({
              system: 'You are an expert software architect and product manager synthesizing multiple code analyses into a comprehensive PRD.',
              messages: [
                {
                  role: 'user',
                  content: `Synthesize these ${batches.length} separate code analysis results into a comprehensive PRD document.

CODEBASE SUMMARY:
- Total files analyzed: ${fileCount}
- File extensions found:
${extSummary}

FILE STRUCTURE OVERVIEW:
${fileStructure.substring(0, 500)}...

BATCH ANALYSES:
${batchAnalyses.map((analysis, index) => `--- BATCH ${index + 1} ANALYSIS ---\n${analysis}\n`).join('\n')}

Create a unified Product Requirements Document (PRD) in plain text format that:
1. Starts with a high-level overview of the project based on all analyses
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
            }),
            // Timeout promise
            new Promise((resolve) => {
              setTimeout(() => {
                log('warn', `PRD generation timed out after ${timeoutMs}ms`);
                resolve({ 
                  content: `# Project Requirements Document\n\n## Overview\nThis document captures the key requirements identified from the codebase analysis. The analysis was limited due to processing time constraints.\n\n## Requirements\n1. Implement core functionality based on identified patterns\n2. Improve error handling and validation\n3. Enhance documentation and code comments\n4. Add comprehensive test coverage\n5. Optimize performance bottlenecks\n6. Address technical debt\n7. Improve user experience` 
                });
              }, timeoutMs);
            })
          ]);
          
          prdContent = combinedAnalysis?.content || 'PRD generation failed.';
        } catch (error) {
          log('error', `Error in PRD generation: ${error.message}`);
          prdContent = `# Project Requirements Document\n\n## Overview\nThis document captures the key requirements identified from the codebase analysis.\n\n## Requirements\n1. Implement core functionality based on identified patterns\n2. Improve error handling and validation\n3. Enhance documentation and code comments\n4. Add comprehensive test coverage\n5. Optimize performance bottlenecks\n6. Address technical debt\n7. Improve user experience`;
        }
      }
    } else {
      // Use single call for smaller codebases
      // Set up a timer to provide updates during the long API call
      let progressInterval;
      let subPhaseDetails = [
        'Examining code structure and organization',
        'Identifying file relationships and dependencies',
        'Analyzing naming conventions and coding patterns',
        'Detecting frameworks and libraries in use',
        'Evaluating architecture patterns and components',
        'Identifying database models and schemas',
        'Analyzing API endpoints and interfaces',
        'Evaluating test coverage and patterns',
        'Identifying potential improvements and features',
        'Formulating implementation recommendations',
        'Structuring requirements documentation',
        'Finalizing specifications and organization'
      ];
      
      if (updateProgressDuringGeneration) {
        // Track time for more accurate updates
        const startTime = Date.now();
        const estimatedTotalTime = 120000; // 2 minutes estimate
        
        progressInterval = setInterval(() => {
          // More intelligent progress tracking
          const elapsedTime = Date.now() - startTime;
          const estimatedProgress = Math.min(Math.floor((elapsedTime / estimatedTotalTime) * 100), 95);
          
          // Don't increment beyond our steps
          if (currentStep < totalSteps - 1) {
            // Calculate which step we should be in based on elapsed time
            const targetStep = Math.min(
              Math.floor((elapsedTime / estimatedTotalTime) * totalSteps),
              totalSteps - 1
            );
            
            // Only update if we're moving to a new step
            if (targetStep > currentStep) {
              currentStep = targetStep;
              
              // Get an appropriate detail message
              const subPhaseIndex = Math.min(
                Math.floor(elapsedTime / 10000) % subPhaseDetails.length,
                subPhaseDetails.length - 1
              );
              
              updateProgressDuringGeneration(
                currentStep,
                subPhaseDetails[subPhaseIndex]
              );
            } else {
              // If we're still in the same step, rotate through detail messages
              const subPhaseIndex = Math.floor(elapsedTime / 10000) % subPhaseDetails.length;
              updateProgressDuringGeneration(
                currentStep,
                `${subPhaseDetails[subPhaseIndex]} (${Math.floor(estimatedProgress)}% complete)`
              );
            }
          }
        }, 5000); // Update every 5 seconds for more responsive progress
      }
      
      try {
        // Update the constructor for the callLLMWithProgressUpdates function
        const callLLMWithProgressUpdates = async (options) => {
          // Track the start time of the API call process
          const apiStartTime = Date.now();
          
          // Helper function to format elapsed time
          const getElapsedTimeString = () => {
            const elapsed = Date.now() - apiStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
          };
          
          if (updateProgressDuringGeneration) {
            updateProgressDuringGeneration(
              totalSteps - 1,
              `Preparing to generate PRD from codebase...`
            );
          }
          
          // Define a callback for retry events
          const retryCallback = (retryCount, delayMs, error) => {
            if (updateProgressDuringGeneration) {
              updateProgressDuringGeneration(
                totalSteps - 1,
                `Retry ${retryCount} needed after error: ${error.message}. Waiting ${Math.round(delayMs/1000)}s... (Elapsed: ${getElapsedTimeString()})`
              );
            }
          };
          
          try {
            // Add our custom callback to the options
            const enhancedOptions = {
              ...options,
              onRetry: retryCallback,
              fastFail: true // Fail immediately on permanent errors
            };
            
            // Display initial status
            if (updateProgressDuringGeneration) {
              updateProgressDuringGeneration(
                totalSteps - 1,
                `Sending request to Claude API... (Elapsed: ${getElapsedTimeString()})`
              );
            }
            
            // Use the enhanced callLLMWithRetry that now supports the callback
            const response = await callLLMWithRetry(enhancedOptions);
            
            // Success! Update UI
            if (updateProgressDuringGeneration) {
              updateProgressDuringGeneration(
                totalSteps - 1,
                `Successfully generated PRD (Elapsed: ${getElapsedTimeString()})`
              );
            }
            
            return response;
          } catch (error) {
            // Final error after all retries
            if (updateProgressDuringGeneration) {
              updateProgressDuringGeneration(
                totalSteps - 1,
                `Failed to generate PRD after multiple attempts: ${error.message} (Elapsed: ${getElapsedTimeString()})`
              );
            }
            throw error;
          }
        };
        
        const response = await callLLMWithProgressUpdates({
          system: 'You are an expert software architect and product manager. You analyze codebases and create detailed PRDs (Product Requirements Documents) that outline improvements and feature implementations.',
          messages: [
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
        
        prdContent = response.content;
        
        // Clear the interval if it exists
        if (progressInterval) {
          clearInterval(progressInterval);
        }
      } catch (err) {
        // Clear the interval if it exists
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        throw err;
      }
    }
    
    // Ensure scripts directory exists
    const scriptsDir = path.join(workspacePath, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      await mkdir(scriptsDir, { recursive: true });
    }
    
    // Save the PRD to a file
    const prdPath = path.join(scriptsDir, 'prd.txt');
    
    // Archive existing PRD if it exists
    if (fs.existsSync(prdPath)) {
      // Check for force overwrite flag
      const confirmOverwrite = process.env.FORCE_OVERWRITE === 'true' || force === true;
      
      if (!confirmOverwrite) {
        // Check if we're in a non-interactive environment
        const isNonInteractive = !process.stdin.isTTY;
        
        if (isNonInteractive) {
          // In non-interactive environments, we can't prompt, so throw the error
          throw new Error(`PRD file already exists at ${prdPath}. Use --force or set FORCE_OVERWRITE=true to overwrite.`);
        }
        
        // For interactive environments, ask the user for confirmation
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        try {
          const answer = await new Promise((resolve) => {
            rl.question(`PRD file already exists at ${prdPath}. Overwrite? (y/N): `, (answer) => {
              resolve(answer.toLowerCase());
              rl.close();
            });
          });
          
          if (answer !== 'y' && answer !== 'yes') {
            log('info', 'PRD generation cancelled by user.');
            return prdPath; // Return path but don't overwrite
          }
          
          // User confirmed overwrite
          log('info', 'User confirmed overwrite of existing PRD file.');
        } catch (promptErr) {
          // If there's an error with the prompt, fall back to the original error
          throw new Error(`PRD file already exists at ${prdPath}. Use --force or set FORCE_OVERWRITE=true to overwrite.`);
        }
      }
      
      const archiveResult = archiveTasksBeforeOverwrite(prdPath);
      if (!archiveResult.success) {
        log('warn', `Could not archive existing PRD file: ${archiveResult.error}. Proceeding with overwrite.`);
      } else if (archiveResult.archived) {
        log('info', `Existing PRD file has been archived to ${archiveResult.archivePath}`);
      }
    }
    
    // Ensure response.content is a string before writing to file
    let contentToWrite = prdContent;
    if (Array.isArray(contentToWrite)) {
      // If it's an array, join it or take the first element if it contains text content
      if (contentToWrite.length > 0 && contentToWrite[0] && typeof contentToWrite[0].text === 'string') {
        contentToWrite = contentToWrite.map(item => item.text || '').join('\n');
      } else {
        // Fallback to JSON stringify if array structure is unexpected
        contentToWrite = JSON.stringify(contentToWrite, null, 2);
      }
    } else if (typeof contentToWrite !== 'string') {
      // Convert any non-string to string representation
      contentToWrite = String(contentToWrite);
    }
    
    await writeFile(prdPath, contentToWrite);
    log(`Generated PRD saved to ${colorize.green(prdPath)}`);
    
    return prdPath;
  } catch (err) {
    log('error', `Error generating PRD: ${err.message}`);
    throw err;
  }
}

/**
 * Helper function to intelligently merge incremental PRD sections
 * @param {string} existingPRD - The current PRD content
 * @param {string} newContent - New content to merge in
 * @returns {string} - The merged PRD content
 */
function mergeIncrementalPRD(existingPRD, newContent) {
  // Ensure existingPRD is a string
  if (typeof existingPRD !== 'string') {
    console.error('Warning: existingPRD is not a string, converting to string');
    existingPRD = String(existingPRD || '');
  }
  
  // Ensure newContent is a string
  if (typeof newContent !== 'string') {
    console.error('Warning: newContent is not a string, converting to string');
    newContent = String(newContent || '');
  }
  
  // If either is empty, return the other
  if (!existingPRD.trim()) return newContent;
  if (!newContent.trim()) return existingPRD;
  
  // Split content into sections (typically marked by headers)
  const existingSections = existingPRD.split(/\n(?=#+\s|[0-9]+\.\s[A-Z])/);
  const newSections = newContent.split(/\n(?=#+\s|[0-9]+\.\s[A-Z])/);
  
  // Extract headers to check for duplicates
  const existingHeaders = existingSections.map(section => {
    const match = section.match(/^(#+\s.+|[0-9]+\.\s[A-Z].+?)(?:\n|$)/);
    return match ? match[0].trim() : null;
  }).filter(Boolean);
  
  // Filter out duplicate sections from new content
  const uniqueNewSections = newSections.filter(section => {
    const match = section.match(/^(#+\s.+|[0-9]+\.\s[A-Z].+?)(?:\n|$)/);
    const header = match ? match[0].trim() : null;
    
    // Keep sections without headers or with unique headers
    return !header || !existingHeaders.some(existing => 
      existing.toLowerCase().includes(header.toLowerCase()) || 
      header.toLowerCase().includes(existing.toLowerCase())
    );
  });
  
  // Combine intelligently - find natural break points in the existing PRD
  const mainSections = existingPRD.split(/\n(?=# )/);
  
  // If we can identify sections, insert new content before the conclusion
  if (mainSections.length > 1) {
    const lastSection = mainSections.pop();
    if (lastSection.toLowerCase().includes('conclusion') || 
        lastSection.toLowerCase().includes('summary')) {
      return [...mainSections, ...uniqueNewSections, lastSection].join('\n');
    }
  }
  
  // Default: simply append the unique new sections
  return existingPRD + '\n\n' + uniqueNewSections.join('\n');
}

/**
 * Main function to scan a workspace and generate tasks
 * @param {string} workspacePath - Path to the workspace to scan
 * @param {Object} options - Additional options
 * @param {Function} reportProgress - Optional callback for reporting progress
 * @returns {Promise<Array<Object>>} - Generated tasks
 */
export async function scanWorkspace(workspacePath, options = {}, reportProgress = null) {
  const {
    fileTypes = ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.java', '.php', '.rb', '.cs', '.cpp', '.c', '.html', '.css', '.json'],
    ignoreDirs = ['.git', 'node_modules', 'dist', 'build', 'vendor', 'bin'],
    outputPath = 'tasks/tasks.json',
    maxFiles = 20,
    maxSizePerFile = 5000,
    numTasks = 15,
    generatePRD = true, // Option to control PRD generation
    force = false, // Option to force overwrite existing files
    useParallel = false, // Option to use parallel processing
    cliMode = false // New option for CLI mode
  } = options;
  
  // CLI-specific progress reporting setup
  let cliProgressBar = null;
  let lastPhase = null;
  
  // Enhanced CLI progress reporter that formats output for the terminal
  const cliReportProgress = (data) => {
    const { phase, message, detail, progress } = data;
    
    // Define symbols for different phases
    const symbols = {
      'init': '🔍',
      'fileDiscovery': '📁',
      'fileAnalysis': '📄',
      'sampling': '📊',
      'prdGeneration': '📝',
      'aiAnalysis': '🧠',
      'taskGeneration': '✅',
      'finalization': '📦',
      'complete': '✨',
      'error': '❌'
    };
    
    // Clear previous line if we're in CLI mode and not in a new phase
    if (cliMode && process.stdout.clearLine) {
      // If phase changed, add a newline
      if (lastPhase !== phase) {
        console.log(); // Add a newline
        lastPhase = phase;
      } else {
        // Otherwise overwrite the current line
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
      }
    }
    
    // Create a progress bar
    const progressBar = cliMode ? createCliProgressBar(progress || 0, 30) : '';
    
    // Format the output message
    const symbol = symbols[phase] || '•';
    const progressPrefix = cliMode ? `${symbol} ` : '';
    const progressSuffix = cliMode ? ` ${progressBar} ${progress || 0}%` : '';
    
    // Make sure we have valid values for message and detail to avoid undefined
    const safeMessage = message || `Processing ${phase} phase`;
    const safeDetail = detail || '';
    
    // Log the progress message
    if (cliMode) {
      // Format for CLI output (no newline to allow overwriting)
      process.stdout.write(`${progressPrefix}${safeMessage}${progressSuffix}`);
      
      // Add detail on the next line if provided
      if (safeDetail && process.stdout.clearLine) {
        process.stdout.write(`\n  → ${safeDetail}`);
        process.stdout.cursorTo(0);
      }
    } else {
      // Use normal logging for non-CLI mode
      log(`[${phase}] ${safeMessage} - ${progress || 0}%`);
      if (safeDetail) {
        log(`  Detail: ${safeDetail}`);
      }
    }
    
    // Call original progress reporter if provided
    if (reportProgress) {
      reportProgress(data);
    }
  };
  
  // Helper function to create a CLI progress bar
  function createCliProgressBar(percent, width) {
    const completed = Math.floor(width * (percent / 100));
    return '[' + '='.repeat(completed) + ' '.repeat(width - completed) + ']';
  }
  
  // Use CLI progress reporter when in CLI mode, otherwise use the provided reportProgress
  const enhancedReportProgress = cliMode ? cliReportProgress : reportProgress;
  
  // Log parallel processing mode if enabled
  if (useParallel) {
    log('info', 'Using parallel processing mode for faster file analysis');
  }
  
  try {
    // Enhanced status messages
    const statusMessages = {
      init: 'Initializing workspace scanner',
      fileDiscovery: 'Discovering code files and directories',
      fileAnalysis: 'Reading and analyzing file contents',
      sampling: 'Sampling representative files for analysis',
      prdGeneration: 'Creating comprehensive requirements document',
      aiAnalysis: 'Performing AI analysis of code patterns',
      taskGeneration: 'Converting analysis into actionable tasks',
      finalization: 'Finalizing and saving outputs',
      complete: 'Scan completed successfully'
    };
    
    // Report initial progress with enhanced message
    if (enhancedReportProgress) {
      enhancedReportProgress({
        phase: 'init',
        message: statusMessages.init,
        detail: `Validating workspace: ${workspacePath}`,
        progress: 5
      });
    }
    
    // Validate workspace path
    const workspaceStats = await stat(workspacePath);
    if (!workspaceStats.isDirectory()) {
      throw new Error(`Workspace path is not a directory: ${workspacePath}`);
    }
    
    log(`Scanning workspace: ${colorize.yellow(workspacePath)}`);
    
    // Update progress
    if (enhancedReportProgress) {
      enhancedReportProgress({
        phase: 'fileDiscovery',
        message: statusMessages.fileDiscovery,
        detail: `Finding code files in ${path.basename(workspacePath)}`,
        progress: 15
      });
    }
    
    // Find all matching files
    const filePaths = await scanDirectory(workspacePath, fileTypes, ignoreDirs);
    log(`Found ${colorize.green(filePaths.length)} files to analyze`);
    
    // Update progress
    if (enhancedReportProgress) {
      enhancedReportProgress({
        phase: 'fileAnalysis',
        message: statusMessages.fileAnalysis,
        detail: `Processing ${filePaths.length} files`,
        progress: 30
      });
    }
    
    // Analyze files in parallel
    const fileAnalysisPromises = filePaths.map(filePath => analyzeFile(filePath));
    const fileAnalysisResults = await Promise.all(fileAnalysisPromises);
    
    // Update progress
    if (enhancedReportProgress) {
      enhancedReportProgress({
        phase: 'sampling',
        message: statusMessages.sampling,
        detail: 'Sampling files for deep analysis',
        progress: 50
      });
    }
    
    // Sample files to keep within token limits
    const sampledFiles = sampleFiles(fileAnalysisResults, maxFiles, maxSizePerFile);
    log(`Sampled ${colorize.green(sampledFiles.length)} files for deep analysis`);
    
    let tasks;
    
    if (generatePRD) {
      // Update progress with enhanced message
      if (enhancedReportProgress) {
        enhancedReportProgress({
          phase: 'prdGeneration',
          message: statusMessages.prdGeneration,
          detail: 'Preparing code samples for AI analysis',
          progress: 65
        });
      }
      
      // Generate PRD and then use it to generate tasks with progress reporting
      const prdPath = await generatePRDFromCodeAnalysis(sampledFiles, workspacePath, { 
        force, 
        reportProgress,
        useParallel 
      });
      
      log(`Using generated PRD to create tasks via parse-prd...`);
      
      // Update progress with enhanced message
      if (enhancedReportProgress) {
        enhancedReportProgress({
          phase: 'taskGeneration',
          message: statusMessages.taskGeneration,
          detail: 'Extracting actionable tasks from PRD requirements',
          progress: 80
        });
      }
      
      // Create tasks directory if it doesn't exist
      const tasksDir = path.dirname(outputPath);
      if (!fs.existsSync(tasksDir)) {
        await mkdir(tasksDir, { recursive: true });
      }
      
      // Use the parsePRD function to generate tasks from the PRD
      tasks = await parsePRD(prdPath, outputPath, numTasks, { force }, null, {});
      log(`Generated ${colorize.green(tasks.length)} tasks from PRD`);
    } else {
      // Update progress
      if (enhancedReportProgress) {
        enhancedReportProgress({
          phase: 'aiAnalysis',
          message: statusMessages.aiAnalysis,
          detail: 'Identifying implementation needs',
          progress: 65
        });
      }
      
      // Use direct codebase analysis to generate tasks (original approach)
      tasks = await generateTasksFromCodeAnalysis(sampledFiles);
      log(`Generated ${colorize.green(tasks.length)} tasks from codebase analysis`);
      
      // Update progress
      if (enhancedReportProgress) {
        enhancedReportProgress({
          phase: 'finalization',
          message: statusMessages.finalization,
          detail: 'Validating and saving task data',
          progress: 80
        });
      }
      
      // Validate generated tasks
      const validatedTasks = validateTasks(tasks);
      
      // Save tasks to file
      if (outputPath) {
        await saveTasksToFile(validatedTasks, outputPath);
        log(`Tasks saved to ${colorize.green(outputPath)}`);
      }
      
      tasks = validatedTasks;
    }
    
    // Final progress update with enhanced message
    if (enhancedReportProgress) {
      // Make sure we have a valid task count to display
      const taskCount = Array.isArray(tasks) ? tasks.length : 0;
      
      enhancedReportProgress({
        phase: 'complete',
        message: statusMessages.complete,
        detail: `Successfully generated ${taskCount} tasks from workspace analysis`,
        progress: 100
      });
      
      // Add a newline at the end in CLI mode
      if (cliMode && process.stdout.write) {
        console.log(); // End with a newline
      }
    }
    
    return tasks;
  } catch (err) {
    // Report error in progress with enhanced message
    if (enhancedReportProgress) {
      enhancedReportProgress({
        phase: 'error',
        message: 'Error scanning workspace',
        detail: `${err.message} - Try running with --debug for more information`,
        progress: 100
      });
      
      // Add a newline at the end in CLI mode
      if (cliMode && process.stdout.write) {
        console.log(); // End with a newline
      }
    }
    
    log('error', `Workspace scanning failed: ${err.message}`);
    throw err;
  }
}