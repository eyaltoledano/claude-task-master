import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import path from 'path';
import fs from 'fs';
import { VibeKit } from '@vibe-kit/sdk';
import LoadingSpinner from '../shared/components/ui/LoadingSpinner.jsx';
import AnimatedButton from '../shared/components/ui/AnimatedButton.jsx';
import ProgressBar from '../shared/components/ui/ProgressBar.jsx';
import { useAppContext } from '../app/index-root.jsx';

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
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('idle');
  const [currentMessage, setCurrentMessage] = useState('');
  const [streamingMessages, setStreamingMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState('');
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
      } else if (input === 'd') {
        // Debug mode: Show the prompt that would be sent
        setStep('debug');
      } else if (key.escape) {
        onClose();
      }
    } else if (step === 'debug') {
      if (key.return || key.escape) {
        // Return to config from debug mode
        setStep('config');
      }
    } else if (step === 'executing') {
      if (key.escape) {
        // Cancel execution and return to config
        setStep('config');
        setProgress(0);
        setCurrentPhase('cancelled');
        setCurrentMessage('Execution cancelled by user');
        setError('Execution cancelled');
      } else if (input === 'b') {
        // Move to background - close modal but continue execution
        onClose();
      }
    } else if (step === 'results') {
      if (input === 'r') {
        // Retry with same configuration
        setStep('executing');
        setError(null);
        setResults(null);
        executeWithVibeKit();
      } else if (input === 'c') {
        // Change configuration and retry
        setStep('config');
        setError(null);
        setResults(null);
        setSelectedOption(0);
      } else if (key.return || key.escape) {
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

  const getE2BTemplateForAgent = (agentType) => {
    const templateMapping = {
      'claude': 'claude',
      'codex': 'codex',
      'gemini': 'gemini',
      'opencode': 'opencode'
    };
    
    return templateMapping[agentType] || null;
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

  // Create VibeKit config exactly like the test file
  const createVibeKitConfig = async (agentType) => {
    console.log('Creating VibeKit config for agent:', agentType);
    
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
          templateId: getE2BTemplateForAgent(agentType) || process.env.E2B_TEMPLATE_ID || 'default'
        }
      }
    };

    // Add GitHub configuration using the same logic as the test file
    try {
      // First try to load OAuth token from ~/.taskmaster/github-token.json
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      const tokenPath = path.join(os.homedir(), '.taskmaster', 'github-token.json');
      
      try {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        if (tokenData.access_token) {
          baseConfig.github = {
            token: tokenData.access_token,
            repository: 'joedanz/test-repo'  // Same as test file
          };
          console.log('GitHub configuration added using OAuth token from ~/.taskmaster/github-token.json');
        }
      } catch (tokenError) {
        // Fall back to environment variables
        if (process.env.GITHUB_TOKEN || process.env.GITHUB_API_KEY) {
          const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_API_KEY;
          baseConfig.github = {
            token: githubToken,
            repository: 'joedanz/test-repo'  // Same as test file
          };
          console.log('GitHub configuration added using environment variable');
        } else {
          console.log('No GitHub token found - GitHub integration disabled');
        }
      }
    } catch (importError) {
      console.warn('Failed to load GitHub token:', importError.message);
    }

    console.log('VibeKit config created:', {
      agent: { type: baseConfig.agent.type, model: { ...baseConfig.agent.model, apiKey: '[REDACTED]' } },
      environment: { e2b: { ...baseConfig.environment.e2b, apiKey: '[REDACTED]' } },
      github: baseConfig.github ? { token: '[REDACTED]', repository: baseConfig.github.repository } : 'NOT_CONFIGURED'
    });

    return baseConfig;
  };

  const executeWithVibeKit = async () => {
    console.log('🚀 Starting VibeKit execution...');
    console.log('Config:', JSON.stringify(config, null, 2));
    console.log('Task:', JSON.stringify(task, null, 2));
    console.log('Subtask:', JSON.stringify(subtask, null, 2));
    console.log('Backend project root:', backend?.projectRoot);
    console.log('Process cwd:', process.cwd());
    
    // Debug: Check environment variables
    console.log('Environment variables check:', {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `[PRESENT - ${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...]` : 'MISSING',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `[PRESENT - ${process.env.OPENAI_API_KEY.substring(0, 10)}...]` : 'MISSING',
      E2B_API_KEY: process.env.E2B_API_KEY ? `[PRESENT - ${process.env.E2B_API_KEY.substring(0, 10)}...]` : 'MISSING',
      E2B_TEMPLATE_ID: process.env.E2B_TEMPLATE_ID || 'NOT_SET',
      GITHUB_TOKEN: process.env.GITHUB_TOKEN ? `[PRESENT - ${process.env.GITHUB_TOKEN.substring(0, 10)}...]` : 'MISSING'
    });
    
    // Check if we have the basic requirements
    if (!config.agent || !config.sandbox) {
      setError('Please select both an agent and sandbox environment');
      return;
    }
    
    setStep('executing');
    setError(null);
    setProgress(0);
    setCurrentPhase('initializing');
    setCurrentMessage('Setting up VibeKit configuration...');
    setStreamingMessages([]);
    
    let vibeKit = null;
    
    try {
      // Phase 1: Create VibeKit configuration
      setCurrentPhase('configuring');
      setCurrentMessage('Creating VibeKit configuration...');
      setProgress(10);
      
      console.log('Creating VibeKit config...');
      const vibeKitConfig = await createVibeKitConfig(config.agent);
      console.log('VibeKit config created successfully');
      
      // Phase 2: Test VibeKit instantiation
      setCurrentPhase('connecting');
      setCurrentMessage('Creating VibeKit instance...');
      setProgress(20);
      
      console.log('Creating VibeKit instance with config:', {
        agent: { 
          type: vibeKitConfig.agent.type,
          model: { 
            name: vibeKitConfig.agent.model.name,
            provider: vibeKitConfig.agent.model.provider,
            maxTokens: vibeKitConfig.agent.model.maxTokens,
            temperature: vibeKitConfig.agent.model.temperature,
            apiKey: vibeKitConfig.agent.model.apiKey ? '[REDACTED]' : 'MISSING'
          }
        },
        environment: { 
          e2b: { 
            templateId: vibeKitConfig.environment.e2b.templateId,
            apiKey: vibeKitConfig.environment.e2b.apiKey ? '[REDACTED]' : 'MISSING'
          }
        },
        github: vibeKitConfig.github ? { 
          repository: vibeKitConfig.github.repository,
          token: '[REDACTED]'
        } : 'NOT_CONFIGURED'
      });
      
      vibeKit = new VibeKit(vibeKitConfig);
      console.log('VibeKit instance created successfully');
      
      // Phase 3: Prepare task description and project context
      setCurrentPhase('preparing');
      setCurrentMessage('Preparing task description and project context...');
      setProgress(30);
      
      // Create comprehensive prompt with context (like the test file)
      const createComprehensivePrompt = () => {
        const baseTaskInfo = subtask 
          ? `Subtask ${task.id}.${subtask.id}: ${subtask.title}`
          : `Task ${task?.id}: ${task?.title}`;
        
        const description = subtask 
          ? (subtask.description || '')
          : (task?.description || '');
        
        const details = subtask 
          ? (subtask.details || '')
          : (task?.details || '');
        
        // Build comprehensive prompt with context
        let prompt = `${baseTaskInfo}\n\n`;
        
        if (description) {
          prompt += `Description:\n${description}\n\n`;
        }
        
        if (details) {
          prompt += `Implementation Details:\n${details}\n\n`;
        }
        
        // Add project context
        const projectPath = backend?.projectRoot || process.cwd();
        const projectName = projectPath.split('/').pop() || 'project';
        
        prompt += `Project Context:\n`;
        prompt += `- Project: ${projectName}\n`;
        prompt += `- Location: ${projectPath}\n`;
        prompt += `- Agent: ${config.agent}\n`;
        prompt += `- Environment: ${config.sandbox}\n\n`;
        
        // Add requirements section (like the test)
        prompt += `Requirements:\n`;
        prompt += `- Follow best practices for the technology stack\n`;
        prompt += `- Include proper error handling where appropriate\n`;
        prompt += `- Add comments for complex logic\n`;
        prompt += `- Ensure code is production-ready\n`;
        prompt += `- Create or update files as needed\n\n`;
        
        // Add task hierarchy context if this is a subtask
        if (subtask) {
          prompt += `Parent Task Context:\n`;
          prompt += `- Parent Task ${task.id}: ${task.title}\n`;
          if (task.description) {
            prompt += `- Parent Description: ${task.description}\n`;
          }
          if (task.details) {
            prompt += `- Parent Details: ${task.details}\n`;
          }
          prompt += `\n`;
        }
        
        // Add dependency context if available
        const dependencies = subtask?.dependencies || task?.dependencies || [];
        if (dependencies.length > 0) {
          prompt += `Dependencies:\n`;
          prompt += `- This task depends on: ${dependencies.join(', ')}\n`;
          prompt += `- Ensure these dependencies are considered in the implementation\n\n`;
        }
        
        return prompt;
      };
      
      const taskDescription = createComprehensivePrompt();
      
      // Get project path (moved up to fix linter errors)
      const projectPath = backend?.projectRoot || process.cwd();
      
      // Debug: Log the comprehensive prompt we're sending
      console.log('='.repeat(80));
      console.log('COMPREHENSIVE PROMPT BEING SENT TO VIBEKIT:');
      console.log('='.repeat(80));
      console.log(taskDescription);
      console.log('='.repeat(80));
      console.log(`Prompt length: ${taskDescription.length} characters`);
      console.log(`Prompt lines: ${taskDescription.split('\n').length} lines`);
      console.log('='.repeat(80));
      
      // Write prompt to log file for verification
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const taskId = subtask ? `${task.id}.${subtask.id}` : task?.id;
        
        const logData = {
          timestamp: new Date().toISOString(),
          taskId: taskId,
          taskTitle: subtask ? subtask.title : task?.title,
          agent: config.agent,
          sandbox: config.sandbox,
          projectRoot: projectPath,
          prompt: taskDescription,
          promptLength: taskDescription.length,
          promptLines: taskDescription.split('\n').length,
          vibeKitParams: {
            mode: "code",
            projectPath: projectPath,
            hasCallbacks: true
          }
        };
        
        // Write to prompt.log in the project root
        const logPath = path.join(projectPath, 'prompt.log');
        const logContent = `${'='.repeat(80)}\nVIBEKIT EXECUTION LOG\nTimestamp: ${logData.timestamp}\nTask: ${logData.taskId} - ${logData.taskTitle}\nAgent: ${logData.agent} | Sandbox: ${logData.sandbox}\nProject: ${logData.projectRoot}\n${'='.repeat(80)}\n\nCOMPREHENSIVE PROMPT:\n${'-'.repeat(40)}\n${logData.prompt}\n${'-'.repeat(40)}\n\nVIBEKIT PARAMETERS:\n${JSON.stringify(logData.vibeKitParams, null, 2)}\n\nPROMPT ANALYSIS:\n- Length: ${logData.promptLength} characters\n- Lines: ${logData.promptLines} lines\n- Has Parent Context: ${subtask ? 'Yes' : 'No'}\n- Has Dependencies: ${(subtask?.dependencies?.length || task?.dependencies?.length) ? 'Yes' : 'No'}\n\n${'='.repeat(80)}\nEND LOG ENTRY\n${'='.repeat(80)}\n\n`;
        
        fs.writeFileSync(logPath, logContent);
        console.log(`✅ Prompt logged to: ${logPath}`);
        
        // Also write to Task Master project directory for reference
        const taskMasterLogPath = path.join(process.cwd(), 'prompt.log');
        fs.writeFileSync(taskMasterLogPath, logContent);
        console.log(`✅ Prompt also logged to: ${taskMasterLogPath}`);
        
      } catch (logError) {
        console.warn('⚠️  Could not write prompt log:', logError.message);
      }
      
      console.log('Using project path:', projectPath);
      
      // Debug: Check if project path exists and what's in it
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        if (fs.existsSync(projectPath)) {
          console.log('✅ Project path exists');
          
          // List some key files to understand project structure
          const files = fs.readdirSync(projectPath).slice(0, 10); // First 10 files
          console.log('Project files (first 10):', files.join(', '));
          
          // Check for common project files
          const commonFiles = ['package.json', 'README.md', '.git', 'src', 'lib', 'index.js', 'index.ts'];
          const foundFiles = commonFiles.filter(file => fs.existsSync(path.join(projectPath, file)));
          console.log('Common project files found:', foundFiles.join(', '));
        } else {
          console.log('❌ Project path does not exist!');
        }
      } catch (fsError) {
        console.log('⚠️  Could not check project path:', fsError.message);
      }
      
      // Phase 4: Execute code generation with streaming
      setCurrentPhase('generating');
      setCurrentMessage('Starting code generation...');
      setProgress(40);
      
      const streamingUpdates = [];
      let hasStreamingError = false;
      
      console.log('Starting VibeKit code generation...');
      console.log('About to call vibeKit.generateCode with parameters:');
      console.log('='.repeat(50));
      console.log('Parameters being passed to generateCode:');
      console.log('- prompt:', taskDescription.substring(0, 200) + '...');
      console.log('- mode:', 'code');
      console.log('- projectPath:', projectPath);
      console.log('- hasCallbacks:', true);
      console.log('='.repeat(50));
      
      // Create the generateCode parameters object
      const generateCodeParams = {
        prompt: taskDescription,
        mode: "code",
        // Add project path if the working directory matters
        ...(projectPath && projectPath !== process.cwd() ? { projectPath } : {}),
        callbacks: {
          onUpdate: (message) => {
            streamingUpdates.push(message);
            console.log('VibeKit update:', message);
            
            const timestampedMessage = {
              content: message,
              timestamp: new Date().toISOString(),
              time: new Date().toLocaleTimeString()
            };
            setStreamingMessages(prev => [...prev, timestampedMessage]);
            
            // Show real-time streaming updates
            const preview = message.length > 100 ? message.substring(0, 100) + '...' : message;
            console.log(`[${timestampedMessage.time}] Stream: ${preview}`);
            setCurrentMessage(`Streaming: ${preview}`);
            
            // Update progress gradually
            setProgress(prev => Math.min(prev + 1, 80));
          },
          onError: (error) => {
            hasStreamingError = true;
            console.error('VibeKit streaming error:', error);
            console.error('Error details:', {
              message: error.message,
              stack: error.stack,
              code: error.code,
              signal: error.signal
            });
            
            const errorMessage = {
              content: `ERROR: ${error.message || error}`,
              timestamp: new Date().toISOString(),
              time: new Date().toLocaleTimeString(),
              isError: true
            };
            setStreamingMessages(prev => [...prev, errorMessage]);
          }
        }
      };
      
      console.log('Final generateCode parameters object:');
      console.log(JSON.stringify({
        ...generateCodeParams,
        prompt: generateCodeParams.prompt.substring(0, 200) + '...',
        callbacks: {
          onUpdate: '[FUNCTION]',
          onError: '[FUNCTION]'
        }
      }, null, 2));
      
      const result = await vibeKit.generateCode(generateCodeParams);

      if (hasStreamingError) {
        throw new Error('Streaming encountered errors during code generation');
      }

      if (streamingUpdates.length === 0) {
        throw new Error('No streaming updates received during code generation');
      }

      console.log('VibeKit execution completed successfully:', result);
      
      // Phase 5: Create Pull Request if GitHub is configured
      let pullRequest = null;
      if (vibeKitConfig.github) {
        setCurrentPhase('creating-pr');
        setCurrentMessage('Creating pull request...');
        setProgress(90);
        
        try {
          // Create unique branch prefix using agent type and timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const uniqueBranchPrefix = `${config.agent}-${timestamp}`;
          
          console.log('Creating PR with branch prefix:', uniqueBranchPrefix);
          console.log('Note: VibeKit SDK will automatically add /feature/ to create full branch name like:', `${uniqueBranchPrefix}/feature/task-name`);
          
          // Create label name based on task/subtask
          const labelName = subtask 
            ? `Task ${task.id}.${subtask.id}`
            : `Task ${task?.id}`;
          
          pullRequest = await vibeKit.createPullRequest(
            {
              name: labelName,
              color: "0e8a16",
              description: `Code generated by ${config.agent} agent for ${subtask ? 'subtask' : 'task'} ${subtask ? `${task.id}.${subtask.id}` : task?.id}`
            },
            uniqueBranchPrefix  // VibeKit SDK automatically adds /feature/ prefix to this
          );
          
          console.log('Pull request created:', pullRequest);
        } catch (prError) {
          console.warn('PR creation failed:', prError.message);
          console.warn('PR error details:', prError);
          // Don't fail the entire execution for PR issues
        }
      }
      
      // Phase 6: Complete
      setCurrentPhase('completed');
      setCurrentMessage('Execution completed successfully!');
      setProgress(100);
      
      // Set results with comprehensive information
      setResults({
        success: true,
        agent: config.agent,
        environment: config.sandbox,
        streamingUpdates: streamingUpdates.length,
        codeResult: result,
        pullRequest: pullRequest,
        taskInfo: {
          taskId: task?.id,
          subtaskId: subtask?.id,
          title: subtask ? subtask.title : task?.title
        }
      });
      
      setStep('results');
      
      if (onComplete) {
        onComplete({
          success: true,
          streamingUpdates: streamingUpdates.length,
          pullRequest: pullRequest,
          result: result
        });
      }
      
    } catch (error) {
      console.error('VibeKit execution failed:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        signal: error.signal,
        stdout: error.stdout,
        stderr: error.stderr,
        name: error.name,
        cause: error.cause
      });
      
      const errorMessage = {
        content: `EXECUTION FAILED: ${error.message}`,
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString(),
        isError: true
      };
      setStreamingMessages(prev => [...prev, errorMessage]);
      
      setError(error.message || 'Unknown error occurred');
      setCurrentPhase('failed');
      setCurrentMessage('Execution failed');
      setResults({
        success: false,
        error: error.message,
        agent: config.agent,
        environment: config.sandbox
      });
      setStep('results'); // Show results even on failure for retry option
    } finally {
      // Always cleanup sandbox
      if (vibeKit) {
        try {
          setCurrentMessage('Cleaning up sandbox...');
          console.log('Cleaning up VibeKit sandbox...');
          await vibeKit.kill();
          console.log('Sandbox cleaned up successfully');
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
            Use ↑↓ to navigate, Enter to select/toggle, d to debug/preview prompt, Esc to cancel
          </Text>
        </>
      )}

      {step === 'debug' && (
        <Box flexDirection="column" height={25}>
          <Box marginBottom={1}>
            <Text bold color="yellow">🔍 Debug Mode - Preview Prompt</Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text color="gray">
              This is the comprehensive prompt that would be sent to VibeKit:
            </Text>
          </Box>
          
          <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1} height={20}>
            <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
              <Text bold color="cyan">Comprehensive Prompt Preview</Text>
              <Text color="gray">Agent: {config.agent}</Text>
            </Box>
            
            <Box flexDirection="column" height={18}>
              {(() => {
                // Create the same comprehensive prompt that would be sent
                const baseTaskInfo = subtask 
                  ? `Subtask ${task.id}.${subtask.id}: ${subtask.title}`
                  : `Task ${task?.id}: ${task?.title}`;
                
                const description = subtask 
                  ? (subtask.description || '')
                  : (task?.description || '');
                
                const details = subtask 
                  ? (subtask.details || '')
                  : (task?.details || '');
                
                let prompt = `${baseTaskInfo}\n\n`;
                
                if (description) {
                  prompt += `Description:\n${description}\n\n`;
                }
                
                if (details) {
                  prompt += `Implementation Details:\n${details}\n\n`;
                }
                
                // Add project context
                const projectPath = backend?.projectRoot || process.cwd();
                const projectName = projectPath.split('/').pop() || 'project';
                
                prompt += `Project Context:\n`;
                prompt += `- Project: ${projectName}\n`;
                prompt += `- Location: ${projectPath}\n`;
                prompt += `- Agent: ${config.agent}\n`;
                prompt += `- Environment: ${config.sandbox}\n\n`;
                
                prompt += `Requirements:\n`;
                prompt += `- Follow best practices for the technology stack\n`;
                prompt += `- Include proper error handling where appropriate\n`;
                prompt += `- Add comments for complex logic\n`;
                prompt += `- Ensure code is production-ready\n`;
                prompt += `- Create or update files as needed\n\n`;
                
                if (subtask) {
                  prompt += `Parent Task Context:\n`;
                  prompt += `- Parent Task ${task.id}: ${task.title}\n`;
                  if (task.description) {
                    prompt += `- Parent Description: ${task.description}\n`;
                  }
                  if (task.details) {
                    prompt += `- Parent Details: ${task.details}\n`;
                  }
                  prompt += `\n`;
                }
                
                const dependencies = subtask?.dependencies || task?.dependencies || [];
                if (dependencies.length > 0) {
                  prompt += `Dependencies:\n`;
                  prompt += `- This task depends on: ${dependencies.join(', ')}\n`;
                  prompt += `- Ensure these dependencies are considered in the implementation\n\n`;
                }
                
                // Split into lines and show with line numbers
                const lines = prompt.split('\n');
                return lines.slice(0, 16).map((line, index) => (
                  <Box key={`debug-line-${index}-${line.substring(0, 20).replace(/\s/g, '_')}`}>
                    <Text color="green">{String(index + 1).padStart(2, '0')}</Text>
                    <Text color="white">: {line}</Text>
                  </Box>
                ));
              })()}
              
              <Box marginTop={1}>
                <Text color="yellow">
                  ... showing first 16 lines. Full prompt will be sent to VibeKit.
                </Text>
              </Box>
            </Box>
          </Box>
          
          <Box marginTop={1} flexDirection="column">
            <Text color="cyan">Debug Information:</Text>
            <Box marginLeft={2}>
              <Text>Project Path: {backend?.projectRoot || process.cwd()}</Text>
            </Box>
            <Box marginLeft={2}>
              <Text>Task ID: {subtask ? `${task.id}.${subtask.id}` : task?.id}</Text>
            </Box>
            <Box marginLeft={2}>
              <Text>Selected Agent: {config.agent}</Text>
            </Box>
            <Box marginLeft={2}>
              <Text>Selected Sandbox: {config.sandbox}</Text>
            </Box>
          </Box>
          
          <Box marginTop={1}>
            <Text color="gray">Press Enter or Esc to return to configuration</Text>
          </Box>
        </Box>
      )}

      {step === 'executing' && (
        <Box flexDirection="column" height={25}>
          <Box marginBottom={1}>
            <Text color="blue">🚀 Agent Execution in Progress</Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text>Agent: {config.agent} | Sandbox: {config.sandbox} | Template: {config.agent}</Text>
          </Box>
          
          <Box marginBottom={1} flexDirection="column">
            <Text>Phase: {currentPhase}</Text>
            <Box marginLeft={2} flexDirection="row">
              <ProgressBar progress={progress} />
              <Text color="gray"> {progress}%</Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="gray">{currentMessage}</Text>
            </Box>
          </Box>
          
          {/* Streaming Messages Display */}
          <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1} height={14}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold color="cyan">Live Streaming Output</Text>
              <Text color="gray">({streamingMessages.length} messages)</Text>
            </Box>
            <Box flexDirection="column" height={12}>
              {streamingMessages.length === 0 ? (
                <Box justifyContent="center" alignItems="center" height={12}>
                  <Text color="gray">Waiting for agent to start streaming...</Text>
                </Box>
              ) : (
                streamingMessages.slice(-15).map((messageObj, index) => {
                  const preview = typeof messageObj.content === 'string' 
                    ? (messageObj.content.length > 90 ? messageObj.content.substring(0, 90) + '...' : messageObj.content)
                    : JSON.stringify(messageObj.content).substring(0, 90) + '...';
                  
                  return (
                    <Box key={`stream-${messageObj.timestamp}-${index}`} marginBottom={0}>
                      <Text color="green">[{messageObj.time}]</Text>
                      <Text color={messageObj.isError ? "red" : "white"}> {preview}</Text>
                    </Box>
                  );
                })
              )}
              {streamingMessages.length > 15 && (
                <Box>
                  <Text color="yellow">... showing last 15 of {streamingMessages.length} messages</Text>
                </Box>
              )}
            </Box>
          </Box>
          
          <Box marginTop={1} flexDirection="column">
            <Text color="cyan">Options:</Text>
            <Box marginLeft={2}>
              <Text color="white">b - Move to background (continue execution)</Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="white">Esc - Cancel execution</Text>
            </Box>
          </Box>
        </Box>
      )}

      {step === 'results' && results && (
        <Box flexDirection="column" height={25}>
          <Box marginBottom={1}>
            <Text bold color={results.success ? 'green' : 'red'}>
              {results.success ? '✅ Agent Execution Completed' : '❌ Agent Execution Failed'}
            </Text>
          </Box>
          
          {/* Task Information */}
          <Box marginBottom={1}>
            <Text color="cyan">
              {results.taskInfo ? 
                `${results.taskInfo.subtaskId ? 'Subtask' : 'Task'} ${results.taskInfo.subtaskId || results.taskInfo.taskId}: ${results.taskInfo.title}` :
                'Task execution completed'
              }
            </Text>
          </Box>
          
          {/* Configuration Summary */}
          <Box marginBottom={1} flexDirection="column">
            <Text color="gray">Configuration:</Text>
            <Box marginLeft={2}>
              <Text>Agent: {results.agent} | Environment: {results.environment}</Text>
            </Box>
          </Box>
          
          {results.success ? (
            <Box flexDirection="column">
              {/* Execution Summary */}
              <Box marginBottom={1} flexDirection="column">
                <Text color="green">✨ Execution Summary:</Text>
                <Box marginLeft={2} flexDirection="column">
                  {results.streamingUpdates && (
                    <Text>📡 Received {results.streamingUpdates} streaming updates</Text>
                  )}
                  {results.codeResult && (
                    <Text>💻 Code generation completed successfully</Text>
                  )}
                  {results.pullRequest ? (
                    <Text color="blue">🔗 Pull request created successfully</Text>
                  ) : (
                    <Text color="yellow">⚠️  No pull request created (GitHub not configured)</Text>
                  )}
                  <Text>🧹 Sandbox cleaned up</Text>
                </Box>
              </Box>
              
              {/* GitHub Integration Results */}
              {results.pullRequest && (
                <Box marginBottom={1} flexDirection="column">
                  <Text color="blue">🐙 GitHub Integration:</Text>
                  <Box marginLeft={2} flexDirection="column">
                    <Text color="green">PR #{results.pullRequest.number}: {results.pullRequest.title || 'Code generation'}</Text>
                    <Text>Branch: {results.pullRequest.head?.ref || 'unknown'}</Text>
                    <Text>Commit: {results.pullRequest.head?.sha?.substring(0, 8) || 'unknown'}</Text>
                    <Text color="cyan">URL: {results.pullRequest.html_url}</Text>
                  </Box>
                </Box>
              )}
              
              {/* Code Generation Details */}
              {results.codeResult && (
                <Box marginBottom={1} flexDirection="column">
                  <Text color="green">📝 Code Generation:</Text>
                  <Box marginLeft={2} flexDirection="column">
                    {results.codeResult.code && (
                      <Text>Generated {results.codeResult.code.length} characters of code</Text>
                    )}
                    {results.codeResult.files && (
                      <Text>Created {results.codeResult.files.length} files</Text>
                    )}
                    <Text color="gray">Mode: code generation with streaming</Text>
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="red">💥 Error Details:</Text>
              <Box marginLeft={2}>
                <Text color="red">{results.error}</Text>
              </Box>
              <Box marginTop={1} marginLeft={2}>
                <Text color="yellow">💡 Troubleshooting:</Text>
                <Text color="gray">• Check that all required environment variables are set</Text>
                <Text color="gray">• Verify E2B template '{results.agent}' exists</Text>
                <Text color="gray">• Ensure API keys have sufficient permissions</Text>
              </Box>
            </Box>
          )}
          
          {/* Action Buttons */}
          <Box marginTop={1} flexDirection="column">
            <Text color="cyan">Actions:</Text>
            <Box marginLeft={2}>
              <Text color="white">r - Retry with same configuration</Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="white">c - Change configuration and retry</Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="white">Enter/Esc - Close</Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
} 