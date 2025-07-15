/**
 * VibeKit Execution Commands
 * Simplified commands focusing on VibeKit SDK capabilities with better streaming and error handling
 */

import { globalRegistry } from '../../shared/providers/registry.js';

/**
 * Execute a task using VibeKit SDK
 */
export async function executeTask(taskId, options = {}) {
  try {
    console.log(`🚀 Executing task ${taskId} with VibeKit...`);
    
    // Get task details
    const { getTask } = await import('../../../task-manager/get-task.js');
    const task = await getTask({ id: taskId }, { projectRoot: options.projectRoot });
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Get VibeKit provider
    const provider = await globalRegistry.getProvider('vibekit', {
      repository: options.repository,
      defaultAgent: options.agent || 'claude'
    });

    console.log(`🤖 Using agent: ${options.agent || 'claude'}`);

    // Execute task with streaming
    const result = await provider.executeTask(task, {
      projectRoot: options.projectRoot,
      branch: options.branch,
      agent: options.agent,
      mode: options.mode || 'code',
      onProgress: (data) => {
        const progress = data.progress || 0;
        const message = data.message || 'Processing...';
        console.log(`📊 Progress: ${progress}% - ${message}`);
        
        // Optional user-provided progress callback
        if (options.onProgress) {
          options.onProgress(data);
        }
      }
    });

    console.log(`✅ Task ${taskId} completed successfully!`);
    console.log(`📝 Summary: ${result.summary || 'No summary available'}`);
    
    if (result.files && result.files.length > 0) {
      console.log(`📁 Files modified: ${result.files.length}`);
      result.files.forEach(file => console.log(`   - ${file}`));
    }

    if (result.usage) {
      console.log(`📊 Tokens used: ${result.usage.total_tokens || 'unknown'}`);
    }

    return result;

  } catch (error) {
    console.error(`❌ Task execution failed: ${error.message}`);
    
    // Provide helpful suggestions based on common errors
    if (error.message.includes('API key')) {
      console.log('\n💡 Check your API keys:');
      console.log('   - ANTHROPIC_API_KEY (for Claude Code)');
      console.log('   - E2B_API_KEY (for sandbox execution)');
      console.log('   - GITHUB_TOKEN (optional, for GitHub integration)');
    } else if (error.message.includes('not found')) {
      console.log('\n💡 Try: task-master list --status pending');
    }
    
    // Use meaningful exit code
    process.exitCode = 1;
    throw error;
  }
}

/**
 * Generate code using VibeKit
 */
export async function generateCode(prompt, options = {}) {
  try {
    console.log(`🤖 Generating code with ${options.agent || 'claude'}...`);
    
    const provider = await globalRegistry.getProvider('vibekit', {
      defaultAgent: options.agent || 'claude'
    });

    const result = await provider.generateCode(prompt, {
      mode: options.mode || 'code',
      onUpdate: (data) => {
        if (options.stream !== false) {
          // Enhanced streaming with better formatting
          if (data.content) {
            process.stdout.write(data.content);
          } else if (data.delta) {
            process.stdout.write(data.delta);
          }
        }
        
        // Optional user-provided update callback
        if (options.onUpdate) {
          options.onUpdate(data);
        }
      },
      onError: (error) => {
        console.error(`\n❌ Generation error: ${error.message}`);
        
        // Optional user-provided error callback
        if (options.onError) {
          options.onError(error);
        }
      }
    });

    console.log(`\n✅ Code generation completed!`);
    
    if (result.usage) {
      console.log(`📊 Tokens used: ${result.usage.total_tokens || 'unknown'}`);
    }
    
    return result;

  } catch (error) {
    console.error(`❌ Code generation failed: ${error.message}`);
    
    // Provide helpful suggestions
    if (error.message.includes('API key')) {
      console.log('\n💡 Check your API keys:');
      console.log('   Run: task-master flow agents');
      console.log('   To see which API keys are missing');
    }
    
    // Use meaningful exit code  
    process.exitCode = 1;
    throw error;
  }
}

/**
 * List available VibeKit agents
 */
export async function listAgents(options = {}) {
  try {
    const providerInfo = globalRegistry.getProviderInfo('vibekit');
    
    if (options.json) {
      const output = {
        provider: 'vibekit',
        agents: providerInfo.agents,
        timestamp: Date.now()
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log('🤖 Available VibeKit Agents:');
    console.log('');
    
    for (const agent of providerInfo.agents) {
      const apiKey = getRequiredApiKey(agent);
      const configured = !!process.env[apiKey];
      const status = configured ? '✅' : '⚠️';
      
      console.log(`${status} ${agent}`);
      console.log(`   API Key: ${apiKey} ${configured ? '(configured)' : '(missing)'}`);
    }
    
    console.log('');
    console.log('Legend: ✅ Ready  ⚠️ Missing API Key');
    
    // Show next steps if issues found
    const missingKeys = providerInfo.agents
      .map(agent => ({ agent, key: getRequiredApiKey(agent) }))
      .filter(({ key }) => !process.env[key]);
    
    if (missingKeys.length > 0) {
      console.log('');
      console.log('💡 To configure missing API keys:');
      console.log('   1. Add to your .env file in project root');
      console.log('   2. Or set as environment variables');
      console.log('   3. Then restart the application');
    }

  } catch (error) {
    console.error(`❌ Failed to list agents: ${error.message}`);
    process.exitCode = 1;
    throw error;
  }
}

/**
 * Helper function to get required API key for each agent
 */
function getRequiredApiKey(agent) {
  switch (agent) {
    case 'claude': return 'ANTHROPIC_API_KEY';
    case 'codex': return 'OPENAI_API_KEY';
    case 'gemini': return 'GOOGLE_API_KEY';
    case 'opencode': return 'OPENCODE_API_KEY';
    default: return 'ANTHROPIC_API_KEY';
  }
}

/**
 * Execute multiple tasks in sequence
 */
export async function executeTasks(taskIds, options = {}) {
  const results = [];
  
  for (const taskId of taskIds) {
    try {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🔄 Executing task ${taskId} (${results.length + 1}/${taskIds.length})`);
      console.log(`${'='.repeat(50)}`);
      
      const result = await executeTask(taskId, options);
      results.push({ taskId, status: 'success', result });
      
    } catch (error) {
      console.error(`❌ Task ${taskId} failed: ${error.message}`);
      results.push({ taskId, status: 'failed', error: error.message });
      
      if (options.stopOnError) {
        console.log('\n⚠️ Stopping execution due to error (--stop-on-error)');
        break;
      }
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 Execution Summary');
  console.log(`${'='.repeat(50)}`);
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📋 Total: ${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed tasks:');
    failed.forEach(({ taskId, error }) => {
      console.log(`   - Task ${taskId}: ${error}`);
    });
  }
  
  return results;
}
