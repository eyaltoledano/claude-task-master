/**
 * Flow CLI Commands
 * Enhanced VibeKit-powered task execution with comprehensive CLI best practices
 */

import chalk from 'chalk';
import ora from 'ora';
import { 
  executeTask, 
  generateCode, 
  listAgents,
  executeTasks
} from './commands/execution.command.js';

// Enhanced error handling with proper logging and exit codes
const handleCommandError = (error, command, options = {}) => {
  const isVerbose = options.verbose || options.debug;
  
  // Log error with appropriate level
  if (error.code === 'VALIDATION_ERROR') {
    console.error(chalk.red('❌ Invalid input:'), error.message);
    if (error.suggestion) {
      console.log(chalk.yellow('💡 Suggestion:'), error.suggestion);
    }
    process.exit(2); // Invalid input
  } else if (error.code === 'NETWORK_ERROR') {
    console.error(chalk.red('🌐 Network error:'), error.message);
    console.log(chalk.yellow('💡 Try:'), 'Check your internet connection and API keys');
    process.exit(3); // Network failure
  } else if (error.code === 'API_ERROR') {
    console.error(chalk.red('🤖 VibeKit API error:'), error.message);
    if (isVerbose && error.details) {
      console.error(chalk.gray('Details:'), error.details);
    }
    process.exit(4); // API failure
  } else {
    console.error(chalk.red(`❌ ${command} failed:`), error.message);
    if (isVerbose && error.stack) {
      console.error(chalk.gray('Stack trace:'));
      console.error(error.stack);
    }
    process.exit(1); // General error
  }
};

// Validation helper
const validateTaskId = (taskId) => {
  if (!taskId || taskId.trim() === '') {
    throw {
      code: 'VALIDATION_ERROR',
      message: 'Task ID is required',
      suggestion: 'Provide a valid task ID (e.g., "5" or "5.2")'
    };
  }
  
  // Basic task ID format validation
  if (!/^\d+(\.\d+)?$/.test(taskId.trim())) {
    throw {
      code: 'VALIDATION_ERROR',
      message: `Invalid task ID format: "${taskId}"`,
      suggestion: 'Use format like "5" for tasks or "5.2" for subtasks'
    };
  }
  
  return taskId.trim();
};

// Agent validation helper
const validateAgent = async (agentType, options = {}) => {
  try {
    const { globalRegistry } = await import('./providers/registry.js');
    const providerInfo = globalRegistry.getProviderInfo('vibekit');
    
    if (!providerInfo.agents.includes(agentType)) {
      throw {
        code: 'VALIDATION_ERROR',
        message: `Unknown agent: "${agentType}"`,
        suggestion: `Available agents: ${providerInfo.agents.join(', ')}`
      };
    }
    
    // Check if agent has required API key
    const validation = globalRegistry.validateProviderConfig('vibekit');
    if (!validation.valid && options.requireConfigured) {
      const missing = validation.missing.join(', ');
      throw {
        code: 'VALIDATION_ERROR',
        message: `Agent "${agentType}" is not properly configured`,
        suggestion: `Set required environment variables: ${missing}`
      };
    }
    
    return agentType;
  } catch (error) {
    if (error.code) throw error;
    throw {
      code: 'VALIDATION_ERROR',
      message: 'Failed to validate agent configuration',
      suggestion: 'Check your VibeKit configuration and API keys'
    };
  }
};

