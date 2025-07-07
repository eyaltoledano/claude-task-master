import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Alert, Badge } from '@inkjs/ui';

const HELP_SECTIONS = {
  'getting-started': {
    title: 'Getting Started',
    content: `
# Task Master Flow TUI - Getting Started

## Quick Start
1. Launch Flow TUI: \`node scripts/dev.js flow\`
2. Navigate screens: [Tab] to switch between sections
3. Interactive Mode: [i] to enable interactive features
4. Help: [h] or [?] for context-sensitive help

## Core Concepts
- **Executions**: Running task instances with live monitoring
- **Providers**: Sandbox environments (E2B, Daytona, etc.)
- **Interactive Mode**: Enhanced UI with real-time features
- **Streaming**: Live logs and status updates

## First Steps
1. Check provider health in Providers screen
2. Monitor active executions in Executions screen
3. Use Status screen for system overview
    `
  },
  'navigation': {
    title: 'Navigation & Controls',
    content: `
# Navigation & Keyboard Controls

## Global Navigation
- [Tab] - Switch between main screens
- [Shift+Tab] - Previous screen
- [Ctrl+C] - Exit application
- [h] or [?] - Show help modal
- [Esc] - Cancel/Go back

## Screen-Specific Controls

### Execution Management
- [i] - Toggle Interactive Mode
- [↑/↓] - Navigate execution list (Interactive Mode)
- [Enter] - Select execution for details
- [r] - Refresh execution list

### Provider Health
- [r] - Refresh all providers
- [s] - Refresh selected provider
- [a] - Toggle auto-refresh
- [↑/↓] - Navigate provider list

### Status Screen
- [t] - Toggle between Overview/Detailed progress
- [p] - Show performance metrics
- [m] - Show memory usage

## Pro Tips
- Use [i] in any screen to access enhanced features
- Auto-refresh can be toggled for better performance
- Hold [Shift] while navigating for faster movement
    `
  },
  'performance': {
    title: 'Performance & Optimization',
    content: `
# Performance Monitoring & Optimization

## Built-in Performance Tracking
- Render count monitoring per component
- Memory usage tracking and alerts
- Connection status indicators
- Throttled updates (500ms intervals)

## Memory Management
- Automatic cleanup of old log messages (50 max)
- Throttled provider health checks
- Efficient state management with memoization
- Background cleanup intervals

## Performance Tips
1. **Interactive Mode**: Use sparingly for better performance
2. **Auto-refresh**: Disable when monitoring many providers
3. **Log Retention**: Older logs are automatically cleared
4. **Connection Status**: Green = optimal, Yellow = throttled, Red = issues

## Troubleshooting Performance
- High memory usage: Restart the application
- Slow updates: Check connection status
- Laggy UI: Disable auto-refresh temporarily
- Unresponsive: Use [Ctrl+C] to exit safely

## Monitoring Commands
- [p] - Show current performance metrics
- [m] - Display memory usage details
- [c] - Show connection diagnostics
    `
  },
  'troubleshooting': {
    title: 'Troubleshooting',
    content: `
# Troubleshooting Guide

## Common Issues

### Connection Problems
**Symptoms**: Red connection status, "No data" messages
**Solutions**:
1. Check network connectivity
2. Verify provider configurations
3. Restart the application: [Ctrl+C] then relaunch
4. Check service logs in background terminal

### Performance Issues
**Symptoms**: Slow UI, high memory usage, lag
**Solutions**:
1. Disable auto-refresh: [a] in provider screen
2. Exit Interactive Mode: [i] to toggle off
3. Restart application if memory > 100MB
4. Close other resource-intensive applications

### Display Issues
**Symptoms**: Broken layout, missing text, garbled output
**Solutions**:
1. Resize terminal window
2. Check terminal compatibility (recommended: 80x24 minimum)
3. Update terminal application
4. Try different terminal emulator

### Provider Health Failures
**Symptoms**: Red provider status, connection errors
**Solutions**:
1. Check provider API keys and configuration
2. Verify network access to provider endpoints
3. Manual refresh: [r] in provider screen
4. Check provider service status pages

## Error Recovery
- **Component Errors**: [r] to attempt recovery (3 attempts max)
- **Network Errors**: Automatic retry with backoff
- **Memory Errors**: Automatic cleanup and restart
- **Critical Errors**: Safe exit with [q]

## Getting Help
- Context help: [h] in any screen
- Performance metrics: [p] for diagnostics
- Logs: Check \`~/.taskmaster/logs/\` directory
- Issue reporting: Include logs and system information
    `
  },
  'vibekit-integration': {
    title: 'VibeKit Integration',
    content: `
# VibeKit Ecosystem Integration

## Supported Coding Agents
- **Claude Code**: Anthropic's coding assistant
- **OpenAI Codex**: Code generation and completion
- **Gemini CLI**: Google's development assistant  
- **SST Opencode**: Full-stack development agent

## Sandbox Providers
- **E2B**: Cloud development environments
- **Daytona**: Secure coding sandboxes
- **Modal**: Serverless code execution
- **Fly.io**: Edge computing platforms
- **Northflank**: Container orchestration

## Real-time Monitoring Features
1. **Agent Execution Tracking**: Live progress of coding tasks
2. **Sandbox Health Monitoring**: Provider status and capabilities
3. **Streaming Logs**: Real-time output from agent operations
4. **Resource Usage**: Memory, CPU, and network monitoring

## VibeKit-Specific Controls
- **Agent Lifecycle**: Start, pause, resume, kill operations
- **Sandbox Management**: Provider selection and health checks
- **Stream Monitoring**: Live log aggregation and filtering
- **Performance Metrics**: Agent and sandbox performance tracking

## Integration Benefits
- **Enhanced Debugging**: Real-time insight into agent operations
- **Performance Optimization**: Monitor resource usage patterns
- **Provider Management**: Multi-provider health and capability tracking
- **Development Workflow**: Seamless coding agent integration

## Advanced Features
- **Telemetry Collection**: Agent performance and usage analytics
- **Error Recovery**: Automatic restart and failover capabilities
- **Load Balancing**: Intelligent provider selection
- **Security Monitoring**: Sandbox isolation and access control
    `
  }
};

