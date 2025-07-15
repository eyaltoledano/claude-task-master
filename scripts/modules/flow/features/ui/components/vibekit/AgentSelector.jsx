import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentsConfigManager } from '../../../../shared/config/managers/agents-config-manager.js';

const AgentSelector = ({ agents, subtask, onSelect, onCancel }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [agentDetails, setAgentDetails] = useState({});
  const [taskType, setTaskType] = useState('execution');

  const configService = new AgentsConfigManager();

  useEffect(() => {
    loadAgentDetails();
    detectTaskType();
  }, []);

  const loadAgentDetails = async () => {
    const details = {};
    for (const agent of agents) {
      details[agent] = await configService.getAgentConfig(agent);
    }
    setAgentDetails(details);
  };

  const detectTaskType = async () => {
    const detectedType = await configService.detectTaskType(subtask);
    setTaskType(detectedType);
  };

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(agents.length - 1, selectedIndex + 1));
    } else if (key.return) {
      onSelect(agents[selectedIndex]);
    } else if (key.escape) {
      onCancel();
    }
  });

  const getAgentDisplayInfo = (agent) => {
    const details = agentDetails[agent];
    if (!details) return { model: 'Loading...', color: 'gray' };
    
    return {
      model: details.model,
      color: details.color,
      provider: details.provider
    };
  };

  const getRecommendationText = (agent, index) => {
    const config = agentDetails[agent];
    if (!config) return '';
    
    // This would use the rankings from configuration
    if (index === 0) return ' (Recommended)';
    if (taskType === 'planning' && agent === 'claude') return ' (Best for planning)';
    if (taskType === 'execution' && agent === 'codex') return ' (Best for coding)';
    if (taskType === 'debugging' && agent === 'claude') return ' (Best for debugging)';
    
    return '';
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>🤖 Select AI Agent</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text dimColor>
          Task type detected: <Text color="cyan">{taskType}</Text>
        </Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {agents.map((agent, index) => {
          const isSelected = index === selectedIndex;
          const { model, color, provider } = getAgentDisplayInfo(agent);
          const recommendation = getRecommendationText(agent, index);
          
          return (
            <Box key={agent} marginBottom={1}>
              <Text color={isSelected ? 'cyan' : 'white'}>
                {isSelected ? '→ ' : '  '}
                <Text bold style={{ color: `#${color}` }}>
                  {agent.charAt(0).toUpperCase() + agent.slice(1)}
                </Text>
                <Text dimColor> ({provider})</Text>
                <Text color="yellow">{recommendation}</Text>
              </Text>
              {isSelected && (
                <Box marginLeft={4} marginTop={0}>
                  <Text dimColor>Model: {model}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>
          Use ↑↓ to select, Enter to confirm, ESC to cancel
        </Text>
      </Box>
    </Box>
  );
};

export { AgentSelector }; 