import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

const ProgressIndicator = ({ state, progress, agent }) => {
  const getProgressEmoji = (currentState) => {
    switch (currentState) {
      case 'gathering-context': return '📊';
      case 'generating-code': return '🤖';
      case 'creating-pr': return '🔀';
      case 'cleanup': return '🧹';
      default: return '⚙️';
    }
  };

  const getProgressSteps = () => {
    const steps = [
      { key: 'gathering-context', label: 'Context Analysis', emoji: '📊' },
      { key: 'generating-code', label: 'Code Generation', emoji: '🤖' },
      { key: 'creating-pr', label: 'Pull Request', emoji: '🔀' },
      { key: 'cleanup', label: 'Cleanup', emoji: '🧹' }
    ];

    return steps.map(step => ({
      ...step,
      status: getStepStatus(step.key, state)
    }));
  };

  const getStepStatus = (stepKey, currentState) => {
    const stepOrder = ['gathering-context', 'generating-code', 'creating-pr', 'cleanup'];
    const currentIndex = stepOrder.indexOf(currentState);
    const stepIndex = stepOrder.indexOf(stepKey);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const getAgentEmoji = (agentName) => {
    const emojiMap = {
      'claude': '🎭',
      'codex': '🤖',
      'gemini': '💎',
      'opencode': '⚡'
    };
    return emojiMap[agentName] || '🤖';
  };

  const progressSteps = getProgressSteps();

  return (
    <Box flexDirection="column">
      {/* Agent Info */}
      <Box marginBottom={1}>
        <Text bold>
          {getAgentEmoji(agent)} {agent.charAt(0).toUpperCase() + agent.slice(1)} Agent
        </Text>
      </Box>

      {/* Progress Steps */}
      <Box flexDirection="column" marginBottom={1}>
        {progressSteps.map((step, index) => (
          <Box key={step.key} marginBottom={0}>
            <Box width={20}>
              <Text color={step.status === 'completed' ? 'green' : step.status === 'active' ? 'cyan' : 'gray'}>
                {step.status === 'completed' && '✓ '}
                {step.status === 'active' && <Spinner type="dots" />}
                {step.status === 'pending' && '○ '}
                {step.emoji} {step.label}
              </Text>
            </Box>
            {step.status === 'active' && (
              <Box marginLeft={2}>
                <Text dimColor>{progress.details}</Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Current Progress Detail */}
      <Box marginTop={1}>
        <Text bold color="cyan">
          {getProgressEmoji(state)} {progress.step}
        </Text>
      </Box>
      
      {progress.details && (
        <Box marginTop={0}>
          <Text dimColor>{progress.details}</Text>
        </Box>
      )}
    </Box>
  );
};

export { ProgressIndicator }; 