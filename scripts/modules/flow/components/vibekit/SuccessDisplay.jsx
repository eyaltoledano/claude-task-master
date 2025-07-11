import React from 'react';
import { Box, Text } from 'ink';

const SuccessDisplay = ({ result, agent, subtask }) => {
  const getAgentEmoji = (agentName) => {
    const emojiMap = {
      'claude': '🎭',
      'codex': '🤖',
      'gemini': '💎',
      'opencode': '⚡'
    };
    return emojiMap[agentName] || '🤖';
  };

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="green" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          ✅ Code Generation Complete!
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          <Text bold>Subtask:</Text> {subtask.id} - {subtask.title}
        </Text>
        <Text>
          <Text bold>Agent:</Text> {getAgentEmoji(agent)} {agent.charAt(0).toUpperCase() + agent.slice(1)}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">📋 Results Summary:</Text>
        <Text>• Pull Request: <Text color="green">#{result.pr.number}</Text></Text>
        <Text>• Branch: <Text color="cyan">{result.pr.head?.ref || 'N/A'}</Text></Text>
        <Text>• Streaming Updates: <Text color="yellow">{result.streamingUpdates}</Text></Text>
        {result.pr.html_url && (
          <Text>• URL: <Text color="blue">{result.pr.html_url}</Text></Text>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">🏷️ Labels Added:</Text>
        <Text>• Task Label: <Text color="blue">task-{subtask.parentId}</Text></Text>
        <Text>• Agent Label: <Text color={`#${getAgentColor(agent)}`}>agent-{agent}</Text></Text>
      </Box>

      {result.codeResult?.summary && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">📝 Implementation Summary:</Text>
          <Text dimColor>{result.codeResult.summary}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          The subtask has been implemented and a pull request created.
          The sandbox has been automatically cleaned up.
        </Text>
      </Box>
    </Box>
  );
};

const getAgentColor = (agent) => {
  const colorMap = {
    'claude': '7c3aed',
    'codex': '10b981',
    'gemini': 'f59e0b',
    'opencode': 'ef4444'
  };
  return colorMap[agent] || '6b7280';
};

export { SuccessDisplay }; 