import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { StatusMessage, ProgressBar, Spinner, Badge } from '@inkjs/ui';
import { useExecutions } from '../hooks/useExecutions.js';
import { useStreamingExecution } from '../hooks/useStreamingExecution.js';
import { useOptimizedData, usePerformanceMonitor } from '../hooks/useOptimizedData.js';
import { InteractiveExecutionList } from './InteractiveExecutionList.jsx';
import { BaseModal } from './BaseModal.jsx';
import { useAppContext } from '../index.jsx';

export function ExecutionManagementScreen({ onBack }) {
  // Performance monitoring
  const { renderCount } = usePerformanceMonitor('ExecutionManagementScreen');
  
  // Enhanced data hooks with error handling and connection status
  const { executions, loading, connectionStatus, error, refetch } = useExecutions({
    pollInterval: 3000,
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
    maxMessages: 50,
    autoConnect: true
  });
  
  // Optimized data transformation
  const optimizedExecutions = useOptimizedData(executions, [connectionStatus]);
  
  const { setNotification } = useAppContext();

  useInput((input, key) => {
    if (key.escape) {
      if (selectedExecution) {
        setSelectedExecution(null);
      } else {
        onBack();
      }
    }
    if (input === 'i') {
      // Toggle interactive mode
      setUseInteractiveMode(!useInteractiveMode);
      setSelectedExecution(null); // Reset selection when switching modes
      setNotification({
        message: `Switched to ${!useInteractiveMode ? 'Interactive' : 'Traditional'} mode`,
        type: 'info',
        duration: 2000
      });
    }
    if (input === 'r' && !selectedExecution && connectionStatus === 'error') {
      // Retry connection
      refetch();
      setNotification({
        message: 'Retrying connection...',
        type: 'info',
        duration: 2000
      });
    }
    if (key.ctrl && input === 'k' && selectedExecution) {
      // Kill execution
      setNotification({
        message: `Killing execution ${selectedExecution.taskId}...`,
        type: 'warning',
        duration: 2000
      });
    }
    if (key.ctrl && input === 'r' && selectedExecution) {
      // Restart execution
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
        setNotification({ message: 'Streaming disconnected', type: 'warning', duration: 2000 });
      } else {
        connect();
        setNotification({ message: 'Streaming connected', type: 'success', duration: 2000 });
      }
    }
  });

  if (loading) {
    return (
      <BaseModal title="Execution Management" onBack={onBack}>
        <Box padding={1}>
          <Spinner label="Loading executions..." />
        </Box>
      </BaseModal>
    );
  }

  // If using interactive mode, render the new component
  if (useInteractiveMode) {
    return <InteractiveExecutionList onBack={onBack} />;
  }

  const executionItems = optimizedExecutions.map(exec => ({
    label: `${exec.taskId} - ${exec.status} (${exec.provider}) - ${exec.formattedDuration}`,
    value: exec.id,
    execution: exec
  }));

  const handleSelect = (item) => {
    const execution = optimizedExecutions.find(e => e.id === item.value);
    setSelectedExecution(execution);
  };

  return (
    <BaseModal 
      title={`Execution Management - Traditional Mode (${optimizedExecutions.length}) - Renders: ${renderCount}`} 
      onBack={onBack}
    >
      <Box flexDirection="column" padding={1}>
        {/* Connection Status */}
        {connectionStatus !== 'connected' && (
          <Box marginBottom={1}>
            {connectionStatus === 'error' ? (
              <StatusMessage variant="error">
                Connection Error: {error} - Press 'r' to retry
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
                  Messages: {messages.length}/50
                </Text>
              </Box>
            </Box>
          </Box>
        )}
        
        <Box marginTop={2}>
          <Text color="gray">
            [↑/↓] Navigate | [Enter] Select | [i] Interactive Mode | [Esc] {selectedExecution ? 'Deselect' : 'Back'}
          </Text>
        </Box>
      </Box>
    </BaseModal>
  );
} 