import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import path from 'path';
import fs from 'fs';
import { VibeKit } from '@vibe-kit/sdk';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import AnimatedButton from './ui/AnimatedButton.jsx';
import ProgressBar from './ui/ProgressBar.jsx';
import { useAppContext } from '../index.jsx';

export function VibeKitExecutionModal({ 
  task, 
  subtask, 
  isVisible, 
  onClose, 
  onComplete 
}) {
  const { exit } = useApp();
  const { backend } = useAppContext();
  const [step, setStep] = useState('config'); // config, executing, results
  const [config, setConfig] = useState({
    agent: null, // Will be set to first enabled agent
    sandbox: null, // Will be set to first enabled sandbox
    mode: 'code',
    createPR: true,
    runTests: false,
    cleanupSandbox: true,
    branch: `subtask-${subtask?.id || task?.id}`
  });
  const [selectedOption, setSelectedOption] = useState(0);
  const [progress, setProgress] = useState({ phase: 'idle', progress: 0, message: '' });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [enabledAgents, setEnabledAgents] = useState([]);
  const [enabledSandboxes, setEnabledSandboxes] = useState([]);
  
  // Load enabled agents and sandboxes from config files
  useEffect(() => {
    const loadConfigurations = async () => {
      try {
        const projectRoot = backend?.projectRoot || process.cwd();
        const taskMasterRoot = process.cwd(); // Where Task Master is running from
        
        // Helper function to try loading from project root first, then fallback to Task Master root
        const loadConfigFile = (filename) => {
          const projectPath = path.join(projectRoot, 'scripts/modules/flow/config', filename);
          const fallbackPath = path.join(taskMasterRoot, 'scripts/modules/flow/config', filename);
          
          try {
            // Try project root first
            if (fs.existsSync(projectPath)) {
              return JSON.parse(fs.readFileSync(projectPath, 'utf8'));
            }
            // Fallback to Task Master root
            if (fs.existsSync(fallbackPath)) {
              return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
            }
            throw new Error(`Config file ${filename} not found in either ${projectPath} or ${fallbackPath}`);
          } catch (err) {
            throw new Error(`Failed to load ${filename}: ${err.message}`);
          }
        };
        
        // Load agents configuration
        const agentsConfig = loadConfigFile('agents.json');
        const agents = Object.entries(agentsConfig.agents)
          .filter(([_, agentConfig]) => agentConfig.enabled)
          .map(([name, _]) => name);
        
        // Load sandboxes configuration
        const sandboxesConfig = loadConfigFile('sandboxes.json');
        const sandboxes = Object.entries(sandboxesConfig.sandboxes)
          .filter(([_, sandboxConfig]) => sandboxConfig.active)
          .sort(([_, a], [__, b]) => a.rank - b.rank)
          .map(([name, _]) => name);
        
        setEnabledAgents(agents);
        setEnabledSandboxes(sandboxes);
        
        // Set default selections to first enabled options
        if (agents.length > 0 && sandboxes.length > 0) {
          setConfig(prev => ({
            ...prev,
            agent: agents[0],
            sandbox: sandboxes[0]
          }));
        }
      } catch (err) {
        console.error('Failed to load configurations:', err);
        setError(`Failed to load agent/sandbox configurations: ${err.message}`);
      }
    };

    if (isVisible && backend) {
      loadConfigurations();
    }
  }, [isVisible, backend]);

  const configOptions = [
    { key: 'agent', label: 'AI Agent', value: config.agent },
    { key: 'sandbox', label: 'Sandbox Environment', value: config.sandbox },
    { key: 'execute', label: '🚀 Launch Agent!', value: null }
  ];

  useInput((input, key) => {
    if (!isVisible) return;
    
    if (step === 'config') {
      if (key.upArrow) {
        setSelectedOption(Math.max(0, selectedOption - 1));
      } else if (key.downArrow) {
        setSelectedOption(Math.min(configOptions.length - 1, selectedOption + 1));
      } else if (key.return) {
        handleConfigSelection();
      } else if (key.escape) {
        onClose();
      }
    } else if (step === 'executing') {
      if (key.escape) {
        // Allow cancellation during execution
        setStep('config');
        setProgress({ phase: 'cancelled', progress: 0, message: 'Execution cancelled' });
      }
    } else if (step === 'results') {
      if (key.return || key.escape) {
        onClose();
      }
    }
  });

  const handleConfigSelection = () => {
    const selected = configOptions[selectedOption];
    
    switch (selected.key) {
      case 'agent': {
        if (enabledAgents.length === 0) return;
        const currentAgentIndex = enabledAgents.indexOf(config.agent);
        const nextAgentIndex = (currentAgentIndex + 1) % enabledAgents.length;
        setConfig(prev => ({ ...prev, agent: enabledAgents[nextAgentIndex] }));
        break;
      }
        
      case 'sandbox': {
        if (enabledSandboxes.length === 0) return;
        const currentSandboxIndex = enabledSandboxes.indexOf(config.sandbox);
        const nextSandboxIndex = (currentSandboxIndex + 1) % enabledSandboxes.length;
        setConfig(prev => ({ ...prev, sandbox: enabledSandboxes[nextSandboxIndex] }));
        break;
      }
        
      case 'execute':
        executeWithVibeKit();
        break;
    }
  };

  // Helper functions from the test file
  const getApiKeyForAgent = (agentType) => {
    const keyMapping = {
      'claude': process.env.ANTHROPIC_API_KEY,
      'codex': process.env.OPENAI_API_KEY,
      'gemini': process.env.GOOGLE_API_KEY,
      'opencode': process.env.OPENAI_API_KEY
    };
    
    return keyMapping[agentType] || process.env.ANTHROPIC_API_KEY;
  };

  const getModelForAgent = (agentType) => {
    const modelMap = {
      'claude': 'claude-3-5-sonnet-20241022',
      'codex': 'gpt-4-turbo-preview',
      'gemini': 'gemini-1.5-pro',
      'opencode': 'deepseek-coder-v2'
    };
    
    return modelMap[agentType] || 'claude-3-5-sonnet-20241022';
  };

  const getProviderForAgent = (agentType) => {
    const providerMap = {
      'claude': 'anthropic',
      'codex': 'openai',
      'gemini': 'gemini',
      'opencode': 'opencode'
    };
    
    return providerMap[agentType] || 'anthropic';
  };

  // Create VibeKit configuration following the test pattern
  const createVibeKitConfig = (agentType) => {
    const baseConfig = {
      agent: {
        type: agentType,
        model: {
          apiKey: getApiKeyForAgent(agentType),
          name: getModelForAgent(agentType),
          provider: getProviderForAgent(agentType),
          maxTokens: 4000,
          temperature: 0.7
        },
      },
      environment: {
        e2b: {
          apiKey: process.env.E2B_API_KEY,
          templateId: process.env.E2B_TEMPLATE_ID
        }
      }
    };

    // Add GitHub configuration if available
    if (process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
      baseConfig.github = {
        token: process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
        repository: 'your-repo/name' // This should be configurable
      };
    }

    return baseConfig;
  };

  const executeWithVibeKit = async () => {
    if (!config.agent || !config.sandbox) {
      setError('Please select both an agent and sandbox environment');
      return;
    }

    setStep('executing');
    setError(null);
    
    let vibeKit = null;
    
    try {
      // Update Task Master status
      const targetId = subtask?.id ? `${task.id}.${subtask.id}` : task?.id;
      
      if (subtask) {
        await backend.updateSubtask(targetId, {
          prompt: `Starting VibeKit execution with ${config.agent} agent`
        });
      } else {
        await backend.setTaskStatus(targetId, 'in-progress');
      }

      setProgress({
        phase: 'initializing',
        progress: 10,
        message: 'Creating VibeKit instance...'
      });

      // Create VibeKit configuration
      const vibeKitConfig = createVibeKitConfig(config.agent);
      vibeKit = new VibeKit(vibeKitConfig);

      setProgress({
        phase: 'code-generation',
        progress: 20,
        message: 'Starting code generation...'
      });

      // Create the prompt from task/subtask data
      const executionTarget = subtask || task;
      const prompt = `Implement: ${executionTarget.title}

Description: ${executionTarget.description || 'No description provided'}

Details: ${executionTarget.details || 'No additional details provided'}

Requirements:
- Create clean, well-documented code
- Follow best practices for the technology stack
- Include error handling where appropriate
- Add comments explaining key functionality`;

      // Generate code with streaming (following test pattern)
      const streamingUpdates = [];
      let hasStreamingError = false;
      
      const codeResult = await vibeKit.generateCode({
        prompt: prompt,
        mode: "code",
        callbacks: {
          onUpdate: (message) => {
            streamingUpdates.push(message);
            const preview = message.length > 100 ? message.substring(0, 100) + '...' : message;
            setProgress({
              phase: 'code-generation',
              progress: Math.min(40 + (streamingUpdates.length * 2), 70),
              message: `Generating code: ${preview}`
            });
          },
          onError: (error) => {
            hasStreamingError = true;
            console.error('Streaming error:', error);
          }
        }
      });

      if (hasStreamingError) {
        throw new Error('Code generation streaming encountered errors');
      }

      if (streamingUpdates.length === 0) {
        throw new Error('No streaming updates received during code generation');
      }

      setProgress({
        phase: 'pull-request',
        progress: 80,
        message: 'Creating pull request...'
      });

      // Create pull request if GitHub is configured
      let pullRequest = null;
      if (vibeKitConfig.github) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const uniqueBranchPrefix = `${config.agent}-${timestamp}`;
          
          pullRequest = await vibeKit.createPullRequest(
            {
              name: "taskmaster-agent",
              color: "0e8a16",
              description: `Code generated by ${config.agent} agent for ${subtask ? 'subtask' : 'task'} ${targetId}`
            },
            uniqueBranchPrefix
          );
        } catch (prError) {
          console.warn('PR creation failed:', prError.message);
          // Don't fail the entire execution for PR issues
        }
      }

      setProgress({
        phase: 'completed',
        progress: 100,
        message: 'Execution completed successfully!'
      });

      // Update final Task Master status
      if (subtask) {
        await backend.updateSubtask(targetId, {
          prompt: `VibeKit execution completed successfully. Generated ${streamingUpdates.length} code updates.${pullRequest ? ` PR: ${pullRequest.html_url}` : ''}`
        });
        await backend.setTaskStatus(targetId, 'done');
      } else {
        await backend.setTaskStatus(targetId, 'done');
      }

      setResults({
        success: true,
        steps: {
          codeGeneration: { streamingUpdates: streamingUpdates.length },
          pullRequestCreation: pullRequest ? { number: pullRequest.number, url: pullRequest.html_url } : null,
          sandboxCleanup: config.cleanupSandbox
        },
        agent: config.agent,
        environment: config.sandbox
      });

      setStep('results');
      
      if (onComplete) {
        onComplete({
          success: true,
          streamingUpdates: streamingUpdates.length,
          pullRequest: pullRequest
        });
      }
      
    } catch (err) {
      console.error('VibeKit execution failed:', err);
      setError(err.message);
      setStep('config');
      
      // Log error to Task Master
      const targetId = subtask?.id ? `${task.id}.${subtask.id}` : task?.id;
      if (subtask) {
        await backend.updateSubtask(targetId, {
          prompt: `VibeKit execution failed: ${err.message}`
        });
      }

      setResults({
        success: false,
        error: err.message
      });
    } finally {
      // Always cleanup sandbox
      if (vibeKit && config.cleanupSandbox) {
        try {
          setProgress({
            phase: 'cleanup',
            progress: 95,
            message: 'Cleaning up sandbox...'
          });
          await vibeKit.kill();
        } catch (cleanupError) {
          console.warn('Sandbox cleanup failed:', cleanupError.message);
        }
      }
    }
  };

  if (!isVisible) return null;

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="blue">
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="blue">
          🤖 Agent Execution - {subtask ? `Subtask ${task.id}.${subtask.id}` : `Task ${task?.id}`}
        </Text>
      </Box>
      
      {error && (
        <Box marginBottom={1}>
          <Text color="red">❌ Error: {error}</Text>
        </Box>
      )}

      {step === 'config' && (
        <>
          <Box marginBottom={1}>
            <Text color="gray">
              {subtask ? 'Subtask:' : 'Task:'} {subtask ? subtask.title : task?.title}
            </Text>
          </Box>
          
          {enabledAgents.length === 0 || enabledSandboxes.length === 0 ? (
            <Box marginBottom={1}>
              <Text color="red">
                {enabledAgents.length === 0 && '❌ No enabled agents found in agents.json'}
                {enabledSandboxes.length === 0 && '❌ No active sandboxes found in sandboxes.json'}
              </Text>
            </Box>
          ) : (
            <>
              <Box flexDirection="column" marginBottom={1}>
                {configOptions.map((option, index) => (
                  <Box key={`config-${option.key}`}>
                    <Text 
                      color={index === selectedOption ? 'blue' : 'white'}
                      bold={index === selectedOption}
                    >
                      {index === selectedOption ? '▶ ' : '  '}
                      {option.label}: {option.value || ''}
                    </Text>
                  </Box>
                ))}
              </Box>
              
            </>
          )}
          
          <Text color="gray" marginTop={1}>
            Use ↑↓ to navigate, Enter to select/toggle, Esc to cancel
          </Text>
        </>
      )}

      {step === 'executing' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <LoadingSpinner />
            <Text color="blue"> Executing with VibeKit...</Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text>Phase: {progress.phase}</Text>
          </Box>
          
          <Box marginBottom={1}>
            <ProgressBar progress={progress.progress} />
          </Box>
          
          <Box marginBottom={1}>
            <Text color="gray">{progress.message}</Text>
          </Box>
          
          <Text color="gray" marginTop={1}>
            Press Esc to cancel
          </Text>
        </Box>
      )}

      {step === 'results' && results && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color={results.success ? 'green' : 'red'}>
              {results.success ? '✅ Execution Completed' : '❌ Execution Failed'}
            </Text>
          </Box>
          
          {results.success && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="green">Workflow Summary:</Text>
              {results.steps.codeGeneration && (
                <Text>  ✅ Code generated ({results.steps.codeGeneration.streamingUpdates} updates)</Text>
              )}
              {results.steps.pullRequestCreation && (
                <Text color="blue">  🔗 PR Created: #{results.steps.pullRequestCreation.number}</Text>
              )}
              {results.steps.sandboxCleanup && (
                <Text>  🧹 Sandbox cleaned up</Text>
              )}
            </Box>
          )}
          
          {!results.success && results.error && (
            <Box marginBottom={1}>
              <Text color="red">Error: {results.error}</Text>
            </Box>
          )}
          
          <Text color="gray" marginTop={1}>
            Press Enter or Esc to close
          </Text>
        </Box>
      )}
    </Box>
  );
} 