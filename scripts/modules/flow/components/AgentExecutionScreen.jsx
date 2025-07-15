// AgentExecutionScreen.jsx - Unified screen for all agent executions using VibeKit

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAgentSession } from '../shared/hooks/useAgentSession.js';
import { UnifiedAgentService } from '../shared/services/UnifiedAgentService.js';
import { SimpleTable, Toast, LoadingSpinner, OverflowableText, OverflowIndicator } from '../features/ui';
import { useAppContext } from '../app/index-root.jsx';

export function AgentExecutionScreen({
  backend,
  onBack,
  initialAgent = 'claude',
  initialMode = 'list',
  taskId = null
}) {
  const { setCurrentScreen } = useAppContext();
  const { sessions, activeSession, messages, loading, error, createNewSession, watchSession } = useAgentSession(backend, taskId, initialAgent);
  const [mode, setMode] = useState(initialMode);
  const [selectedAgent, setSelectedAgent] = useState(initialAgent);
  const [agents, setAgents] = useState([]);
  const [notification, setNotification] = useState(null);
  const service = useMemo(() => new UnifiedAgentService(backend), [backend]);

  useEffect(() => {
    const loadAgents = async () => {
      const availableAgents = await service.getAgents();
      setAgents(availableAgents);
    };
    loadAgents();
  }, [service]);

  const handleAgentChange = (newAgent) => {
    setSelectedAgent(newAgent);
    // Reload sessions for new agent
  };

  const handleCreateSession = async () => {
    try {
      await createNewSession();
      setNotification({ message: 'Session created successfully', type: 'success' });
    } catch (err) {
      setNotification({ message: 'Failed to create session', type: 'error' });
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading agent sessions..." />;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Agent Selector */}
      <Box marginBottom={1}>
        <Text>Agent: </Text>
        <SimpleTable
          data={agents.map(a => ({ name: a.name }))}
          onSelect={(selected) => handleAgentChange(selected.name)}
        />
      </Box>

      {/* Session List */}
      {mode === 'list' && (
        <Box flexDirection="column">
          <Text bold>Sessions for {selectedAgent}</Text>
          {sessions.map(session => (
            <Box key={session.id} onClick={() => setActiveSession(session)}>
              <Text color={session.status === 'active' ? 'green' : 'yellow'}>
                {session.id} - {session.status}
              </Text>
            </Box>
          ))}
          <Text onClick={handleCreateSession}>Create New Session</Text>
        </Box>
      )}

      {/* Active Session View */}
      {mode === 'active-session' && activeSession && (
        <Box flexDirection="column">
          <Text bold>Active Session: {activeSession.id}</Text>
          <OverflowableText text={messages.join('\n')} />
        </Box>
      )}

      {notification && <Toast {...notification} onDismiss={() => setNotification(null)} />}
    </Box>
  );
} 