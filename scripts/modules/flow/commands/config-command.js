/**
 * Configuration Command Integration for Phase 4.1
 * 
 * Integrates AST configuration management with the flow command system.
 * Provides CLI interface for viewing, setting, validating, and resetting configuration.
 * 
 * Commands:
 * - task-master flow --config-show
 * - task-master flow --config-set="key=value"
 * - task-master flow --config-reset
 * - task-master flow --config-validate
 */

import ASTConfigManager from '../config/ast-config-manager.js';
import ConfigValidator from '../config/config-validator.js';

/**
 * Configuration Command Handler
 * 
 * Handles all configuration-related operations for the flow command.
 */
class ConfigCommandHandler {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.configManager = new ASTConfigManager({ projectRoot: this.projectRoot });
        this.validator = new ConfigValidator();
    }
    
    /**
     * Handle configuration commands
     */
    async handleConfigCommand(options) {
        try {
            // Determine which config operation to perform
            if (options.configShow !== undefined) {
                return await this.handleShowConfig(options.configShow);
            }
            
            if (options.configSet) {
                return await this.handleSetConfig(options.configSet);
            }
            
            if (options.configReset !== undefined) {
                return await this.handleResetConfig(options.configReset);
            }
            
            if (options.configValidate) {
                return await this.handleValidateConfig();
            }
            
            // No valid config option provided
            return this.showConfigHelp();
            
        } catch (error) {
            console.error('Configuration command failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Handle --config-show command
     */
    async handleShowConfig(section = null) {
        try {
            console.log('📋 AST Configuration');
            console.log('==================');
            
            await this.configManager.loadConfiguration();
            
            const config = this.configManager.getConfigurationSummary(section);
            
            if (!config) {
                console.log(`❌ Configuration section not found: ${section}`);
                return false;
            }
            
            if (section) {
                console.log(`\n📂 Section: ${section}`);
                console.log(JSON.stringify(config, null, 2));
            } else {
                console.log('\n🔧 Current Configuration:');
                console.log(JSON.stringify(config, null, 2));
            }
            
            console.log('\n✅ Configuration displayed successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to show configuration:', error.message);
            throw error;
        }
    }
    
    /**
     * Handle --config-set command
     */
    async handleSetConfig(keyValuePair) {
        try {
            console.log('⚙️  Setting AST Configuration');
            console.log('============================');
            
            const [key, value] = this.parseKeyValuePair(keyValuePair);
            
            if (!key || value === undefined) {
                console.error('❌ Invalid format. Use: --config-set="key=value"');
                return false;
            }
            
            console.log(`Setting: ${key} = ${value}`);
            
            await this.configManager.setConfigValue(key, value);
            
            console.log('✅ Configuration updated successfully');
            
            // Show updated value
            const updatedConfig = this.configManager.getConfigurationSummary(key);
            if (updatedConfig !== null) {
                console.log(`New value: ${JSON.stringify(updatedConfig)}`);
            }
            
            return true;
            
        } catch (error) {
            console.error('Failed to set configuration:', error.message);
            throw error;
        }
    }
    
    /**
     * Handle --config-reset command
     */
    async handleResetConfig(section = null) {
        try {
            console.log('🔄 Resetting AST Configuration');
            console.log('==============================');
            
            if (section === true || section === '') {
                // Reset entire configuration
                console.log('Resetting entire configuration to defaults...');
                await this.configManager.resetToDefaults();
                console.log('✅ Entire configuration reset to defaults');
            } else if (section) {
                // Reset specific section
                console.log(`Resetting section: ${section}`);
                await this.configManager.resetToDefaults(section);
                console.log(`✅ Section "${section}" reset to defaults`);
            } else {
                console.error('❌ Invalid reset option. Use --config-reset or --config-reset=section');
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('Failed to reset configuration:', error.message);
            throw error;
        }
    }
    
    /**
     * Handle --config-validate command
     */
    async handleValidateConfig() {
        try {
            console.log('🔍 Validating AST Configuration');
            console.log('===============================');
            
            await this.configManager.loadConfiguration();
            const config = this.configManager.getEffectiveConfig();
            
            const validation = this.validator.validate(config);
            
            if (validation.hasErrors) {
                console.log('❌ Configuration validation failed:');
                validation.errors.forEach(error => {
                    console.log(`   • ${error}`);
                });
            } else {
                console.log('✅ Configuration validation passed');
            }
            
            if (validation.hasWarnings) {
                console.log('\n⚠️  Configuration warnings:');
                validation.warnings.forEach(warning => {
                    console.log(`   • ${warning}`);
                });
            }
            
            // Show validation summary
            const summary = this.validator.getValidationSummary();
            console.log(`\n📊 Validation Summary:`);
            console.log(`   Total rules: ${summary.totalRules}`);
            console.log(`   Critical rules: ${summary.criticalRules}`);
            console.log(`   Warning rules: ${summary.warningRules}`);
            
            return validation.isValid;
            
        } catch (error) {
            console.error('Failed to validate configuration:', error.message);
            throw error;
        }
    }
    
    /**
     * Parse key=value pair from command line
     */
    parseKeyValuePair(keyValuePair) {
        const equalIndex = keyValuePair.indexOf('=');
        
        if (equalIndex === -1) {
            return [null, null];
        }
        
        const key = keyValuePair.substring(0, equalIndex).trim();
        const value = keyValuePair.substring(equalIndex + 1).trim();
        
        return [key, value];
    }
    
    /**
     * Show configuration help
     */
    showConfigHelp() {
        console.log('🔧 AST Configuration Commands');
        console.log('=============================');
        console.log('');
        console.log('Available configuration commands:');
        console.log('');
        console.log('  View configuration:');
        console.log('    task-master flow --config-show');
        console.log('    task-master flow --config-show=parsing');
        console.log('    task-master flow --config-show=fileWatching');
        console.log('    task-master flow --config-show=cacheInvalidation');
        console.log('    task-master flow --config-show=worktreeManager');
        console.log('');
        console.log('  Set configuration:');
        console.log('    task-master flow --config-set="ast.parsing.enabled=false"');
        console.log('    task-master flow --config-set="ast.fileWatching.batchDelay=300"');
        console.log('    task-master flow --config-set="ast.cacheInvalidation.strategy=aggressive"');
        console.log('');
        console.log('  Reset configuration:');
        console.log('    task-master flow --config-reset');
        console.log('    task-master flow --config-reset=parsing');
        console.log('');
        console.log('  Validate configuration:');
        console.log('    task-master flow --config-validate');
        console.log('');
        console.log('Configuration sections:');
        console.log('  • parsing - Language parsing settings');
        console.log('  • fileWatching - File watching and change detection');
        console.log('  • cacheInvalidation - Cache invalidation strategies');
        console.log('  • worktreeManager - Git worktree management');
        console.log('  • performance - Performance and resource limits');
        console.log('  • contextGeneration - Claude context generation');
        console.log('  • debugging - Debug and logging options');
        
        return true;
    }
    
    /**
     * Initialize configuration system (called during flow startup)
     */
    async initializeConfiguration() {
        try {
            console.log('🚀 Initializing AST Configuration System...');
            
            // Load configuration with validation
            await this.configManager.loadConfiguration();
            
            console.log('✅ AST Configuration initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize AST configuration:', error.message);
            
            // Check if this is a critical error that should prevent startup
            if (error.message.includes('Invalid AST configuration prevents startup')) {
                console.error('🚫 Startup prevented due to configuration errors.');
                console.error('   Use: task-master flow --config-validate');
                console.error('   Or:  task-master flow --config-reset');
                throw error;
            }
            
            // Non-critical error, log warning and continue
            console.warn('⚠️  AST configuration has issues but startup will continue');
            console.warn('   Use: task-master flow --config-validate to check issues');
            
            return false;
        }
    }
    
    /**
     * Get current configuration for use by other components
     */
    getConfiguration() {
        return this.configManager.getEffectiveConfig();
    }
    
    /**
     * Check if AST features are enabled
     */
    isASTEnabled() {
        const config = this.configManager.getEffectiveConfig();
        return config?.ast?.enabled === true;
    }
    
    /**
     * Get configuration for a specific section
     */
    getConfigSection(section) {
        return this.configManager.getConfigurationSummary(`ast.${section}`);
    }
}

/**
 * Export configuration command functions for integration with flow command
 */

/**
 * Add configuration options to Commander.js program
 */
export function addConfigOptions(program) {
    program
        .option('--config-show [section]', 'Show AST configuration (optionally for specific section)')
        .option('--config-set <keyvalue>', 'Set configuration value using key=value format')
        .option('--config-reset [section]', 'Reset configuration to defaults (optionally for specific section)')
        .option('--config-validate', 'Validate current configuration');
}

/**
 * Handle configuration commands if any config options are provided
 */
export async function handleConfigOptions(options, projectRoot = null) {
    const configHandler = new ConfigCommandHandler({ projectRoot });
    
    // Check if any config options are provided
    const hasConfigOption = options.configShow !== undefined || 
                           options.configSet || 
                           options.configReset !== undefined || 
                           options.configValidate;
    
    if (hasConfigOption) {
        return await configHandler.handleConfigCommand(options);
    }
    
    return null; // No config commands to handle
}

/**
 * Initialize configuration system during flow startup
 */
export async function initializeConfigSystem(projectRoot = null) {
    const configHandler = new ConfigCommandHandler({ projectRoot });
    return await configHandler.initializeConfiguration();
}

/**
 * Get configuration handler for use by other flow components
 */
export function getConfigHandler(projectRoot = null) {
    return new ConfigCommandHandler({ projectRoot });
}

export default ConfigCommandHandler; 