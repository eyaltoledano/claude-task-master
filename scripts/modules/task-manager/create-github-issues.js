/**
 * create-github-issues.js
 * Create GitHub issues from task files in the tasks directory
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';
import boxen from 'boxen';
import { startLoadingIndicator, stopLoadingIndicator } from '../ui.js';
import { log as consoleLog } from '../utils.js';

/**
 * Create GitHub issues from task files
 * @param {Object} options - Options for issue creation
 * @param {string} options.tasksDir - Path to the tasks directory
 * @param {boolean} options.includeStatus - Whether to include task status in the issue body
 * @param {boolean} options.includeDependencies - Whether to include dependencies in the issue body
 * @param {boolean} options.includePriority - Whether to include priority in the issue body
 * @param {string} options.labelPrefix - Prefix for labels based on task status
 * @param {boolean} options.dryRun - Whether to run in dry-run mode (don't create actual issues)
 * @returns {Promise<Object>} Result object containing success status and data
 */
async function createGitHubIssues(options = {}) {
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

    // Get all task files that end with .txt
    const files = fs.readdirSync(tasksDirectory).filter(file => file.endsWith(".txt"));

    if (files.length === 0) {
      return {
        success: false,
        error: `No task files found in '${tasksDirectory}'.`
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

    const spinner = startLoadingIndicator("Creating GitHub issues...");

    for (const file of files) {
      const filePath = path.join(tasksDirectory, file);
      const content = fs.readFileSync(filePath, "utf-8").split("\n");

      if (content.length === 0 || content[0].trim() === "") {
        results.skipped.push({ file, reason: "Empty or invalid file" });
        continue;
      }

      // Extract task information
      const title = content[0].trim().replace(/^#\s*/, ''); // Remove leading # if present
      let body = content.slice(1).join("\n").trim();

      // If it's a dry run, just log what would happen
      if (dryRun) {
        consoleLog('info', `[DRY RUN] Would create issue: ${title}`);
        results.created.push({ file, title, dryRun: true });
        continue;
      }

      try {
        // Create the issue
        const response = await axios.post(
          API_URL,
          { title, body },
          { headers }
        );
        
        results.created.push({ 
          file, 
          title, 
          issueNumber: response.data.number,
          url: response.data.html_url 
        });
      } catch (error) {
        results.failed.push({ 
          file, 
          title, 
          error: error.response?.data?.message || error.message 
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
      error: `Error creating GitHub issues: ${error.message}`
    };
  }
}

export default createGitHubIssues;
