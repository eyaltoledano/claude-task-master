/**
 * VibeKit Execution Commands
 */

import { globalRegistry } from '../providers/registry.js';

/**
 * Execute a task using VibeKit SDK
 */
export async function executeTask(taskId, options = {}) {
  try {
    console.log(`🚀 Executing task ${taskId} with VibeKit...`);
    
    // Get task details
    const { getTask } = await import('../../task-manager/get-task.js');
    const task = await getTask({ id: taskId }, { projectRoot: options.projectRoot });
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Get VibeKit provider
    const provider = await globalRegistry.getProvider('vibekit', {
      repository: options.repository,
      defaultAgent: options.agent || 'claude'
    });

    // Execute task with streaming
    const result = await provider.executeTask(task, {
      projectRoot: options.projectRoot,
      branch: options.branch,
      agent: options.agent,
      mode: options.mode || 'code',
      onProgress: (data) => {
        console.log(`📊 Progress: ${data.progress}% - ${data.message}`);
      }
    });

    console.log(`✅ Task ${taskId} completed successfully!`);
    console.log(`📝 Summary: ${result.summary || 'No summary available'}`);
    
    if (result.files) {
      console.log(`📁 Files modified: ${result.files.length}`);
      result.files.forEach(file => console.log(`   - ${file}`));
    }

    return result;

  } catch (error) {
    console.error(`❌ Task execution failed: ${error.message}`);
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
          process.stdout.write(data.content || '');
        }
      }
    });

    console.log(`\n✅ Code generation completed!`);
    return result;

  } catch (error) {
    console.error(`❌ Code generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * List available VibeKit agents
 */
export async function listAgents(options = {}) {
  const providerInfo = globalRegistry.getProviderInfo('vibekit');
  
  if (options.json) {
    console.log(JSON.stringify(providerInfo.agents, null, 2));
    return;
  }

  console.log('🤖 Available VibeKit Agents:');
  console.log('');
  
  providerInfo.agents.forEach(agent => {
    const apiKey = getRequiredApiKey(agent);
    const configured = !!process.env[apiKey];
    const status = configured ? '✅' : '⚠️';
    
    console.log(`${status} ${agent}`);
    console.log(`   API Key: ${apiKey} ${configured ? '(configured)' : '(missing)'}`);
  });
  
  console.log('');
  console.log('Legend: ✅ Ready  ⚠️ Missing API Key');
}

function getRequiredApiKey(agent) {
  switch (agent) {
    case 'claude': return 'ANTHROPIC_API_KEY';
    case 'codex': return 'OPENAI_API_KEY';
    case 'gemini': return 'GOOGLE_API_KEY';
    case 'opencode': return 'OPENCODE_API_KEY';
    default: return 'ANTHROPIC_API_KEY';
  }
}
