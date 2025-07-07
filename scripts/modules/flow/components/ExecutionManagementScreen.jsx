import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { StatusMessage, ProgressBar, Spinner, Badge } from '@inkjs/ui';
import { useExecutions } from '../hooks/useExecutions.js';
import { useStreamingExecution } from '../hooks/useStreamingExecution.js';
import { useOptimizedData } from '../hooks/useOptimizedData.js';

// Phase 8.5 imports
import ErrorBoundary from './ErrorBoundaryWithRecovery.jsx';
import AdvancedHelpModal from './AdvancedHelpModal.jsx';
import SettingsModal from './SettingsModal.jsx';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor.js';
import { useTelemetryService } from '../hooks/useTelemetryService.js';
import { useResourceManager } from '../hooks/useResourceManager.js';

import { InteractiveExecutionList } from './InteractiveExecutionList.jsx';
import { BaseModal } from './BaseModal.jsx';
import { useAppContext } from '../index.jsx';

export function ExecutionManagementScreen({ onBack }) {
  // Phase 8.5: Advanced feature state
  const [showAdvancedHelp, setShowAdvancedHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  // Phase 8.5: Performance monitoring
  const performanceMetrics = usePerformanceMonitor('ExecutionManagementScreen');
  
  // Phase 8.5: Telemetry service
  const telemetry = useTelemetryService({
    enabled: settings?.telemetry?.enabled || false,
    endpoint: settings?.telemetry?.endpoint,
    sessionId: 'execution-management-session'
  });
  
  // Phase 8.5: Resource management
  const { registerCleanup } = useResourceManager(settings?.performance);
  
  // Enhanced data hooks with error handling and connection status
  const { executions, loading, connectionStatus, error: executionError, refetch } = useExecutions({
    pollInterval: settings?.ui?.refreshInterval || 3000,
    enableStreaming: true,
    maxRetries: 3
  });
  
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [useInteractiveMode, setUseInteractiveMode] = useState(false);
  
  // Enhanced streaming with progress and status tracking
  const { 
    messages, 
    currentStatus, 
    currentProgress, 
    isStreaming, 
    error: streamError,
    connect,
    disconnect
  } = useStreamingExecution(selectedExecution?.id, {
    maxMessages: settings?.ui?.maxLogMessages || 50,
    autoConnect: true
  });
  
  // Optimized data transformation
  const optimizedExecutions = useOptimizedData(executions, [connectionStatus]);
  
  const { setNotification } = useAppContext();

  // Phase 8.5: Register cleanup tasks
  useEffect(() => {
    return registerCleanup(() => {
      console.log('ExecutionManagementScreen cleanup executed');
      // Cleanup streaming connections
      if (isStreaming) {
        disconnect();
      }
    });
  }, [registerCleanup, isStreaming, disconnect]);

  // Phase 8.5: Enhanced input handling with telemetry
  useInput((input, key) => {
    // Track user interactions for telemetry
    telemetry.trackEvent('USER_INPUT', { 
      input, 
      key: key.name, 
      screen: 'execution-management',
      interactiveMode: useInteractiveMode
    });

    if (key.escape) {
      if (showAdvancedHelp) {
        setShowAdvancedHelp(false);
      } else if (showSettings) {
        setShowSettings(false);
      } else if (selectedExecution) {
        setSelectedExecution(null);
      } else {
        onBack();
      }
    }
    
    // Phase 8.5: Advanced help system
    if (input === 'h' || input === '?') {
      setShowAdvancedHelp(!showAdvancedHelp);
    }
    
    // Phase 8.5: Settings modal
    if (key.ctrl && input === 'c') {
      setShowSettings(!showSettings);
    }
    
    if (input === 'i') {
      // Toggle interactive mode
      setUseInteractiveMode(!useInteractiveMode);
      setSelectedExecution(null); // Reset selection when switching modes
      
      const newMode = !useInteractiveMode ? 'Interactive' : 'Traditional';
      telemetry.trackEvent('MODE_SWITCH', { 
        from: useInteractiveMode ? 'Interactive' : 'Traditional',
        to: newMode
      });
      
      setNotification({
        message: `Switched to ${newMode} mode`,
        type: 'info',
        duration: 2000
      });
    }
    
    if (input === 'r' && !selectedExecution && connectionStatus === 'error') {
      // Retry connection
      refetch();
      telemetry.trackEvent('CONNECTION_RETRY', { reason: 'manual' });
      setNotification({
        message: 'Retrying connection...',
        type: 'info',
        duration: 2000
      });
    }
    
    if (key.ctrl && input === 'k' && selectedExecution) {
      // Kill execution
      telemetry.trackEvent('EXECUTION_KILL', { executionId: selectedExecution.id });
      setNotification({
        message: `Killing execution ${selectedExecution.taskId}...`,
        type: 'warning',
        duration: 2000
      });
    }
    
    if (key.ctrl && input === 'r' && selectedExecution) {
      // Restart execution
      telemetry.trackEvent('EXECUTION_RESTART', { executionId: selectedExecution.id });
      setNotification({
        message: `Restarting execution ${selectedExecution.taskId}...`,
        type: 'info',
        duration: 2000
      });
    }
    
    if (key.ctrl && input === 's' && selectedExecution) {
      // Toggle streaming
      if (isStreaming) {
        disconnect();
        telemetry.trackEvent('STREAMING_DISCONNECT', { executionId: selectedExecution.id });
        setNotification({ message: 'Streaming disconnected', type: 'warning', duration: 2000 });
      } else {
        connect();
        telemetry.trackEvent('STREAMING_CONNECT', { executionId: selectedExecution.id });
        setNotification({ message: 'Streaming connected', type: 'success', duration: 2000 });
      }
    }
  });

  // Phase 8.5: Error handler for error boundary
  const handleError = (errorData) => {
    setError(errorData.error);
    telemetry.trackError(new Error(errorData.error), errorData);
  };

  // Phase 8.5: Settings change handler
  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    telemetry.trackEvent('SETTINGS_UPDATED', newSettings);
    setNotification({
      message: 'Settings updated successfully',
      type: 'success',
      duration: 2000
    });
  };

  if (loading) {
    return (
      <ErrorBoundary onError={handleError}>
      <BaseModal title="Execution Management" onBack={onBack}>
        <Box padding={1}>
          <Spinner label="Loading executions..." />
        </Box>
      </BaseModal>
      </ErrorBoundary>
    );
  }

  // If using interactive mode, render the new component
  if (useInteractiveMode) {
    return (
      <ErrorBoundary onError={handleError}>
        <InteractiveExecutionList 
          onBack={onBack} 
          telemetry={telemetry}
          settings={settings}
        />
      </ErrorBoundary>
    );
  }

  const executionItems = optimizedExecutions.map(exec => ({
    label: `${exec.taskId} - ${exec.status} (${exec.provider}) - ${exec.formattedDuration}`,
    value: exec.id,
    execution: exec
  }));

  const handleSelect = (item) => {
    const execution = optimizedExecutions.find(e => e.id === item.value);
    setSelectedExecution(execution);
    telemetry.trackEvent('EXECUTION_SELECTED', { executionId: execution.id });
  };

  return (
    <ErrorBoundary onError={handleError}>
    <BaseModal 
        title={
          <Box flexDirection="row" justifyContent="space-between" width="100%">
            <Text>Execution Management - Traditional Mode ({optimizedExecutions.length})</Text>
            <Box flexDirection="row">
              <Badge color="blue">Renders: {performanceMetrics.renderCount}</Badge>
              <Box marginLeft={1}>
                <Badge color={performanceMetrics.memoryUsage > 100 ? 'red' : 'green'}>
                  Mem: {performanceMetrics.memoryUsage}MB
                </Badge>
              </Box>
              <Box marginLeft={1}>
                <Badge color={telemetry.connectionStatus === 'connected' ? 'green' : 'gray'}>
                  Tel: {telemetry.connectionStatus}
                </Badge>
              </Box>
            </Box>
          </Box>
        } 
      onBack={onBack}
    >
      <Box flexDirection="column" padding={1}>
          {/* Error display */}
          {error && (
            <Box marginBottom={1}>
              <StatusMessage variant="error">{error}</StatusMessage>
            </Box>
          )}

        {/* Connection Status */}
        {connectionStatus !== 'connected' && (
          <Box marginBottom={1}>
            {connectionStatus === 'error' ? (
              <StatusMessage variant="error">
                  Connection Error: {executionError} - Press 'r' to retry
              </StatusMessage>
            ) : connectionStatus === 'retrying' ? (
              <StatusMessage variant="warning">Reconnecting...</StatusMessage>
            ) : connectionStatus === 'loading' ? (
              <StatusMessage variant="info">Connecting...</StatusMessage>
            ) : null}
          </Box>
        )}
        
        {/* Execution List */}
        <Box marginBottom={2}>
          <Box justifyContent="space-between">
            <Text color="cyan" bold>Select Execution:</Text>
            <Text color="gray" dimColor>Status: {connectionStatus}</Text>
          </Box>
          {executionItems.length > 0 ? (
            <SelectInput
              items={executionItems}
              onSelect={handleSelect}
            />
          ) : (
            <Box marginTop={1}>
              <StatusMessage variant="info">
                {connectionStatus === 'connected' ? 'No executions found' : 'Loading executions...'}
              </StatusMessage>
            </Box>
          )}
        </Box>

        {selectedExecution && (
          <Box flexDirection="column">
            {/* Execution Details Panel */}
            <Box borderStyle="single" padding={1} marginBottom={1}>
              <Box flexDirection="column">
                <Box flexDirection="row" marginBottom={1}>
                  <Text color="cyan">Task ID: </Text>
                  <Text color="white" bold>{selectedExecution.taskId}</Text>
                  <Box marginLeft={2}>
                    <Badge color="blue">{selectedExecution.provider}</Badge>
                  </Box>
                </Box>
                
                <Text color="gray">
                  Duration: {Math.round(selectedExecution.duration / 1000)}s
                </Text>
                <Text color="gray">
                  Started: {new Date(selectedExecution.startTime).toLocaleTimeString()}
                </Text>
                
                <Box marginTop={1}>
                  {selectedExecution.status === 'running' && (currentProgress > 0 || selectedExecution.progress) ? (
                    <Box flexDirection="column">
                      <Box flexDirection="row" justifyContent="space-between">
                        <Text color="cyan">Progress:</Text>
                        <Text color="gray">
                          {isStreaming ? '🔴 Live' : '⚫ Static'} | Stream: {currentStatus}
                        </Text>
                      </Box>
                      <ProgressBar value={currentProgress || selectedExecution.progress} />
                      <Text color="gray">{Math.round((currentProgress || selectedExecution.progress) * 100)}%</Text>
                    </Box>
                  ) : (
                    <StatusMessage 
                      variant={
                        selectedExecution.status === 'completed' ? 'success' :
                        selectedExecution.status === 'failed' ? 'error' :
                        selectedExecution.status === 'running' ? 'info' : 'warning'
                      }
                    >
                      Status: {currentStatus || selectedExecution.status}
                      {streamError && ` - Stream Error: ${streamError}`}
                      {selectedExecution.error && ` - ${selectedExecution.error}`}
                    </StatusMessage>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Live Logs Panel */}
            <Box borderStyle="single" padding={1} marginBottom={1}>
              <Text color="yellow" bold>Live Logs:</Text>
              <Box flexDirection="column" marginTop={1} height={6}>
                {messages.slice(-5).map((msg) => (
                  <Text key={msg.id || msg.timestamp} color="gray">
                    [{new Date(msg.timestamp).toLocaleTimeString()}] {msg.type}: {
                      typeof msg.data === 'string' ? msg.data : 
                      msg.data?.message || JSON.stringify(msg.data)
                    }
                  </Text>
                ))}
                {messages.length === 0 && (
                  <Text color="gray">No messages yet...</Text>
                )}
              </Box>
            </Box>

            {/* Quick Actions */}
            <Box borderStyle="single" padding={1}>
              <Text color="yellow" bold>Actions:</Text>
              <Box marginTop={1} flexDirection="column">
                <Text color="gray">
                  [Ctrl+K] Kill execution | [Ctrl+R] Restart | [Ctrl+S] Toggle streaming
                </Text>
                <Text color="gray">
                  Streaming: {isStreaming ? '✅ Connected' : '❌ Disconnected'} | 
                    Messages: {messages.length}/{settings?.ui?.maxLogMessages || 50}
                </Text>
              </Box>
            </Box>
          </Box>
        )}
        
        <Box marginTop={2}>
          <Text color="gray">
              [↑/↓] Navigate | [Enter] Select | [i] Interactive Mode | [h/?] Help | [Ctrl+C] Settings | [Esc] {selectedExecution ? 'Deselect' : 'Back'}
          </Text>
        </Box>
      </Box>

        {/* Phase 8.5: Modal overlays */}
        {showAdvancedHelp && (
          <AdvancedHelpModal 
            onClose={() => setShowAdvancedHelp(false)}
            initialSection="navigation"
          />
        )}
        
        {showSettings && (
          <SettingsModal 
            onClose={() => setShowSettings(false)}
            onSettingsChange={handleSettingsChange}
          />
        )}
    </BaseModal>
    </ErrorBoundary>
  );
} 