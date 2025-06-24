import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';

export function WelcomeScreen() {
  const { messages, tasks, currentTag } = useAppContext();
  
  // Calculate task statistics
  const taskStats = {
    total: tasks.length,
    byStatus: {
      pending: tasks.filter(t => t.status === 'pending').length,
      'in-progress': tasks.filter(t => t.status === 'in-progress').length,
      done: tasks.filter(t => t.status === 'done').length,
      other: tasks.filter(t => !['pending', 'in-progress', 'done'].includes(t.status)).length
    },
    byPriority: {
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length
    }
  };
  
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.length === 0 ? (
        <Box flexDirection="column" height="100%" justifyContent="center" alignItems="center">
          {/* ASCII Art Logo */}
          <Box marginBottom={1}>
            <Text color="gray">
              {`                                                      
████████╗ █████╗ ███████╗██╗  ██╗███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗ 
╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
   ██║   ███████║███████╗█████╔╝ ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝
   ██║   ██╔══██║╚════██║██╔═██╗ ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
   ██║   ██║  ██║███████║██║  ██╗██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║
   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝`}
            </Text>
          </Box>
          
          {/* Status Info Box */}
          <Box 
            borderStyle="round" 
            borderColor={theme.border}
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            marginBottom={2}
            width={80}
          >
            <Box flexDirection="column">
              <Box marginBottom={1}>
                <Text color={theme.accent} bold>Project Status</Text>
              </Box>
              
              <Box>
                <Box width={20}>
                  <Text color={theme.textDim}>Current Tag:</Text>
                </Box>
                <Text color="white">{currentTag}</Text>
                <Box width={20} marginLeft={4}>
                  <Text color={theme.textDim}>Tasks File:</Text>
                </Box>
                <Text color={taskStats.total > 0 ? theme.success : theme.warning}>
                  {taskStats.total > 0 ? '✓ tasks.json exists' : '✗ No tasks.json found'}
                </Text>
              </Box>
              
              {taskStats.total > 0 && (
                <>
                  <Box>
                    <Box width={20}>
                      <Text color={theme.textDim}>Total Tasks:</Text>
                    </Box>
                    <Text color="white">{taskStats.total}</Text>
                  </Box>
                  
                  <Box>
                    <Box width={20}>
                      <Text color={theme.textDim}>By Status:</Text>
                    </Box>
                    <Box>
                      <Text color="yellow">{taskStats.byStatus.pending} pending</Text>
                      <Text color="blue"> • {taskStats.byStatus['in-progress']} in progress</Text>
                      <Text color="green"> • {taskStats.byStatus.done} done</Text>
                      {taskStats.byStatus.other > 0 && (
                        <Text color="gray"> • {taskStats.byStatus.other} other</Text>
                      )}
                    </Box>
                  </Box>
                  
                  <Box>
                    <Box width={20}>
                      <Text color={theme.textDim}>By Priority:</Text>
                    </Box>
                    <Box>
                      <Text color="red">{taskStats.byPriority.high} high</Text>
                      <Text color="yellow"> • {taskStats.byPriority.medium} medium</Text>
                      <Text color="cyan"> • {taskStats.byPriority.low} low</Text>
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          </Box>
          
          {/* Command list */}
          <Box flexDirection="column" alignItems="flex-start">
            <Box>
              <Text color="cyan">/help</Text>
              <Text dimColor> show help</Text>
            </Box>
            <Box>
              <Text color="cyan">/list</Text>
              <Text dimColor> view task list</Text>
            </Box>
            <Box>
              <Text color="cyan">/models</Text>
              <Text dimColor> configure AI models</Text>
            </Box>
            <Box>
              <Text color="cyan">/rules</Text>
              <Text dimColor> configure AI rules</Text>
            </Box>
            <Box>
              <Text color="cyan">/exit</Text>
              <Text dimColor> exit the app</Text>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" width="100%" padding={2}>
          {/* Message history */}
          {messages.map((msg, idx) => (
            <Box key={idx} marginBottom={1}>
              {msg.type === 'user' ? (
                <Text color="cyan">❯ {msg.content}</Text>
              ) : msg.type === 'assistant' ? (
                <Text>{msg.content}</Text>
              ) : (
                <Text color="red">{msg.content}</Text>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
} 