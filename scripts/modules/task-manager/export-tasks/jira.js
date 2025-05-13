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
 * Export tasks to Jira issues
 * @param {Object} options - Options for issue creation
 * @param {string} options.tasksDir - Path to the tasks directory
 * @param {boolean} options.includeStatus - Whether to include task status in the issue description
 * @param {boolean} options.includeDependencies - Whether to include dependencies in the issue description
 * @param {boolean} options.includePriority - Whether to include priority in the issue description
 * @param {string} options.issueType - The Jira issue type (e.g., 'Task', 'Story', 'Bug')
 * @param {boolean} options.dryRun - Whether to run in dry-run mode (don't create actual issues)
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

    // Get all task files that end with .txt
    const files = fs.readdirSync(tasksDirectory).filter(file => file.endsWith(".txt"));

    if (files.length === 0) {
      return {
        success: false,
        error: `No task files found in '${tasksDirectory}'.`
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

    const spinner = startLoadingIndicator("Creating Jira issues...");

    for (const file of files) {
      const filePath = path.join(tasksDirectory, file);
      const content = fs.readFileSync(filePath, "utf-8").split("\n");

      if (content.length === 0 || content[0].trim() === "") {
        results.skipped.push({ file, reason: "Empty or invalid file" });
        continue;
      }

      // Extract task information
      const summary = content[0].trim().replace(/^#\s*/, ''); // Remove leading # if present
      const description = content.slice(1).join("\n").trim();

      // Prepare the issue data for Jira API
      const issueData = {
        fields: {
          project: {
            key: JIRA_PROJECT_KEY
          },
          summary: summary,
          description: {
            version: 1,
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: description
                  }
                ]
              }
            ]
          },
          issuetype: {
            name: issueType
          }
        }
      };

      // If it's a dry run, just log what would happen
      if (dryRun) {
        consoleLog('info', `[DRY RUN] Would create Jira issue: ${summary}`);
        results.created.push({ file, summary, dryRun: true });
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
        
        results.created.push({ 
          file, 
          summary, 
          issueKey,
          url: issueUrl 
        });
      } catch (error) {
        results.failed.push({ 
          file, 
          summary, 
          error: error.response?.data?.errorMessages?.join(', ') || error.message 
        });
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
