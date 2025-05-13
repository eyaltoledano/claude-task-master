/**
 * jira.js
 * Export tasks to Jira issues
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { startLoadingIndicator, stopLoadingIndicator } from '../../ui.js';
import { log as consoleLog } from '../../utils.js';

/**
 * Create Jira document content from text
 * @param {string} text - The text to convert to Jira document format
 * @returns {Object} - Jira document node
 */
function createJiraDocContent(text) {
  if (!text) return [];
  
  const paragraphs = text.split('\n\n');
  
  return paragraphs.map(paragraph => {
    // Check if it's a heading (starts with # or ##)
    if (paragraph.startsWith('# ')) {
      return {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: paragraph.substring(2) }]
      };
    } else if (paragraph.startsWith('## ')) {
      return {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: paragraph.substring(3) }]
      };
    } else if (paragraph.startsWith('### ')) {
      return {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: paragraph.substring(4) }]
      };
    } else {
      // Regular paragraph
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: paragraph }]
      };
    }
  });
}

/**
 * Create Jira document content from structured sections
 * @param {Array} sections - Array of section objects with title and content
 * @returns {Array} - Jira document nodes
 */
function createJiraDocFromSections(sections) {
  const content = [];
  
  sections.forEach(section => {
    if (section.title) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: section.title }]
      });
    }
    
    if (section.content) {
      const sectionContent = createJiraDocContent(section.content);
      content.push(...sectionContent);
    }
  });
  
  return content;
}

/**
 * Map task priority to Jira priority
 * @param {string} priority - Task priority (high, medium, low)
 * @returns {string} - Jira priority name
 */
function mapPriorityToJira(priority) {
  const priorityMap = {
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low'
  };
  
  return priorityMap[priority] || 'Medium';
}

/**
 * Export tasks to Jira issues
 * @param {Object} options - Options for issue creation
 * @param {string} options.tasksDir - Path to the tasks directory
 * @param {boolean} options.includeStatus - Whether to include task status in the issue description
 * @param {boolean} options.includeDependencies - Whether to include dependencies in the issue description
 * @param {boolean} options.includePriority - Whether to include priority in the issue description
 * @param {string} options.issueType - The Jira issue type (e.g., 'Task', 'Story', 'Bug')
 * @param {boolean} options.dryRun - Whether to run in dry-run mode (don't create actual issues)
 * @param {boolean} options.createSubtasks - Whether to create subtasks as Jira subtasks
 * @param {boolean} options.mapPriority - Whether to map priority to Jira priority field
 * @returns {Promise<Object>} Result object containing success status and data
 */
