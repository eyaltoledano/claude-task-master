/**
 * github.js
 * Export tasks to GitHub issues
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { startLoadingIndicator, stopLoadingIndicator } from '../../ui.js';
import { log as consoleLog } from '../../utils.js';

/**
 * Export tasks to GitHub issues
 * @param {Object} options - Options for issue creation
 * @param {string} options.tasksDir - Path to the tasks directory
 * @param {boolean} options.includeStatus - Whether to include task status in the issue body
 * @param {boolean} options.includeDependencies - Whether to include dependencies in the issue body
 * @param {boolean} options.includePriority - Whether to include priority in the issue body
 * @param {string} options.labelPrefix - Prefix for labels based on task status
 * @param {boolean} options.dryRun - Whether to run in dry-run mode (don't create actual issues)
 * @param {boolean} options.createSubtasks - Whether to create subtasks as child issues
 * @returns {Promise<Object>} Result object containing success status and data
 */
async function exportToGitHub(options = {}) {
  try {
    // Load environment variables from .env file
    dotenv.config();

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = process.env.REPO_OWNER;
    const REPO_NAME = process.env.REPO_NAME;

    // Get options with defaults
    const {
      tasksDir = "tasks",
      includeStatus = true,
      includeDependencies = true,
      includePriority = true,
      labelPrefix = "status:",
      createSubtasks = true,
      dryRun = false
    } = options;

    // Validate required environment variables
    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
      return {
        success: false,
        error: "Missing environment variables. Check your .env file to ensure GITHUB_TOKEN, REPO_OWNER, and REPO_NAME are set."
      };
    }

    // Calculate the absolute path to the tasks directory
    const tasksDirectory = path.resolve(process.cwd(), tasksDir);

    // Check if the tasks directory exists
    if (!fs.existsSync(tasksDirectory)) {
      return {
        success: false,
        error: `Tasks directory '${tasksDirectory}' not found.`
      };
    }

    // Path to tasks.json file
    const tasksJsonPath = path.join(tasksDirectory, 'tasks.json');
    
    // Check if tasks.json exists
    if (!fs.existsSync(tasksJsonPath)) {
      return {
        success: false,
        error: `tasks.json file not found at '${tasksJsonPath}'.`
      };
    }

    // Read tasks.json
    let tasksData;
    try {
      const tasksJson = fs.readFileSync(tasksJsonPath, 'utf-8');
      tasksData = JSON.parse(tasksJson);
    } catch (error) {
      return {
        success: false,
        error: `Error reading tasks.json: ${error.message}`
      };
    }

    // Validate tasks data structure
    if (!tasksData.tasks || !Array.isArray(tasksData.tasks)) {
      return {
        success: false, 
        error: "Invalid tasks.json format. Expected a 'tasks' array."
      };
    }

    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`;

    const headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    };

    const results = {
      created: [],
      skipped: [],
      failed: []
    };

    // Store issue numbers for parent tasks to link subtasks
    const taskIssueMap = new Map();

    const spinner = startLoadingIndicator("Creating GitHub issues...");

    // Create parent tasks first
    for (const task of tasksData.tasks) {
      if (!task.title) {
        results.skipped.push({ 
          taskId: task.id, 
          reason: "Missing title" 
        });
        continue;
      }

      // Format labels
      const labels = [];
      if (includeStatus && task.status) {
        labels.push(`${labelPrefix}${task.status}`);
      }
      if (includePriority && task.priority) {
        labels.push(`priority:${task.priority}`);
      }

      // Format body
      let body = '';
      
      if (task.description) {
        body += `${task.description}\n\n`;
      }
      
      if (task.details) {
        body += `## Details\n${task.details}\n\n`;
      }
      
      if (includeStatus && task.status) {
        body += `## Status\n${task.status}\n\n`;
      }
      
      if (includeDependencies && task.dependencies && task.dependencies.length > 0) {
        body += `## Dependencies\nDepends on task(s): ${task.dependencies.join(', ')}\n\n`;
      }
      
      if (task.testStrategy) {
        body += `## Test Strategy\n${task.testStrategy}\n\n`;
      }
      
      if (task.subtasks && task.subtasks.length > 0) {
        body += `## Subtasks\n`;
        task.subtasks.forEach(subtask => {
          body += `- ${subtask.title}\n`;
        });
        body += '\n';
      }

      // If it's a dry run, just log what would happen
      if (dryRun) {
        consoleLog('info', `[DRY RUN] Would create issue: ${task.title}`);
        results.created.push({ 
          taskId: task.id, 
          title: task.title, 
          dryRun: true 
        });
        continue;
      }

      try {
        // Create the issue
        const response = await axios.post(
          API_URL,
          { 
            title: task.title, 
            body,
            labels
          },
          { headers }
        );
        
        const issueNumber = response.data.number;
        taskIssueMap.set(task.id, issueNumber);
        
        results.created.push({ 
          taskId: task.id, 
          title: task.title, 
          issueNumber,
          url: response.data.html_url 
        });
      } catch (error) {
        results.failed.push({ 
          taskId: task.id, 
          title: task.title, 
          error: error.response?.data?.message || error.message 
        });
      }
    }

    // Create subtasks if enabled
    if (createSubtasks && !dryRun) {
      for (const task of tasksData.tasks) {
        if (!task.subtasks || task.subtasks.length === 0 || !taskIssueMap.has(task.id)) {
          continue;
        }

        const parentIssueNumber = taskIssueMap.get(task.id);

        for (const subtask of task.subtasks) {
          if (!subtask.title) {
            results.skipped.push({ 
              taskId: `${task.id}.${subtask.id}`, 
              reason: "Missing title" 
            });
            continue;
          }

          // Format labels
          const labels = [`subtask`];
          if (includeStatus && subtask.status) {
            labels.push(`${labelPrefix}${subtask.status}`);
          }

          // Format body
          let body = '';
          
          if (subtask.description) {
            body += `${subtask.description}\n\n`;
          }
          
          if (subtask.details) {
            body += `## Details\n${subtask.details}\n\n`;
          }
          
          if (includeStatus && subtask.status) {
            body += `## Status\n${subtask.status}\n\n`;
          }
          
          if (includeDependencies && subtask.dependencies && subtask.dependencies.length > 0) {
            body += `## Dependencies\nDepends on subtask(s): ${subtask.dependencies.join(', ')}\n\n`;
          }
          
          // Add reference to parent task
          body += `## Parent Task\nThis is a subtask of #${parentIssueNumber}\n\n`;

          try {
            // Create the subtask issue
            const response = await axios.post(
              API_URL,
              { 
                title: `[Subtask] ${subtask.title}`, 
                body,
                labels
              },
              { headers }
            );
            
            results.created.push({ 
              taskId: `${task.id}.${subtask.id}`, 
              title: subtask.title, 
              issueNumber: response.data.number,
              url: response.data.html_url,
              parentIssueNumber
            });
          } catch (error) {
            results.failed.push({ 
              taskId: `${task.id}.${subtask.id}`, 
              title: subtask.title, 
              error: error.response?.data?.message || error.message 
            });
          }
        }
      }
    }

    stopLoadingIndicator(spinner);

    return {
      success: true,
      data: {
        created: results.created.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
        results
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Error creating GitHub issues: ${error.message}`
    };
  }
}

export default exportToGitHub;
