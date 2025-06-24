import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppContext } from '../index.jsx';

export function HelpScreen() {
  const { setCurrentScreen } = useAppContext();
  
  useInput((input, key) => {
    if (key.escape) {
      setCurrentScreen('welcome');
    }
  });
  
  return (
    <Box flexDirection="column" flexGrow={1} padding={2}>
      <Box marginBottom={2}>
        <Text bold color="cyan">Task Master Flow - Help</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={2}>
        <Text bold underline>Slash Commands:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box><Text color="cyan">/help</Text><Text> - Show this help screen</Text></Box>
          <Box><Text color="cyan">/tasks</Text><Text> - View and manage your task list</Text></Box>
          <Box><Text color="cyan">/sessions</Text><Text> - View work sessions history</Text></Box>
          <Box><Text color="cyan">/new</Text><Text> - Start a new work session</Text></Box>
          <Box><Text color="cyan">/models</Text><Text> - Configure AI models interactively</Text></Box>
          <Box><Text color="cyan">/rules</Text><Text> - Configure AI coding assistant rules</Text></Box>
          <Box><Text color="cyan">/exit</Text><Text> - Exit the application</Text></Box>
        </Box>
      </Box>
      
      <Box flexDirection="column" marginBottom={2}>
        <Text bold underline>Task List Shortcuts:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box><Text color="cyan">↑/↓</Text><Text> - Navigate through tasks</Text></Box>
          <Box><Text color="cyan">n</Text><Text> - Cycle task status</Text></Box>
          <Box><Text color="cyan">1-4</Text><Text> - Filter tasks (All/Pending/In Progress/Done)</Text></Box>
          <Box><Text color="cyan">Enter</Text><Text> - View task details</Text></Box>
          <Box><Text color="cyan">e</Text><Text> - Expand task with AI</Text></Box>
          <Box><Text color="cyan">r</Text><Text> - Research task context</Text></Box>
        </Box>
      </Box>
      
      <Box flexDirection="column" marginBottom={2}>
        <Text bold underline>Global Shortcuts:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box><Text color="cyan">ESC</Text><Text> - Return to previous screen/home</Text></Box>
          <Box><Text color="cyan">Ctrl+C</Text><Text> - Exit application</Text></Box>
        </Box>
      </Box>
      
      <Box flexDirection="column" marginBottom={2}>
        <Text bold underline>Configuration Commands:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box><Text color="cyan">/models</Text><Text> - Opens interactive AI model configuration</Text></Box>
          <Text dimColor marginLeft={2}>Configure primary, research, and fallback models</Text>
          <Box marginTop={1}><Text color="cyan">/rules</Text><Text> - Opens interactive rules setup</Text></Box>
          <Text dimColor marginLeft={2}>Select which AI assistant rule profiles to include</Text>
        </Box>
      </Box>
      
      <Box flexDirection="column">
        <Text bold underline>Natural Language Commands:</Text>
        <Box marginTop={1}>
          <Text dimColor>Type naturally to interact with Task Master AI. Examples:</Text>
        </Box>
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Text dimColor>• "Show me all pending tasks"</Text>
          <Text dimColor>• "Mark task 5 as done"</Text>
          <Text dimColor>• "Create a new task for implementing user auth"</Text>
          <Text dimColor>• "What should I work on next?"</Text>
        </Box>
      </Box>
      
      <Box position="absolute" bottom={0}>
        <Text dimColor>Press ESC to return</Text>
      </Box>
    </Box>
  );
} 