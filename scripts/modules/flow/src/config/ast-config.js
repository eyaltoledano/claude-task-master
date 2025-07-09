/**
 * AST Configuration Loader
 * Loads configuration from organized JSON files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load AST configuration from JSON file
 */
export function loadASTConfig() {
  try {
    const astConfigPath = path.join(__dirname, '..', '..', 'config', 'core', 'ast.json');
    const astConfig = JSON.parse(fs.readFileSync(astConfigPath, 'utf-8'));
    
    return {
      success: true,
      config: astConfig
    };
  } catch (error) {
    console.warn('Error loading AST config:', error.message);
    return {
      success: false,
      error: error.message,
      config: null
    };
  }
}

/**
 * Get default AST configuration
 */
export async function getDefaultASTConfig() {
  const result = loadASTConfig();
  return result.config;
}

// Re-export from other modules for backward compatibility
export { validateASTConfig, parseCacheDuration, parseCacheSize, isLanguageSupported, getSupportedExtensions } from './utils/config-utils.js';
export { ASTConfigManager } from './managers/ast-config-manager.js';
export { ConfigValidator } from './schemas/ast-config-schema.js';
