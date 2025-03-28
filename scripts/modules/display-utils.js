/**
 * Display Utilities Module
 * 
 * Provides formatting utilities for console output to create a consistent
 * and visually appealing CLI experience.
 */

import chalk from 'chalk';
import boxen from 'boxen';
import cliTable from 'cli-table3';
import ora from 'ora';
import cliCursor from 'cli-cursor';

/**
 * Colors for different types of messages
 */
export const colors = {
  primary: chalk.blue,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.cyan,
  muted: chalk.gray,
  highlight: chalk.bold.white,
  json: chalk.magenta,
  heading: chalk.bold.white.underline,
  subHeading: chalk.bold.white
};

/**
 * Create a formatted header box
 * @param {string} title - Box title
 * @param {object} options - Boxen options
 * @returns {string} Formatted box with title
 */
export function header(title, options = {}) {
  const defaultOptions = {
    padding: 1,
    margin: { top: 1, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'blue',
    align: 'center',
    width: 50
  };
  
  return boxen(colors.heading(title), { ...defaultOptions, ...options });
}

/**
 * Create a formatted section header
 * @param {string} title - Section title
 * @returns {string} Formatted section header
 */
export function sectionHeader(title) {
  return `\n${colors.subHeading(title)}\n${'-'.repeat(title.length)}`;
}

/**
 * Format JSON data for display
 * @param {object} data - JSON data to format
 * @returns {string} Formatted JSON string
 */
export function formatJSON(data) {
  return colors.json(JSON.stringify(data, null, 2));
}

/**
 * Create a table with the provided data
 * @param {string[]} headers - Table headers
 * @param {Array<Array<string>>} rows - Table rows
 * @param {object} options - Table options
 * @returns {string} Formatted table
 */
export function createTable(headers, rows, options = {}) {
  const defaultOptions = {
    chars: {
      'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
      'right': '│', 'right-mid': '┤', 'middle': '│'
    },
    style: { 'padding-left': 1, 'padding-right': 1, head: ['cyan'] }
  };
  
  const table = new cliTable({
    head: headers,
    ...defaultOptions,
    ...options
  });
  
  rows.forEach(row => table.push(row));
  
  return table.toString();
}

/**
 * Display a success message
 * @param {string} message - Success message
 */
export function success(message) {
  console.log(colors.success(`✓ ${message}`));
}

/**
 * Display an error message
 * @param {string} message - Error message
 */
export function error(message) {
  console.log(colors.error(`✗ ${message}`));
}

/**
 * Display a warning message
 * @param {string} message - Warning message
 */
export function warning(message) {
  console.log(colors.warning(`⚠ ${message}`));
}

/**
 * Display an info message
 * @param {string} message - Info message
 */
export function info(message) {
  console.log(colors.info(`ℹ ${message}`));
}

/**
 * Create a spinner with the given text
 * @param {string} text - Spinner text
 * @returns {object} Ora spinner instance
 */
export function spinner(text) {
  return ora({
    text,
    color: 'blue'
  });
}

/**
 * Format a list of items
 * @param {string[]} items - List items
 * @param {object} options - List options
 * @returns {string} Formatted list
 */
export function formatList(items, options = {}) {
  const { 
    bullet = '•', 
    color = 'primary', 
    indent = 2 
  } = options;
  
  return items
    .map(item => `${' '.repeat(indent)}${colors[color](`${bullet} ${item}`)}`)
    .join('\n');
}

/**
 * Display a divider line
 * @param {number} length - Line length
 * @param {string} char - Character to use for line
 */
export function divider(length = process.stdout.columns - 10, char = '─') {
  console.log(colors.muted(char.repeat(length)));
}

/**
 * Format text as a titled section with content
 * @param {string} title - Section title
 * @param {string} content - Section content
 * @returns {string} Formatted section
 */
export function section(title, content) {
  return `${sectionHeader(title)}\n${content}\n`;
}

/**
 * Create a progress bar
 * @param {number} percent - Percentage (0-100)
 * @param {number} width - Bar width
 * @param {object} options - Bar options
 * @returns {string} Text-based progress bar
 */
export function progressBar(percent, width = 30, options = {}) {
  const {
    completeChar = '█',
    incompleteChar = '░',
    completeColor = 'primary',
    incompleteColor = 'muted'
  } = options;
  
  const complete = Math.round(width * (percent / 100));
  const incomplete = width - complete;
  
  const bar = 
    colors[completeColor](completeChar.repeat(complete)) + 
    colors[incompleteColor](incompleteChar.repeat(incomplete));
  
  return `${bar} ${percent}%`;
}

/**
 * Hide the cursor (useful for custom progress displays)
 */
export function hideCursor() {
  cliCursor.hide();
}

/**
 * Show the cursor
 */
export function showCursor() {
  cliCursor.show();
}

/**
 * Create a framed box with content inside
 * @param {string} content - Box content
 * @param {object} options - Box options
 * @returns {string} Box with content
 */
export function box(content, options = {}) {
  const defaultOptions = {
    padding: 1,
    borderColor: 'blue',
    borderStyle: 'round'
  };
  
  return boxen(content, { ...defaultOptions, ...options });
}

/**
 * Format key-value pairs for display
 * @param {object} data - Object with key-value pairs
 * @param {object} options - Format options
 * @returns {string} Formatted key-value pairs
 */
export function formatKeyValue(data, options = {}) {
  const {
    separator = ':',
    padding = 2,
    keyColor = 'primary',
    valueColor = 'highlight',
    indent = 0
  } = options;
  
  return Object.entries(data)
    .map(([key, value]) => {
      return `${' '.repeat(indent)}${colors[keyColor](key)}${separator} ${colors[valueColor](value)}`;
    })
    .join('\n');
}

/**
 * Export all formatting utilities
 */
export default {
  colors,
  header,
  sectionHeader,
  formatJSON,
  createTable,
  success,
  error,
  warning,
  info,
  spinner,
  formatList,
  divider,
  section,
  progressBar,
  hideCursor,
  showCursor,
  box,
  formatKeyValue
}; 