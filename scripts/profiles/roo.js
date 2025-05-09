// Roo Code conversion profile for rule-transformer
import path from 'path';

// File name mapping (specific files with naming changes)
const fileMap = {
  'cursor_rules.mdc': 'roo_rules.md',
  'dev_workflow.mdc': 'dev_workflow.md',
  'self_improve.mdc': 'self_improve.md',
  'taskmaster.mdc': 'taskmaster.md'
  // Add other mappings as needed
};

const conversionConfig = {
  // Product and brand name replacements
  brandTerms: [
    { from: /cursor\.so/g, to: 'roocode.com' },
    { from: /\[cursor\.so\]/g, to: '[roocode.com]' },
    { from: /href="https:\/\/cursor\.so/g, to: 'href="https://roocode.com' },
    { from: /\(https:\/\/cursor\.so/g, to: '(https://roocode.com' },
    {
      from: /\bcursor\b/gi,
      to: (match) => (match === 'Cursor' ? 'Roo Code' : 'roo')
    },
    { from: /Cursor/g, to: 'Roo Code' }
  ],

  // File extension replacements
  fileExtensions: [{ from: /\.mdc\b/g, to: '.md' }],

  // Documentation URL replacements
  docUrls: [
    {
      from: /https:\/\/docs\.cursor\.com\/[^\s)'\"]+/g,
      to: (match) => match.replace('docs.cursor.com', 'docs.roocode.com')
    },
    { from: /https:\/\/docs\.roo\.com\//g, to: 'https://docs.roocode.com/' }
  ],

  // Tool references - direct replacements
  toolNames: {
    search: 'search_files',
    read_file: 'read_file',
    edit_file: 'apply_diff',
    create_file: 'write_to_file',
    run_command: 'execute_command',
    terminal_command: 'execute_command',
    use_mcp: 'use_mcp_tool',
    switch_mode: 'switch_mode'
  },

  // Tool references in context - more specific replacements
  toolContexts: [
    { from: /\bsearch tool\b/g, to: 'search_files tool' },
    { from: /\bedit_file tool\b/g, to: 'apply_diff tool' },
    { from: /\buse the search\b/g, to: 'use the search_files' },
    { from: /\bThe edit_file\b/g, to: 'The apply_diff' },
    { from: /\brun_command executes\b/g, to: 'execute_command executes' },
    { from: /\buse_mcp connects\b/g, to: 'use_mcp_tool connects' },
    { from: /\bCursor search\b/g, to: 'Roo Code search_files' },
    { from: /\bCursor edit\b/g, to: 'Roo Code apply_diff' },
    { from: /\bCursor create\b/g, to: 'Roo Code write_to_file' },
    { from: /\bCursor run\b/g, to: 'Roo Code execute_command' }
  ],

  // Tool group and category names
  toolGroups: [
    { from: /\bSearch tools\b/g, to: 'Read Group tools' },
    { from: /\bEdit tools\b/g, to: 'Edit Group tools' },
    { from: /\bRun tools\b/g, to: 'Command Group tools' },
    { from: /\bMCP servers\b/g, to: 'MCP Group tools' },
    { from: /\bSearch Group\b/g, to: 'Read Group' },
    { from: /\bEdit Group\b/g, to: 'Edit Group' },
    { from: /\bRun Group\b/g, to: 'Command Group' }
  ],

  // File references in markdown links
  fileReferences: {
    pathPattern: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
    replacement: (match, text, filePath) => {
      // Get the base filename
      const baseName = path.basename(filePath, '.mdc');
      // Get the new filename (either from mapping or by replacing extension)
      const newFileName = fileMap[`${baseName}.mdc`] || `${baseName}.md`;
      // Return the updated link
      return `[${text}](mdc:.roo/rules/${newFileName})`;
    }
  }
};

export { conversionConfig, fileMap };
