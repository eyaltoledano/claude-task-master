import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

const COMMANDS = [
  { command: '/help', description: 'show help', shortcut: 'esc' },
  { command: '/list', description: 'view task list', shortcut: '' },
  { command: '/models', description: 'configure AI models', shortcut: '' },
  { command: '/rules', description: 'configure AI rules', shortcut: '' },
  { command: '/exit', description: 'exit the app', shortcut: 'ctrl+c' }
];

export function CommandPalette({ onClose, onSelectCommand }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev => (prev + 1) % COMMANDS.length);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => (prev - 1 + COMMANDS.length) % COMMANDS.length);
      return;
    }

    if (key.return) {
      const selected = COMMANDS[selectedIndex];
      if (selected.command.startsWith('/')) {
        onSelectCommand(selected.command);
      }
      onClose();
      return;
    }
  });

  return (
    <Box
      width="100%"
      height="100%"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      {/* Modal */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.border}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        width={60}
      >
        {/* Header */}
        <Box marginBottom={1} justifyContent="space-between">
          <Text color={theme.accent} bold>Help</Text>
          <Text color={theme.textDim}>esc</Text>
        </Box>
        
        {/* Command list */}
        <Box flexDirection="column">
          {COMMANDS.map((cmd, index) => {
            const isSelected = index === selectedIndex;
            
            return (
              <Box 
                key={cmd.command}
                paddingLeft={1}
                paddingRight={1}
              >
                <Box width={20}>
                  <Text color={isSelected ? theme.accent : '#4a9eff'}>
                    {cmd.command}
                  </Text>
                </Box>
                <Box width={25}>
                  <Text color={isSelected ? 'white' : theme.text}>
                    {cmd.description}
                  </Text>
                </Box>
                <Box flexGrow={1} justifyContent="flex-end">
                  <Text color={theme.textDim}>
                    {cmd.shortcut}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
} 