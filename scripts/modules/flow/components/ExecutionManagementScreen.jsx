import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { StatusMessage, ProgressBar, Spinner, Badge } from '@inkjs/ui';
import { useExecutions, useStreamingExecution } from '../hooks/useExecutions.js';
import { BaseModal } from './BaseModal.jsx';
import { useAppContext } from '../index.jsx';

export function ExecutionManagementScreen({ onBack }) {
  const { executions, loading } = useExecutions();
  const [selectedExecution, setSelectedExecution] = useState(null);
  const { messages } = useStreamingExecution(selectedExecution?.id);
  const { setNotification } = useAppContext();

  useInput((input, key) => {
    if (key.escape) {
      if (selectedExecution) {
        setSelectedExecution(null);
      } else {
        onBack();
      }
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

  const executionItems = executions.map(exec => ({
    label: `${exec.taskId} - ${exec.status} (${exec.provider})`,
    value: exec.id,
    execution: exec
  }));

  const handleSelect = (item) => {
    const execution = executions.find(e => e.id === item.value);
    setSelectedExecution(execution);
  };

  return (
    <BaseModal 
      title={`Execution Management (${executions.length})`} 
      onBack={onBack}
    >
      <Box flexDirection="column" padding={1}>
        {/* Execution List */}
        <Box marginBottom={2}>
          <Text color="cyan" bold>Select Execution:</Text>
          {executionItems.length > 0 ? (
            <SelectInput
              items={executionItems}
              onSelect={handleSelect}
            />
          ) : (
            <Text color="gray">No executions found</Text>
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
                  {selectedExecution.status === 'running' && selectedExecution.progress ? (
                    <Box flexDirection="column">
                      <Text color="cyan">Progress:</Text>
                      <ProgressBar value={selectedExecution.progress} />
                      <Text color="gray">{Math.round(selectedExecution.progress * 100)}%</Text>
                    </Box>
                  ) : (
                    <StatusMessage 
                      variant={
                        selectedExecution.status === 'completed' ? 'success' :
                        selectedExecution.status === 'failed' ? 'error' :
                        selectedExecution.status === 'running' ? 'info' : 'warning'
                      }
                    >
                      Status: {selectedExecution.status}
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
              <Box marginTop={1}>
                <Text color="gray">
                  [Ctrl+K] Kill execution | [Ctrl+R] Restart | [Ctrl+L] View detailed logs
                </Text>
              </Box>
            </Box>
          </Box>
        )}
        
        <Box marginTop={2}>
          <Text color="gray">
            [↑/↓] Navigate | [Enter] Select | [Esc] {selectedExecution ? 'Deselect' : 'Back'}
          </Text>
        </Box>
      </Box>
    </BaseModal>
  );
} 