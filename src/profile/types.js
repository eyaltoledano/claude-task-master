/**
 * @fileoverview Type definitions for the Profile system
 */

/**
 * @typedef {Object} ConversionConfig
 * @property {Array<{from: RegExp|string, to: string|Function}>} [profileTerms] - Basic term replacements used for simple text substitutions.
 *   Example: `[{ from: /cursor/gi, to: 'vscode' }]` replaces all case-insensitive
 *   instances of 'cursor' with 'vscode' in the generated content.
 *
 * @property {Object<string, string>} [toolNames] - Mappings for tool-specific terminology.
 *   Keys are tool names as they appear in the source, values are their replacements.
 *   Example: `{ 'cursor': 'VS Code', 'codeium': 'Codeium' }`
 *
 * @property {Array<{from: RegExp|string, to: string}>} [toolContexts] - Context-aware tool replacements
 *   that only apply in specific contexts. More specific than profileTerms.
 *   Example: `[{ from: /@cursor\b/g, to: '@vscode' }]` only replaces when prefixed with @
 *
 * @property {Array<{from: RegExp|string, to: string}>} [toolGroups] - Replacements for tool groups or categories.
 *   Example: `[{ from: 'AI coding assistant', to: 'AI pair programmer' }]`
 *
 * @property {Array<{from: RegExp|string, to: string|Function}>} [docUrls] - Documentation URL replacements.
 *   Can use strings or functions for dynamic URL generation.
 *   Example: `[{ from: 'docs.example.com', to: 'new-docs.example.com' }]`
 *
 * @property {Object} [fileReferences] - Configuration for handling file path references
 * @property {RegExp} [fileReferences.pathPattern] - Pattern to match file paths in the content.
 *   Example: `/\b(?:[a-z0-9_\-./]+\.[a-z]+)(?::\d+(?::\d+)?)?\b/gi`
 * @property {Function} [fileReferences.replacement] - Function to transform matched file paths.
 *   Receives the matched string and should return the replacement string.
 */

/**
 * @typedef {Object} ProfileHooks
 * @property {Function} [onAdd] - Called when profile is added to project
 * @property {Function} [onRemove] - Called when profile is removed from project
 * @property {Function} [onPost] - Called after rule conversion is complete
 */

/**
 * @typedef {Object} ProfileInit
 * @property {string} profileName - Profile identifier
 * @property {string} rulesDir - Directory for rule files
 * @property {string} profileDir - Profile configuration directory
 * @property {string} [displayName] - Human-readable profile name
 * @property {Object<string, string>} [fileMap] - Source to target file mappings
 * @property {ConversionConfig} [conversionConfig] - Rule transformation configuration
 * @property {Array<{from: RegExp|string, to: string|Function}>} [globalReplacements] - Global text replacements
 * @property {boolean|Object} [mcpConfig] - MCP configuration settings
 * @property {ProfileHooks} [hooks] - Lifecycle hook functions
 * @property {boolean} [includeDefaultRules] - Whether to include default rule files
 * @property {boolean} [supportsRulesSubdirectories] - Whether to use subdirectories for rules
 * @property {string} [targetExtension] - Target file extension for rules (e.g., '.md', '.instructions.md')
 */

/**
 * @typedef {Object} ProfileOperationResult
 * @property {boolean} success - Whether operation succeeded
 * @property {number} [filesProcessed] - Number of files processed
 * @property {number} [filesSkipped] - Number of files skipped
 * @property {string} [error] - Error message if operation failed
 * @property {string} [notice] - Additional information about the operation
 */

/**
 * @typedef {'add'|'remove'|'convert'} ProfileOperation
 */

export {};
