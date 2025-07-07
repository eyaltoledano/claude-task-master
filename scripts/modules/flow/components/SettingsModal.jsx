import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Alert, StatusMessage, Badge } from '@inkjs/ui';

const DEFAULT_SETTINGS = {
  telemetry: {
    enabled: false,
    endpoint: '',
    samplingRate: 1.0
  },
  performance: {
    memoryThreshold: 100,
    cleanupInterval: 30000,
    renderOptimization: true
  },
  ui: {
    autoRefresh: true,
    refreshInterval: 2000,
    maxLogMessages: 50,
    theme: 'default'
  },
  vibekit: {
    defaultProvider: 'e2b',
    timeoutMs: 300000,
    retryAttempts: 3
  }
};

export default function SettingsModal({ onClose, onSettingsChange }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [currentCategory, setCurrentCategory] = useState('performance');
  const [hasChanges, setHasChanges] = useState(false);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
    }
    if (input === 's' && hasChanges) {
      onSettingsChange(settings);
      setHasChanges(false);
    }
    if (key.tab) {
      const categories = Object.keys(settings);
      const currentIndex = categories.indexOf(currentCategory);
      const nextIndex = (currentIndex + 1) % categories.length;
      setCurrentCategory(categories[nextIndex]);
    }
  });

  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

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
      <Box width={80} height={25} flexDirection="column">
        <Alert variant="info">
          <Box flexDirection="column" padding={1}>
            <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
              <Text color="cyan" bold>Flow TUI - Settings & Configuration</Text>
              {hasChanges && <Badge color="yellow">Unsaved Changes</Badge>}
            </Box>
            
            {/* Category Navigation */}
            <Box flexDirection="row" marginBottom={2}>
              {Object.keys(settings).map(category => (
                <Box key={category} marginRight={2}>
                  <Text color={currentCategory === category ? 'green' : 'gray'}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                </Box>
              ))}
            </Box>
            
            {/* Settings Content */}
            <Box height={15} flexDirection="column" borderStyle="single" padding={1}>
              <Text color="yellow" bold>{currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)} Settings</Text>
              
              <Box marginTop={1}>
                {currentCategory === 'performance' && (
                  <Box flexDirection="column">
                    <Text>Memory Threshold: {settings.performance.memoryThreshold} MB</Text>
                    <Text>Cleanup Interval: {settings.performance.cleanupInterval / 1000}s</Text>
                    <Text>Render Optimization: {settings.performance.renderOptimization ? 'Enabled' : 'Disabled'}</Text>
                  </Box>
                )}
                
                {currentCategory === 'telemetry' && (
                  <Box flexDirection="column">
                    <Text>Telemetry: {settings.telemetry.enabled ? 'Enabled' : 'Disabled'}</Text>
                    <Text>Sampling Rate: {(settings.telemetry.samplingRate * 100).toFixed(0)}%</Text>
                    <Text>Endpoint: {settings.telemetry.endpoint || 'Not configured'}</Text>
                  </Box>
                )}
                
                {currentCategory === 'ui' && (
                  <Box flexDirection="column">
                    <Text>Auto-refresh: {settings.ui.autoRefresh ? 'Enabled' : 'Disabled'}</Text>
                    <Text>Refresh Interval: {settings.ui.refreshInterval / 1000}s</Text>
                    <Text>Max Log Messages: {settings.ui.maxLogMessages}</Text>
                    <Text>Theme: {settings.ui.theme}</Text>
                  </Box>
                )}
                
                {currentCategory === 'vibekit' && (
                  <Box flexDirection="column">
                    <Text>Default Provider: {settings.vibekit.defaultProvider}</Text>
                    <Text>Timeout: {settings.vibekit.timeoutMs / 1000}s</Text>
                    <Text>Retry Attempts: {settings.vibekit.retryAttempts}</Text>
                  </Box>
                )}
              </Box>
            </Box>
            
            {/* Footer */}
            <Box marginTop={1} flexDirection="row" justifyContent="space-between">
              <Text color="gray">
                [Tab] Categories | [r] Reset | {hasChanges ? '[s] Save' : ''} | [Esc/q] Close
              </Text>
              <StatusMessage variant={hasChanges ? 'warning' : 'success'}>
                {hasChanges ? 'Modified' : 'Saved'}
              </StatusMessage>
            </Box>
          </Box>
        </Alert>
      </Box>
    </Box>
  );
} 