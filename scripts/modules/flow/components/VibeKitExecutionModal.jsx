import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import path from 'path';
import { VibeKitService } from '../services/vibekit.service.js';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import AnimatedButton from './ui/AnimatedButton.jsx';
import ProgressBar from './ui/ProgressBar.jsx';
import { updateSubtaskById as updateSubtask, setTaskStatus } from '../../task-manager.js';

export function VibeKitExecutionModal({ 
  task, 
  subtask, 
  isVisible, 
  onClose, 
  onComplete,
  projectRoot 
}) {
  const { exit } = useApp();
  const [step, setStep] = useState('config'); // config, executing, results
  const [config, setConfig] = useState({
    agent: 'claude-code',
    sandbox: 'e2b',
    mode: 'code',
    createPR: true,
    runTests: true,
    cleanupSandbox: false,
    branch: `subtask-${subtask?.id || task?.id}`
  });
  const [vibeKitService, setVibeKitService] = useState(null);
  const [configStatus, setConfigStatus] = useState(null);
  const [selectedOption, setSelectedOption] = useState(0);
  const [progress, setProgress] = useState({ phase: 'idle', progress: 0, message: '' });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  // Initialize VibeKit service and check configuration
  useEffect(() => {
    if (isVisible) {
      try {
        const service = new VibeKitService({
          projectRoot,
          strictValidation: false,
          agent: { type: config.agent },
          environments: {
            e2b: { apiKey: process.env.E2B_API_KEY },
            northflank: { apiKey: process.env.NORTHFLANK_API_KEY },
            daytona: { apiKey: process.env.DAYTONA_API_KEY }
          }
        });
        
        setVibeKitService(service);
        setConfigStatus(service.getConfigurationStatus());
      } catch (err) {
        setError(`VibeKit initialization failed: ${err.message}`);
      }
    }
  }, [isVisible, projectRoot, config.agent]);

  const configOptions = [
    { key: 'agent', label: 'AI Agent', value: config.agent },
    { key: 'sandbox', label: 'Sandbox Environment', value: config.sandbox },
    { key: 'mode', label: 'Execution Mode', value: config.mode },
    { key: 'createPR', label: 'Create Pull Request', value: config.createPR ? 'Yes' : 'No' },
    { key: 'runTests', label: 'Run Tests', value: config.runTests ? 'Yes' : 'No' },
    { key: 'cleanupSandbox', label: 'Cleanup Sandbox', value: config.cleanupSandbox ? 'Yes' : 'No' },
    { key: 'execute', label: '🚀 Execute with VibeKit', value: null }
  ];

  	const agentOptions = ['claude', 'codex', 'gemini', 'opencode'];
  const sandboxOptions = ['e2b', 'northflank', 'daytona', 'local'];
  const modeOptions = ['code', 'ask'];

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
        const currentAgentIndex = agentOptions.indexOf(config.agent);
        const nextAgentIndex = (currentAgentIndex + 1) % agentOptions.length;
        setConfig(prev => ({ ...prev, agent: agentOptions[nextAgentIndex] }));
        break;
      }
        
      case 'sandbox': {
        const currentSandboxIndex = sandboxOptions.indexOf(config.sandbox);
        const nextSandboxIndex = (currentSandboxIndex + 1) % sandboxOptions.length;
        setConfig(prev => ({ ...prev, sandbox: sandboxOptions[nextSandboxIndex] }));
        break;
      }
        
      case 'mode': {
        const currentModeIndex = modeOptions.indexOf(config.mode);
        const nextModeIndex = (currentModeIndex + 1) % modeOptions.length;
        setConfig(prev => ({ ...prev, mode: modeOptions[nextModeIndex] }));
        break;
      }
        
      case 'createPR':
        setConfig(prev => ({ ...prev, createPR: !prev.createPR }));
        break;
        
      case 'runTests':
        setConfig(prev => ({ ...prev, runTests: !prev.runTests }));
        break;
        
      case 'cleanupSandbox':
        setConfig(prev => ({ ...prev, cleanupSandbox: !prev.cleanupSandbox }));
        break;
        
      case 'execute':
        executeWithVibeKit();
        break;
    }
  };

  const executeWithVibeKit = async () => {
    if (!vibeKitService) {
      setError('VibeKit service not initialized');
      return;
    }

    if (!projectRoot) {
      setError('Project root not provided');
      return;
    }

    setStep('executing');
    setError(null);
    
    try {
      // Update Task Master status
      const targetId = subtask?.id ? `${task.id}.${subtask.id}` : task?.id;
      const targetType = subtask ? 'subtask' : 'task';
      
      const tasksPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
      
      if (subtask) {
        await updateSubtask(tasksPath, targetId, `Starting VibeKit execution with ${config.agent} agent`);
      } else {
        await setTaskStatus(tasksPath, targetId, 'in-progress');
      }

      // Execute the task/subtask with VibeKit
      const executionTarget = subtask || task;
      const result = await vibeKitService.executeCompleteWorkflow(executionTarget, {
        generateCode: true,
        mode: config.mode,
        agent: config.agent,
        environment: config.sandbox,
        branch: config.branch,
        createPullRequest: config.createPR,
        runTests: config.runTests,
        cleanupSandbox: config.cleanupSandbox,
        
        onProgress: (progressUpdate) => {
          setProgress(progressUpdate);
          
          // Log significant progress to Task Master
          if (progressUpdate.phase === 'completed' || 
              progressUpdate.phase === 'pull-request-created' ||
              progressUpdate.progress === 100) {
            if (subtask) {
              const tasksPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
              updateSubtask(tasksPath, targetId, `VibeKit ${progressUpdate.phase}: ${progressUpdate.message}`);
            }
          }
        }
      });

      setResults(result);
      setStep('results');
      
      // Update final Task Master status
      if (result.success) {
        const tasksPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
        if (subtask) {
          await updateSubtask(tasksPath, targetId, `VibeKit execution completed successfully`);
          await setTaskStatus(tasksPath, targetId, 'done');
        } else {
          await setTaskStatus(tasksPath, targetId, 'done');
        }
        
        if (onComplete) {
          onComplete(result);
        }
      } else {
        if (subtask) {
          const tasksPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
          await updateSubtask(tasksPath, targetId, `VibeKit execution failed: ${result.error}`);
        }
      }
      
    } catch (err) {
      setError(err.message);
      setStep('config');
      
      // Log error to Task Master
      const targetId = subtask?.id ? `${task.id}.${subtask.id}` : task?.id;
      if (subtask) {
        const tasksPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
        await updateSubtask(tasksPath, targetId, `VibeKit execution failed: ${err.message}`);
      }
    }
  };

  if (!isVisible) return null;

  const getAgentStatus = (agentType) => {
    if (!configStatus) return '❓';
    return configStatus.agent.type === agentType && configStatus.agent.configured ? '✅' : '❌';
  };

  const getSandboxStatus = (sandboxType) => {
    if (!configStatus) return '❓';
    return configStatus.environments.available.includes(sandboxType) ? '✅' : '❌';
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="blue">
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="blue">
          🤖 VibeKit Execution - {subtask ? `Subtask ${subtask.id}` : `Task ${task?.id}`}
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
              Target: {subtask ? subtask.title : task?.title}
            </Text>
          </Box>
          
          <Box flexDirection="column" marginBottom={1}>
            {configOptions.map((option, index) => (
              <Box key={`config-${option.key}`}>
                <Text 
                  color={index === selectedOption ? 'blue' : 'white'}
                  bold={index === selectedOption}
                >
                  {index === selectedOption ? '▶ ' : '  '}
                  {option.label}: {option.value || ''}
                  {option.key === 'agent' && ` ${getAgentStatus(config.agent)}`}
                  {option.key === 'sandbox' && ` ${getSandboxStatus(config.sandbox)}`}
                </Text>
              </Box>
            ))}
          </Box>
          
          {configStatus && (
            <Box flexDirection="column" marginBottom={1} paddingX={1} borderStyle="single" borderColor="gray">
              <Text bold color="yellow">Configuration Status:</Text>
              <Text>Agent: {configStatus.agent.type} {configStatus.agent.configured ? '✅' : '❌'}</Text>
              <Text>Environments: {configStatus.environments.count} available</Text>
              <Text>GitHub: {configStatus.github.configured ? '✅' : '❌'}</Text>
              
                             {configStatus.validation.warnings.length > 0 && (
                 <Box flexDirection="column" marginTop={1}>
                   <Text color="yellow">⚠️  Warnings:</Text>
                   {configStatus.validation.warnings.map((warning, idx) => (
                     <Text key={`warning-${idx}-${warning.slice(0, 10)}`} color="yellow">  • {warning}</Text>
                   ))}
                 </Box>
               )}
            </Box>
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
          
          {progress.data && (
            <Box flexDirection="column" marginBottom={1}>
              {progress.data.agent && (
                <Text color="gray">Agent: {progress.data.agent}</Text>
              )}
              {progress.data.sandbox && (
                <Text color="gray">Sandbox: {progress.data.sandbox}</Text>
              )}
              {progress.data.pullRequestNumber && (
                <Text color="green">PR Created: #{progress.data.pullRequestNumber}</Text>
              )}
            </Box>
          )}
          
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
                <Text>  ✅ Code generated</Text>
              )}
              {results.steps.commandExecution && (
                <Text>  ✅ Commands executed ({results.steps.commandExecution.length})</Text>
              )}
              {results.steps.testExecution && (
                <Text>  {results.steps.testExecution.exitCode === 0 ? '✅' : '❌'} Tests {results.steps.testExecution.exitCode === 0 ? 'passed' : 'failed'}</Text>
              )}
              {results.steps.pullRequestCreation && (
                <Text color="blue">  🔗 PR Created: #{results.steps.pullRequestCreation.number}</Text>
              )}
              {results.steps.branchPush && (
                <Text>  📤 Pushed to branch: {results.steps.branchPush.branch}</Text>
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