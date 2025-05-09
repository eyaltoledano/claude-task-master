// Cursor conversion profile for rule-transformer
import path from 'path';

const brandName = 'Cursor';
const rulesDir = '.cursor/rules';

// File name mapping (specific files with naming changes)
const fileMap = {
  'cursor_rules.mdc': 'cursor_rules.md',
  'dev_workflow.mdc': 'dev_workflow.md',
  'self_improve.mdc': 'self_improve.md',
  'taskmaster.mdc': 'taskmaster.md'
  // Add other mappings as needed
};

const globalReplacements = [
  // 1. Handle cursor.so in any possible context
  { from: /cursor\.so/gi, to: 'cursor.so' },
  // Edge case: URL with different formatting
  { from: /cursor\s*\.\s*so/gi, to: 'cursor.so' },
  { from: /https?:\/\/cursor\.so/gi, to: 'https://cursor.so' },
  { from: /https?:\/\/www\.cursor\.so/gi, to: 'https://www.cursor.so' },
  // 2. Handle tool references - even partial ones
  { from: /\bedit_file\b/gi, to: 'edit_file' },
  { from: /\bsearch tool\b/gi, to: 'search tool' },
  { from: /\bSearch Tool\b/g, to: 'Search Tool' },
  // 3. Handle basic terms (with case handling)
  { from: /\bcursor\b/gi, to: (match) => (match.charAt(0) === 'C' ? 'Cursor' : 'cursor') },
  { from: /Cursor/g, to: 'Cursor' },
  { from: /CURSOR/g, to: 'CURSOR' },
  // 4. Handle file extensions
  { from: /\.mdc\b/g, to: '.md' },
  // 5. Handle any missed URL patterns
  { from: /docs\.cursor\.com/gi, to: 'docs.cursor.com' }
];

const conversionConfig = {
  // Product and brand name replacements
  brandTerms: [
    { from: /cursor\.so/g, to: 'cursor.so' },
    { from: /\[cursor\.so\]/g, to: '[cursor.so]' },
    { from: /href="https:\/\/cursor\.so/g, to: 'href="https://cursor.so' },
    { from: /\(https:\/\/cursor\.so/g, to: '(https://cursor.so' },
    {
      from: /\bcursor\b/gi,
      to: (match) => (match === 'Cursor' ? 'Cursor' : 'cursor')
    },
    { from: /Cursor/g, to: 'Cursor' }
  ],

  // File extension replacements
  fileExtensions: [{ from: /\.mdc\b/g, to: '.md' }],

  // Documentation URL replacements
  docUrls: [
    {
      from: /https:\/\/docs\.cursor\.com\/[\^\s)\'"\\]+/g,
      to: (match) => match
    },
    { from: /https:\/\/docs\.cursor\.com\//g, to: 'https://docs.cursor.com/' }
  ]
};

export { conversionConfig, fileMap, globalReplacements, brandName, rulesDir };