async function exportToJira(options = {}) {
  try {
    // Load environment variables from .env file
    dotenv.config();

    const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
    const JIRA_EMAIL = process.env.JIRA_EMAIL;
    const JIRA_HOST = process.env.JIRA_HOST;
    const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

    // Get options with defaults
    const {
      tasksDir = "tasks",
      includeStatus = true,
      includeDependencies = true,
      includePriority = true,
      issueType = "Task",
      subtaskType = "Sub-task",
      createSubtasks = true,
      mapPriority = true,
      dryRun = false
    } = options;

    // Validate required environment variables
    if (!JIRA_API_TOKEN || !JIRA_EMAIL || !JIRA_HOST || !JIRA_PROJECT_KEY) {
      return {
        success: false,
        error: "Missing environment variables. Check your .env file to ensure JIRA_API_TOKEN, JIRA_EMAIL, JIRA_HOST, and JIRA_PROJECT_KEY are set."
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

    // Ensure JIRA_HOST doesn't end with a trailing slash
    const baseUrl = JIRA_HOST.endsWith('/') ? JIRA_HOST.slice(0, -1) : JIRA_HOST;
    const API_URL = `${baseUrl}/rest/api/3/issue`;

    // Set up HTTP authentication with Basic Auth
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    const results = {
      created: [],
      skipped: [],
      failed: []
    };

    // Store issue keys for parent tasks to link subtasks
    const taskIssueMap = new Map();

    const spinner = startLoadingIndicator("Creating Jira issues...");

    // Create parent tasks first
    for (const task of tasksData.tasks) {
      if (!task.title) {
        results.skipped.push({ 
          taskId: task.id, 
          reason: "Missing title" 
        });
        continue;
      }

      // Prepare description content sections
      const descriptionSections = [];
      
      if (task.description) {
        descriptionSections.push({
          content: task.description
        });
      }
      
      if (task.details) {
        descriptionSections.push({
          title: "Details",
          content: task.details
        });
      }
      
      if (includeStatus && task.status) {
        descriptionSections.push({
          title: "Status",
          content: task.status
        });
      }
      
      if (includeDependencies && task.dependencies && task.dependencies.length > 0) {
        descriptionSections.push({
          title: "Dependencies",
          content: `Depends on task(s): ${task.dependencies.join(', ')}`
        });
      }
      
      if (task.testStrategy) {
        descriptionSections.push({
          title: "Test Strategy",
          content: task.testStrategy
        });
      }
      
      if (task.subtasks && task.subtasks.length > 0 && !createSubtasks) {
        const subtaskList = task.subtasks.map(st => `- ${st.title}`).join('\n');
        descriptionSections.push({
          title: "Subtasks",
          content: subtaskList
        });
      }
      
      // Create document content for Jira's Atlassian Document Format
      const docContent = createJiraDocFromSections(descriptionSections);
      
      // Prepare the issue data for Jira API
      const issueData = {
        fields: {
          project: {
            key: JIRA_PROJECT_KEY
          },
          summary: task.title,
          description: {
            version: 1,
            type: "doc",
            content: docContent
          },
          issuetype: {
            name: issueType
          }
        }
      };
      
      // Add priority if enabled and available
      if (mapPriority && task.priority) {
        issueData.fields.priority = {
          name: mapPriorityToJira(task.priority)
        };
      } else if (includePriority && task.priority) {
        // Add as a label if not mapping to priority field
        if (!issueData.fields.labels) {
          issueData.fields.labels = [];
        }
        issueData.fields.labels.push(`priority-${task.priority}`);
      }
      
      // Add status as a label if needed
      if (includeStatus && task.status) {
        if (!issueData.fields.labels) {
          issueData.fields.labels = [];
        }
        issueData.fields.labels.push(`status-${task.status}`);
      }

      // If it's a dry run, just log what would happen
      if (dryRun) {
        consoleLog('info', `[DRY RUN] Would create Jira issue: ${task.title}`);
        results.created.push({ 
          taskId: task.id, 
          summary: task.title, 
          dryRun: true 
        });
        continue;
      }

      try {
        // Create the issue
        const response = await axios.post(
          API_URL,
          issueData,
          { headers }
        );
        
        const issueKey = response.data.key;
        const issueUrl = `${baseUrl}/browse/${issueKey}`;
        
        // Store the issue key for linking subtasks
        taskIssueMap.set(task.id, issueKey);
        
        results.created.push({ 
          taskId: task.id, 
          summary: task.title, 
          issueKey,
          url: issueUrl 
        });
      } catch (error) {
        results.failed.push({ 
          taskId: task.id, 
          summary: task.title, 
          error: error.response?.data?.errorMessages?.join(', ') || error.message 
        });
      }
    }

    // Create subtasks if enabled
    if (createSubtasks && !dryRun) {
      for (const task of tasksData.tasks) {
        if (!task.subtasks || task.subtasks.length === 0 || !taskIssueMap.has(task.id)) {
          continue;
        }

        const parentIssueKey = taskIssueMap.get(task.id);

        for (const subtask of task.subtasks) {
          if (!subtask.title) {
            results.skipped.push({ 
              taskId: `${task.id}.${subtask.id}`, 
              reason: "Missing title" 
            });
            continue;
          }

          // Prepare description content sections
          const descriptionSections = [];
          
          if (subtask.description) {
            descriptionSections.push({
              content: subtask.description
            });
          }
          
          if (subtask.details) {
            descriptionSections.push({
              title: "Details",
              content: subtask.details
            });
          }
          
          if (includeStatus && subtask.status) {
            descriptionSections.push({
              title: "Status",
              content: subtask.status
            });
          }
          
          if (includeDependencies && subtask.dependencies && subtask.dependencies.length > 0) {
            descriptionSections.push({
              title: "Dependencies",
              content: `Depends on subtask(s): ${subtask.dependencies.join(', ')}`
            });
          }
          
          // Create document content for Jira's Atlassian Document Format
          const docContent = createJiraDocFromSections(descriptionSections);
          
          // Prepare the subtask data for Jira API
          const subtaskData = {
            fields: {
              project: {
                key: JIRA_PROJECT_KEY
              },
              summary: subtask.title,
              description: {
                version: 1,
                type: "doc",
                content: docContent
              },
              issuetype: {
                name: subtaskType
              },
              parent: {
                key: parentIssueKey
              }
            }
          };
          
          // Add status as a label if needed
          if (includeStatus && subtask.status) {
            if (!subtaskData.fields.labels) {
              subtaskData.fields.labels = [];
            }
            subtaskData.fields.labels.push(`status-${subtask.status}`);
          }

          try {
            // Create the subtask issue
            const response = await axios.post(
              API_URL,
              subtaskData,
              { headers }
            );
            
            const issueKey = response.data.key;
            const issueUrl = `${baseUrl}/browse/${issueKey}`;
            
            results.created.push({ 
              taskId: `${task.id}.${subtask.id}`, 
              summary: subtask.title, 
              issueKey,
              url: issueUrl,
              parentIssueKey
            });
          } catch (error) {
            results.failed.push({ 
              taskId: `${task.id}.${subtask.id}`, 
              summary: subtask.title, 
              error: error.response?.data?.errorMessages?.join(', ') || error.message 
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
      error: `Error creating Jira issues: ${error.message}`
    };
  }
}

export default exportToJira;