export function registerFlowCommand(programInstance) {
  // Main flow command with enhanced options and help
  programInstance
    .command('flow [subcommand] [taskIdOrPrompt] [additionalArgs...]')
    .description('🤖 VibeKit-powered task execution and code generation')
    .option('--agent <type>', 'Agent type: claude, codex, gemini, opencode', 'claude')
    .option('--mode <mode>', 'Execution mode: code or ask', 'code')
    .option('--no-stream', 'Disable streaming output')
    .option('--project-root <path>', 'Project root directory')
    .option('--verbose', 'Enable verbose output for debugging')
    .option('--json', 'Output results in JSON format')
    .option('--dry-run', 'Preview execution plan without running (execute only)')
    .option('--retry <count>', 'Number of retries on failure (execute only)', '2')
    .option('--output <file>', 'Save generated code to file (generate only)')
    .option('--context <taskId>', 'Use task context for enhanced generation (generate only)')
    .option('--check', 'Check agent connectivity (agents only)')
    .option('--stop-on-error', 'Stop execution if any task fails (batch only)')
    .option('--parallel <count>', 'Run tasks in parallel (batch only)', '1')
    .option('--summary', 'Show detailed summary after completion (batch only)')
    .option('--show', 'Show current configuration (config only)')
    .option('--validate', 'Validate configuration and environment (config only)')
    .option('--init', 'Initialize configuration with defaults (config only)')
    .option('--set <path> <value>', 'Set configuration value (config only)')
    .option('--force', 'Force overwrite existing config (config only)')
    .option('--branch <name>', 'Git branch to use for execution context')
    .addHelpText('after', `
Examples:
  $ task-master flow                                 # Launch interactive TUI
  $ task-master flow execute 5                      # Execute task 5 with default agent
  $ task-master flow execute 5.2 --agent gemini     # Execute subtask with specific agent
  $ task-master flow execute 8 --dry-run            # Preview execution plan
  $ task-master flow generate "Hello world"         # Generate code from prompt
  $ task-master flow generate "Add validation" --context 5  # With task context
  $ task-master flow agents                         # List available agents
  $ task-master flow agents --check                 # Test agent connectivity
  $ task-master flow batch 5 6 7                   # Execute multiple tasks
  $ task-master flow batch 1 2 3 --parallel 2      # Run 2 tasks concurrently
  $ task-master flow config --show                 # Show current configuration
  $ task-master flow config --validate             # Check configuration
  
Agent Types:
  claude         Anthropic Claude for coding (default)
  codex          OpenAI Codex for code completion  
  gemini         Google Gemini for CLI development
  opencode       Full-stack development agent

Subcommands:
  execute <taskId>        Execute a single task with VibeKit
  generate "<prompt>"     Generate code from natural language prompt
  agents                  List available agents and their status
  batch <taskIds...>      Execute multiple tasks in sequence
  config                  Manage VibeKit configuration

For more details: task-master flow <subcommand> --help
    `)
    .action(async (subcommand, taskIdOrPrompt, additionalArgs, options) => {
      try {
        if (!subcommand) {
          // Launch TUI with enhanced loading using tsx wrapper
          const spinner = options.verbose ? null : ora('Starting VibeKit interface...').start();
          try {
            const { launchFlow } = await import('./cli-wrapper.js');
            if (spinner) spinner.stop();
            await launchFlow(options);
          } catch (error) {
            if (spinner) spinner.fail('Failed to start TUI');
            throw error;
          }
          return;
        }

        // Handle subcommands with enhanced validation and UX
        switch (subcommand.toLowerCase()) {
          case 'execute': {
            if (!taskIdOrPrompt) {
              throw {
                code: 'VALIDATION_ERROR',
                message: 'Task ID is required for execute command',
                suggestion: 'Usage: task-master flow execute <taskId>'
              };
            }

            const spinner = options.verbose ? null : ora('Validating task...').start();
            
            try {
              // Enhanced validation with progress feedback
              const validTaskId = validateTaskId(taskIdOrPrompt);
              const validAgent = await validateAgent(options.agent, { requireConfigured: true });
              
              if (spinner) {
                spinner.text = `Executing task ${validTaskId} with ${validAgent}...`;
              } else if (options.verbose) {
                console.log(chalk.blue('🔍 Validated:'), `Task ${validTaskId}, Agent ${validAgent}`);
              }

              if (options.dryRun) {
                if (spinner) spinner.succeed('Dry run validation completed');
                console.log(chalk.green('✅ Dry run:'), `Task ${validTaskId} would execute with agent ${validAgent}`);
                console.log(chalk.gray('Mode:'), options.mode);
                console.log(chalk.gray('Branch:'), options.branch || 'current');
                console.log(chalk.gray('Retries:'), options.retry);
                return;
              }

              if (spinner) spinner.stop();
              
              await executeTask(validTaskId, {
                ...options,
                agent: validAgent,
                onProgress: options.verbose ? (data) => {
                  console.log(chalk.blue('📊 Progress:'), `${data.progress || 0}% - ${data.message || 'Processing...'}`);
                } : undefined
              });
              
              console.log(chalk.green('✅ Task execution completed successfully!'));
              
            } catch (error) {
              if (spinner) spinner.fail('Task execution failed');
              throw error;
            }
            break;
          }

          case 'generate': {
            if (!taskIdOrPrompt) {
              throw {
                code: 'VALIDATION_ERROR',
                message: 'Prompt is required for generate command',
                suggestion: 'Usage: task-master flow generate "<prompt>"'
              };
            }

            const spinner = options.verbose ? null : ora('Preparing code generation...').start();
            
            try {
              // Validation
              if (taskIdOrPrompt.trim().length < 5) {
                throw {
                  code: 'VALIDATION_ERROR',
                  message: 'Prompt is too short',
                  suggestion: 'Provide a detailed description of what you want to generate'
                };
              }
              
              const validAgent = await validateAgent(options.agent, { requireConfigured: true });
              
              if (spinner) {
                spinner.text = `Generating code with ${validAgent}...`;
              } else if (options.verbose) {
                console.log(chalk.blue('🤖 Agent:'), validAgent);
                console.log(chalk.blue('📝 Prompt:'), taskIdOrPrompt.substring(0, 100) + (taskIdOrPrompt.length > 100 ? '...' : ''));
              }

              if (spinner) spinner.stop();
              
              const result = await generateCode(taskIdOrPrompt, {
                ...options,
                agent: validAgent,
                onUpdate: options.verbose ? (data) => {
                  if (data.progress) {
                    console.log(chalk.blue('📊 Progress:'), `${data.progress}%`);
                  }
                } : undefined
              });
              
              if (options.output && result.code) {
                const fs = await import('node:fs');
                await fs.promises.writeFile(options.output, result.code, 'utf8');
                console.log(chalk.green('💾 Saved to:'), options.output);
              }
              
              console.log(chalk.green('✅ Code generation completed!'));
              
            } catch (error) {
              if (spinner) spinner.fail('Code generation failed');
              throw error;
            }
            break;
          }

          case 'agents': {
            if (options.check) {
              const spinner = options.verbose ? null : ora('Testing agent connectivity...').start();
              if (spinner) spinner.stop();
            }
            
            await listAgents(options);
            break;
          }

          case 'batch': {
            if (!taskIdOrPrompt && !additionalArgs?.length) {
              throw {
                code: 'VALIDATION_ERROR',
                message: 'Task IDs are required for batch command',
                suggestion: 'Usage: task-master flow batch <taskId1> <taskId2> ...'
              };
            }

            const spinner = options.verbose ? null : ora('Validating batch execution...').start();
            
            try {
              // Collect all task IDs
              const allTaskIds = [taskIdOrPrompt, ...(additionalArgs || [])].filter(Boolean);
              
              // Validate all task IDs
              const validTaskIds = allTaskIds.map(validateTaskId);
              const validAgent = await validateAgent(options.agent, { requireConfigured: true });
              
              if (spinner) {
                spinner.text = `Executing ${validTaskIds.length} tasks with ${validAgent}...`;
              } else if (options.verbose) {
                console.log(chalk.blue('📋 Tasks:'), validTaskIds.join(', '));
                console.log(chalk.blue('🤖 Agent:'), validAgent);
                console.log(chalk.blue('⚙️ Mode:'), options.mode);
                console.log(chalk.blue('🔄 Parallel:'), options.parallel || '1');
              }

              if (spinner) spinner.stop();
              
              await executeTasks(validTaskIds, {
                ...options,
                agent: validAgent,
                onProgress: options.verbose ? (data) => {
                  console.log(chalk.blue(`📊 Task ${data.taskId}:`), `${data.progress || 0}% - ${data.message || 'Processing...'}`);
                } : undefined
              });
              
              console.log(chalk.green('✅ Batch execution completed!'));
              
            } catch (error) {
              if (spinner) spinner.fail('Batch execution failed');
              throw error;
            }
            break;
          }

          case 'config': {
            if (options.show) {
              const { showConfig } = await import('./commands/config.command.js');
              await showConfig(options);
            } else if (options.validate) {
              const { validateConfig } = await import('./commands/config.command.js');
              await validateConfig(options);
            } else if (options.init) {
              const { initConfig } = await import('./commands/config.command.js');
              await initConfig(options);
            } else if (options.set) {
              const [path, value] = options.set.split(' ');
              if (!path || !value) {
                throw {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid --set format',
                  suggestion: 'Use: --set "path value" (e.g., --set "vibekit.defaultAgent claude")'
                };
              }
              const { setConfigValue } = await import('./commands/config.command.js');
              await setConfigValue(path, value, options);
            } else {
              console.log(chalk.cyan('🔧 VibeKit Flow Configuration Commands:'));
              console.log('');
              console.log('  --show      Show current configuration');
              console.log('  --validate  Validate configuration and environment');
              console.log('  --init      Initialize configuration with defaults');
              console.log('  --set <path> <value>  Set configuration value');
              console.log('');
              console.log(chalk.yellow('Examples:'));
              console.log('  task-master flow config --show');
              console.log('  task-master flow config --validate');
              console.log('  task-master flow config --init');
              console.log('  task-master flow config --set vibekit.defaultAgent claude');
              console.log('');
              console.log(chalk.gray('💡 Use --help for detailed information'));
            }
            break;
          }

          case 'test-config': {
            // Import and run the test directly
            const { FlowConfigManager } = await import('./src/config/managers/flow-config-manager.js');
            const { loadFlowConfig } = await import('./src/config/flow-config.js');
            
            try {
              console.log('🧪 Testing Flow Configuration...\n');
              
              // Test 1: Load raw configuration
              console.log('1. Testing raw configuration loading...');
              const rawConfig = loadFlowConfig();
              if (rawConfig.success) {
                console.log('✅ Raw configuration loaded successfully');
                if (options.verbose) {
                  console.log('Raw config keys:', Object.keys(rawConfig.config));
                }
              } else {
                console.error('❌ Raw configuration failed:', rawConfig.error);
                throw new Error('Raw configuration failed');
              }
              
              // Test 2: Load with FlowConfigManager
              console.log('\n2. Testing FlowConfigManager...');
              const configManager = new FlowConfigManager({ projectRoot: options.projectRoot });
              
              const config = await configManager.loadConfig();
              console.log('✅ FlowConfigManager loaded successfully');
              
              if (options.verbose) {
                console.log('Config structure:');
                console.log('- nodeEnv:', config.nodeEnv);
                console.log('- vibekit.enabled:', config.vibekit?.enabled);
                console.log('- vibekit.defaultAgent:', config.vibekit?.defaultAgent);
                console.log('- vibekit.agents:', Object.keys(config.vibekit?.agents || {}));
                console.log('- vibekit.environments:', Object.keys(config.vibekit?.environments || {}));
                console.log('- github.enabled:', config.github?.enabled);
                console.log('- execution.timeout:', config.execution?.timeout);
                console.log('- logging.level:', config.logging?.level);
              }
              
              // Test 3: Validate configuration
              console.log('\n3. Testing configuration validation...');
              const validation = configManager.validateConfig(config);
              if (validation.valid) {
                console.log('✅ Configuration validation passed');
              } else {
                console.error('❌ Configuration validation failed:');
                validation.errors.forEach(error => {
                  console.error(`   - ${error}`);
                });
                throw new Error('Configuration validation failed');
              }
              
              // Test 4: Environment validation
              console.log('\n4. Testing environment validation...');
              const envValidation = configManager.validateEnvironment();
              if (envValidation.valid) {
                console.log('✅ Environment validation passed');
              } else {
                console.log('⚠️  Environment validation issues:');
                envValidation.issues.forEach(issue => {
                  console.log(`   - ${issue}`);
                });
              }
              
              if (envValidation.warnings.length > 0) {
                console.log('\n⚠️  Environment warnings:');
                envValidation.warnings.forEach(warning => {
                  console.log(`   - ${warning}`);
                });
              }
              
              // Test 5: Available agents and environments
              console.log('\n5. Testing available agents and environments...');
              const availableAgents = configManager.getAvailableAgents();
              console.log('Available agents:', availableAgents);
              
              console.log('\n🎉 All configuration tests passed!');
              
              // Summary
              console.log('\n📋 Configuration Summary:');
              console.log(`- Node Environment: ${config.nodeEnv}`);
              console.log(`- VibeKit Enabled: ${config.vibekit?.enabled}`);
              console.log(`- Default Agent: ${config.vibekit?.defaultAgent}`);
              console.log(`- GitHub Integration: ${config.github?.enabled}`);
              console.log(`- Streaming Enabled: ${config.vibekit?.streamingEnabled}`);
              console.log(`- Telemetry Enabled: ${config.vibekit?.telemetry?.enabled}`);
              console.log(`- Session Management: ${config.vibekit?.sessionManagement?.enabled}`);
              console.log(`- Secrets Provider: ${config.vibekit?.secrets?.provider}`);
              
            } catch (error) {
              throw {
                code: 'VALIDATION_ERROR',
                message: `Configuration test failed: ${error.message}`,
                suggestion: 'Check your configuration files and try again'
              };
            }
            break;
          }

          default:
            throw {
              code: 'VALIDATION_ERROR',
              message: `Unknown subcommand: "${subcommand}"`,
              suggestion: 'Available subcommands: execute, generate, agents, batch, config, test-config'
            };
        }
      } catch (error) {
        handleCommandError(error, 'flow', options);
      }
    });
}