export default function AdvancedHelpModal({ onClose, initialSection = 'getting-started' }) {
  const [currentSection, setCurrentSection] = useState(initialSection);
  const [searchTerm, setSearchTerm] = useState('');

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
    }
    if (key.tab) {
      const sections = Object.keys(HELP_SECTIONS);
      const currentIndex = sections.indexOf(currentSection);
      const nextIndex = (currentIndex + 1) % sections.length;
      setCurrentSection(sections[nextIndex]);
    }
    if (input === '1') setCurrentSection('getting-started');
    if (input === '2') setCurrentSection('navigation');
    if (input === '3') setCurrentSection('performance');
    if (input === '4') setCurrentSection('troubleshooting');
    if (input === '5') setCurrentSection('vibekit-integration');
  });

  const section = HELP_SECTIONS[currentSection];

  return (
    <Box 
      position="absolute" 
      top={0} 
      left={0} 
      width="100%" 
      height="100%" 
      backgroundColor="black"
      justifyContent="center"
      alignItems="center"
    >
      <Box width={90} height={30} flexDirection="column">
        <Alert variant="info">
          <Box flexDirection="column" padding={1}>
            <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
              <Text color="cyan" bold>Task Master Flow TUI - Advanced Help</Text>
              <Badge color="blue">VibeKit Ready</Badge>
            </Box>
            
            {/* Section Navigation */}
            <Box flexDirection="row" marginBottom={2}>
              {Object.entries(HELP_SECTIONS).map(([key, sec], index) => (
                <Box key={key} marginRight={1}>
                  <Text color={currentSection === key ? 'green' : 'gray'}>
                    [{index + 1}] {sec.title}
                  </Text>
                </Box>
              ))}
            </Box>
            
            {/* Content Area */}
            <Box height={20} flexDirection="column" borderStyle="single" padding={1}>
              <Text color="yellow" bold>{section.title}</Text>
              <Box marginTop={1} height={17}>
                <Text wrap="wrap">{section.content}</Text>
              </Box>
            </Box>
            
            {/* Footer */}
            <Box marginTop={1} flexDirection="row" justifyContent="space-between">
              <Text color="gray">
                [1-5] Sections | [Tab] Next Section | [Esc/q] Close
              </Text>
              <Badge color="green">Page {Object.keys(HELP_SECTIONS).indexOf(currentSection) + 1}/{Object.keys(HELP_SECTIONS).length}</Badge>
            </Box>
          </Box>
        </Alert>
      </Box>
    </Box>
  );
} 