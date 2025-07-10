import React from 'react';
import { Box, Text } from 'ink';

const StreamingDisplay = ({ updates }) => {
  if (!updates || updates.length === 0) {
    return null;
  }

  const recentUpdates = updates.slice(-5); // Show last 5 updates

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">🔄 Live Generation Stream</Text>
      </Box>
      
      <Box flexDirection="column">
        {recentUpdates.map((update, index) => (
          <Box key={`update-${updates.length - recentUpdates.length + index}`} marginBottom={0}>
            <Text color="green">▸ </Text>
            <Text dimColor>{update.length > 80 ? `${update.substring(0, 80)}...` : update}</Text>
          </Box>
        ))}
      </Box>
      
      {updates.length > 5 && (
        <Box marginTop={1}>
          <Text dimColor>... and {updates.length - 5} more updates</Text>
        </Box>
      )}
    </Box>
  );
};

export { StreamingDisplay }; 