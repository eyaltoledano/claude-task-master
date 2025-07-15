import React from 'react';
import { Box, Text } from 'ink';
import { ErrorBoundaryWithLogger } from './ErrorBoundary.jsx';

/**
 * Error boundary for navigation-related errors
 */
export const NavigationErrorBoundary = ({ children }) => (
  <ErrorBoundaryWithLogger
    name="NavigationErrorBoundary"
    fallback={NavigationErrorFallback}
    showDetails={false}
  >
    {children}
  </ErrorBoundaryWithLogger>
);

const NavigationErrorFallback = ({ error }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="red" bold>⚠️  Navigation Error</Text>
    <Text color="yellow">Unable to navigate to the requested screen</Text>
    <Text color="gray" dimColor>Error: {error?.message}</Text>
    <Box marginTop={1}>
      <Text color="gray">Press ESC to return to the main menu</Text>
    </Box>
  </Box>
);

/**
 * Error boundary for task operations
 */
export const TaskOperationErrorBoundary = ({ children, operation }) => (
  <ErrorBoundaryWithLogger
    name={`TaskOperation-${operation}`}
    fallback={(props) => <TaskOperationErrorFallback {...props} operation={operation} />}
    allowReset
  >
    {children}
  </ErrorBoundaryWithLogger>
);

const TaskOperationErrorFallback = ({ error, operation, onReset }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="red" bold>⚠️  Task Operation Failed</Text>
    <Text color="yellow">Failed to {operation}</Text>
    
    <Box marginTop={1}>
      <Text color="gray">{error?.message || 'Unknown error occurred'}</Text>
    </Box>
    
    {error?.code === 'TASK_NOT_FOUND' && (
      <Box marginTop={1}>
        <Text color="gray">The task may have been deleted or moved.</Text>
      </Box>
    )}
    
    {onReset && (
      <Box marginTop={1}>
        <Text color="yellow">Press 'r' to retry</Text>
      </Box>
    )}
  </Box>
);

/**
 * Error boundary for MCP operations
 */
export const MCPErrorBoundary = ({ children, serverName }) => (
  <ErrorBoundaryWithLogger
    name={`MCP-${serverName || 'unknown'}`}
    fallback={(props) => <MCPErrorFallback {...props} serverName={serverName} />}
    allowReset
  >
    {children}
  </ErrorBoundaryWithLogger>
);

const MCPErrorFallback = ({ error, serverName, onReset }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="red" bold>⚠️  MCP Server Error</Text>
    <Text color="yellow">
      {serverName ? `Server "${serverName}" error` : 'MCP communication error'}
    </Text>
    
    <Box marginTop={1} flexDirection="column">
      <Text color="gray">{error?.message}</Text>
      
      {error?.code === 'ECONNREFUSED' && (
        <Text color="gray">Server may not be running</Text>
      )}
      
      {error?.code === 'TIMEOUT' && (
        <Text color="gray">Server took too long to respond</Text>
      )}
    </Box>
    
    <Box marginTop={1}>
      <Text color="gray">Try:</Text>
      <Text color="gray">• Checking server status</Text>
      <Text color="gray">• Restarting the MCP server</Text>
      <Text color="gray">• Verifying server configuration</Text>
    </Box>
    
    {onReset && (
      <Box marginTop={1}>
        <Text color="yellow">Press 'r' to reconnect</Text>
      </Box>
    )}
  </Box>
);

/**
 * Error boundary for form/input validation
 */
export const FormErrorBoundary = ({ children, formName }) => (
  <ErrorBoundaryWithLogger
    name={`Form-${formName}`}
    fallback={FormErrorFallback}
    showDetails={false}
  >
    {children}
  </ErrorBoundaryWithLogger>
);

const FormErrorFallback = ({ error }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="red" bold>⚠️  Form Error</Text>
    <Text color="yellow">There was a problem with your input</Text>
    
    <Box marginTop={1}>
      <Text color="gray">{error?.message || 'Please check your input and try again'}</Text>
    </Box>
    
    {error?.validationErrors && (
      <Box marginTop={1} flexDirection="column">
        <Text color="gray">Issues found:</Text>
        {error.validationErrors.map((err) => (
          <Text key={err} color="gray">• {err}</Text>
        ))}
      </Box>
    )}
  </Box>
);

/**
 * Error boundary for file operations
 */
export const FileOperationErrorBoundary = ({ children, operation }) => (
  <ErrorBoundaryWithLogger
    name={`FileOperation-${operation}`}
    fallback={(props) => <FileOperationErrorFallback {...props} operation={operation} />}
    allowReset
  >
    {children}
  </ErrorBoundaryWithLogger>
);

const FileOperationErrorFallback = ({ error, operation, onReset }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="red" bold>⚠️  File Operation Failed</Text>
    <Text color="yellow">Unable to {operation} file</Text>
    
    <Box marginTop={1}>
      <Text color="gray">{error?.message}</Text>
    </Box>
    
    {error?.code === 'ENOENT' && (
      <Text color="gray">File or directory not found</Text>
    )}
    
    {error?.code === 'EACCES' && (
      <Text color="gray">Permission denied</Text>
    )}
    
    {error?.code === 'ENOSPC' && (
      <Text color="gray">No space left on device</Text>
    )}
    
    {onReset && (
      <Box marginTop={1}>
        <Text color="yellow">Press 'r' to retry</Text>
      </Box>
    )}
  </Box>
); 