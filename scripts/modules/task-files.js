/**
 * Task Files Module
 * 
 * This module provides functionality for generating individual task files
 * from the tasks.json data.
 */

import fs from 'fs';
import path from 'path';
import { log, readJSON } from './utils.js';

/**
 * Format dependencies with their status
 * @param {Array} dependencies - Array of task IDs
 * @param {Array} allTasks - All tasks data
 * @param {boolean} forConsole - Whether to format for console display
 * @returns {string} - Formatted dependencies string
 */
function formatDependenciesWithStatus(dependencies, allTasks, forConsole = false) {
  if (!dependencies || dependencies.length === 0) {
    return 'None';
  }

  // Convert to an array if it's not already
  const deps = Array.isArray(dependencies) ? dependencies : [dependencies];
  
  // Map each dependency to its string representation
  return deps.map(depId => {
    // Convert to string for comparison
    const strDepId = String(depId);
    
    // Check if this is a subtask dependency (contains a dot)
    if (strDepId.includes('.')) {
      const [parentId, subtaskId] = strDepId.split('.').map(id => isNaN(id) ? id : Number(id));
      
      // Find the parent task
      const parentTask = allTasks.find(t => String(t.id) === String(parentId));
      if (!parentTask || !parentTask.subtasks) {
        return `${strDepId} (not found)`;
      }
      
      // Find the specific subtask
      const subtask = parentTask.subtasks.find(s => String(s.id) === String(subtaskId));
      if (!subtask) {
        return `${strDepId} (not found)`;
      }
      
      // Get the status icon
      const statusIcon = subtask.status === 'done' ? '✅' : '⏱️';
      return forConsole ? `${statusIcon} ${strDepId} (${subtask.title})` : `${statusIcon} ${strDepId}`;
    } 
    // Regular task dependency
    else {
      // Find the dependency task
      const depTask = allTasks.find(t => String(t.id) === String(depId));
      if (!depTask) {
        return `${depId} (not found)`;
      }
      
      // Get the status icon
      const statusIcon = depTask.status === 'done' ? '✅' : '⏱️';
      return forConsole ? `${statusIcon} ${depId} (${depTask.title})` : `${statusIcon} ${depId}`;
    }
  }).join(', ');
}

/**
 * Generate individual task files from tasks.json
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} outputDir - Directory to output task files
 */
export async function generate(tasksPath, outputDir) {
  log('info', `Reading tasks from ${tasksPath}...`);
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    throw new Error("No valid tasks to generate files for.");
  }
  
  log('info', `Found ${data.tasks.length} tasks to generate files for.`);
  
  // Ensure the output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  log('info', "Generating individual task files...");
  data.tasks.forEach(task => {
    const filename = `task_${String(task.id).padStart(3, '0')}.txt`;
    const filepath = path.join(outputDir, filename);

    // Create the base content
    const contentParts = [
      `# Task ID: ${task.id}`,
      `# Title: ${task.title}`,
      `# Status: ${task.status}`,
      `# Dependencies: ${formatDependenciesWithStatus(task.dependencies, data.tasks, false)}`,
      `# Priority: ${task.priority}`,
      `# Description: ${task.description}`,
      `# Details:\n${task.details}\n`,
      `# Test Strategy:`,
      `${task.testStrategy}\n`
    ];
    
    // Add subtasks if they exist
    if (task.subtasks && task.subtasks.length > 0) {
      contentParts.push(`# Subtasks:`);
      task.subtasks.forEach(subtask => {
        // Format subtask dependencies correctly by converting numeric IDs to parent.subtask format
        let formattedDeps = [];
        if (subtask.dependencies && subtask.dependencies.length > 0) {
          // Format each dependency
          formattedDeps = subtask.dependencies.map(depId => {
            // If it already has a dot notation (e.g. "1.2"), keep it as is
            if (typeof depId === 'string' && depId.includes('.')) {
              // Validate that this subtask dependency actually exists
              const [parentId, subId] = depId.split('.').map(id => isNaN(id) ? id : Number(id));
              const parentTask = data.tasks.find(t => t.id === parentId);
              if (!parentTask || !parentTask.subtasks || !parentTask.subtasks.some(s => s.id === Number(subId))) {
                log('warn', `Skipping non-existent subtask dependency: ${depId}`);
                return null;
              }
              return depId;
            } 
            // If it's a number, it's probably referencing a parent subtask in the same task
            // Format it as "parentTaskId.subtaskId"
            else if (typeof depId === 'number') {
              // Check if this is likely a subtask ID (small number) within the same parent task
              if (depId < 100) { // Assume subtask IDs are small numbers
                // Validate that this subtask exists
                if (!task.subtasks.some(s => s.id === depId)) {
                  log('warn', `Skipping non-existent subtask dependency: ${task.id}.${depId}`);
                  return null;
                }
                return `${task.id}.${depId}`;
              } else {
                // It's a reference to another task - validate it exists
                if (!data.tasks.some(t => t.id === depId)) {
                  log('warn', `Skipping non-existent task dependency: ${depId}`);
                  return null;
                }
                return depId;
              }
            }
            return depId;
          }).filter(dep => dep !== null); // Remove null entries (invalid dependencies)
        }
        
        const subtaskDeps = formattedDeps.length > 0
          ? formatDependenciesWithStatus(formattedDeps, data.tasks, false)
          : "None";
          
        contentParts.push(`## Subtask ID: ${subtask.id}`);
        contentParts.push(`## Title: ${subtask.title}`);
        contentParts.push(`## Status: ${subtask.status}`);
        contentParts.push(`## Dependencies: ${subtaskDeps}`);
        contentParts.push(`## Description: ${subtask.description}`);
        if (subtask.acceptanceCriteria) {
          contentParts.push(`## Acceptance Criteria:\n${subtask.acceptanceCriteria}\n`);
        }
      });
    }

    const content = contentParts.join('\n');
    fs.writeFileSync(filepath, content, 'utf8');
    log('info', `Generated: ${filename}`);
  });

  log('info', `All ${data.tasks.length} tasks have been generated into '${outputDir}'.`);
  return true;
}

// Export the main generate function
export default { generate }; 