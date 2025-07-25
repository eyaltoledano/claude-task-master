/**
 * @fileoverview Type definitions for the Profile system
 */

/**
 * @typedef {Object} ConversionConfig
 * @property {Array<{from: RegExp|string, to: string|Function}>} profileTerms - Basic term replacements
 * @property {Object<string, string>} toolNames - Tool name mappings
 * @property {Array<{from: RegExp|string, to: string}>} toolContexts - Contextual tool replacements
 * @property {Array<{from: RegExp|string, to: string}>} toolGroups - Tool group replacements
 * @property {Array<{from: RegExp|string, to: string|Function}>} docUrls - Documentation URL replacements
 * @property {Object} fileReferences - File reference configuration
 * @property {RegExp} fileReferences.pathPattern - Pattern for file references
 * @property {Function} fileReferences.replacement - Replacement function
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
