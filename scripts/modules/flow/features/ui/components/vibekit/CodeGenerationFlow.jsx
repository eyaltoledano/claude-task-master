import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { VibeKitService } from '../../../../features/agents/services/vibekit.service.js';
import { ContextGathererService } from '../../../../features/context/services/context-gatherer.service.js';
import { AgentSelector } from './AgentSelector.jsx';
import { ProgressIndicator } from './ProgressIndicator.jsx';
import { StreamingDisplay } from './StreamingDisplay.jsx';
import { SuccessDisplay } from './SuccessDisplay.jsx';
import { ErrorDisplay } from './ErrorDisplay.jsx';

const CodeGenerationFlow = ({ subtask, onComplete, onCancel }) => {
  const [state, setState] = useState('initializing');
  const [progress, setProgress] = useState({ step: '', details: '' });
  const [agent, setAgent] = useState(null);
  const [streamingUpdates, setStreamingUpdates] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [availableAgents, setAvailableAgents] = useState([]);

  const vibeKitService = new VibeKitService();
  const contextGatherer = new ContextGathererService();

  useEffect(() => {
    initializeFlow();
  }, []);

  const initializeFlow = async () => {
    try {
      setState('checking-agents');
      setProgress({ step: 'Checking available agents', details: 'Verifying API keys and configuration...' });

      const agents = await vibeKitService.getConfiguredAgents();
      
      if (agents.length === 0) {
        throw new Error('No agents configured with API keys. Please set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY in your environment.');
      }

      setAvailableAgents(agents);

      if (agents.length === 1) {
        // Only one agent available, use it directly
        setAgent(agents[0]);
        await startCodeGeneration(agents[0]);
      } else {
        // Multiple agents available, let user choose
        const selectedAgent = await vibeKitService.selectAgentForSubtask(subtask);
        setAgent(selectedAgent);
        setState('agent-selected');
        setProgress({ step: 'Agent selected', details: `Using ${selectedAgent} for this task` });
        
        // Auto-proceed after a brief pause
        setTimeout(() => {
          startCodeGeneration(selectedAgent);
        }, 1000);
      }
    } catch (error) {
      setState('error');
      setError(error.message);
    }
  };

  const startCodeGeneration = async (selectedAgent) => {
    try {
      // Step 1: Gather context
      setState('gathering-context');
      setProgress({ step: 'Gathering context', details: 'Analyzing project structure and subtask requirements...' });
      
      const context = await contextGatherer.gatherFullContext(subtask);
      
      // Step 2: Generate code and create PR
      setState('generating-code');
      setProgress({ step: 'Generating code', details: 'AI is analyzing requirements and writing implementation...' });
      
      const generationResult = await vibeKitService.generateCodeAndCreatePR(
        selectedAgent,
        subtask,
        context,
        (step, details) => {
          setProgress({ step, details });
          
          // Update state based on progress
          if (step === 'Creating PR') {
            setState('creating-pr');
          } else if (step === 'Cleanup') {
            setState('cleanup');
          }
        }
      );
      
      // Step 3: Complete
      setState('complete');
      setResult(generationResult);
      setProgress({ 
        step: 'Complete', 
        details: `PR #${generationResult.pr.number} created successfully!` 
      });
      
      // Auto-complete after showing success
      setTimeout(() => {
        onComplete(generationResult);
      }, 3000);
      
    } catch (error) {
      setState('error');
      setError(error.message);
    }
  };

  const handleRetry = () => {
    setError(null);
    setStreamingUpdates([]);
    setResult(null);
    initializeFlow();
  };

  const handleCancel = () => {
    onCancel();
  };

  const renderContent = () => {
    switch (state) {
      case 'initializing':
      case 'checking-agents':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Spinner type="dots" />
              <Text color="cyan"> {progress.step}</Text>
            </Box>
            <Text dimColor>{progress.details}</Text>
          </Box>
        );

      case 'agent-selection':
        return (
          <AgentSelector
            agents={availableAgents}
            subtask={subtask}
            onSelect={setAgent}
            onCancel={handleCancel}
          />
        );

      case 'agent-selected':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold color="green">✓ Agent selected: {agent}</Text>
            </Box>
            <Text dimColor>Starting code generation...</Text>
          </Box>
        );

      case 'gathering-context':
      case 'generating-code':
      case 'creating-pr':
      case 'cleanup':
        return (
          <Box flexDirection="column">
            <ProgressIndicator 
              state={state}
              progress={progress}
              agent={agent}
            />
            {state === 'generating-code' && (
              <StreamingDisplay updates={streamingUpdates} />
            )}
          </Box>
        );

      case 'complete':
        return (
          <SuccessDisplay 
            result={result}
            agent={agent}
            subtask={subtask}
          />
        );

      case 'error':
        return (
          <ErrorDisplay 
            error={error}
            agent={agent}
            onRetry={handleRetry}
            onCancel={handleCancel}
          />
        );

      default:
        return (
          <Box>
            <Text color="red">Unknown state: {state}</Text>
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🤖 Code Generation for Subtask {subtask.id}: {subtask.title}
        </Text>
      </Box>
      
      {renderContent()}
      
      {(state === 'error' || state === 'complete') && (
        <Box marginTop={1}>
          <Text dimColor>Press ESC to return to subtask view</Text>
        </Box>
      )}
    </Box>
  );
};

export { CodeGenerationFlow }; 