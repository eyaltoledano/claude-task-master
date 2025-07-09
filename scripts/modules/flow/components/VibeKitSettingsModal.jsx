import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { VibeKitService } from '../services/vibekit.service.js';
import { FlowConfig } from '../config/flow-config.js';

export function VibeKitSettingsModal({ isVisible, onClose, projectRoot }) {
  const [config, setConfig] = useState({
    defaultAgent: 'claude',
    defaultSandbox: 'e2b',
    enableGitHub: false,
    enableSessionManagement: true,
    enableStreaming: true,
    enableTelemetry: false
  });
  const [selectedOption, setSelectedOption] = useState(0);
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [configStatus, setConfigStatus] = useState(null);
  const [flowConfig, setFlowConfig] = useState(null);

  // Initialize configuration
  useEffect(() => {
    if (isVisible && projectRoot) {
      try {
        const flow = new FlowConfig(projectRoot);
        const vibeKitConfig = flow.getVibeKitConfig();
        
        setFlowConfig(flow);
        setConfig({
          defaultAgent: vibeKitConfig.defaultAgent || 'claude',
          defaultSandbox: getDefaultSandbox(vibeKitConfig),
          enableGitHub: !!(vibeKitConfig.github?.token || process.env.GITHUB_API_KEY),
          enableSessionManagement: vibeKitConfig.sessionManagement?.enabled ?? true,
          enableStreaming: vibeKitConfig.streamingEnabled ?? true,
          enableTelemetry: vibeKitConfig.telemetry?.enabled ?? false
        });

        // Get status from a temporary VibeKit service
        const tempService = new VibeKitService({
          projectRoot,
          strictValidation: false
        });
        setConfigStatus(tempService.getConfigurationStatus());
      } catch (error) {
        console.error('Failed to load VibeKit configuration:', error);
      }
    }
  }, [isVisible, projectRoot]);

  const getDefaultSandbox = (vibeKitConfig) => {
    if (vibeKitConfig.environments?.e2b?.apiKey || process.env.E2B_API_KEY) return 'e2b';
    if (vibeKitConfig.environments?.northflank?.apiKey || process.env.NORTHFLANK_API_KEY) return 'northflank';
    if (vibeKitConfig.environments?.daytona?.apiKey || process.env.DAYTONA_API_KEY) return 'daytona';
    return 'local';
  };

  	const agentOptions = ['claude', 'codex', 'gemini', 'opencode'];
  const sandboxOptions = ['e2b', 'northflank', 'daytona', 'local'];

  const configOptions = [
    { 
      key: 'defaultAgent', 
      label: 'Default AI Agent', 
      value: config.defaultAgent,
      type: 'select',
      options: agentOptions,
      status: getAgentConfigStatus(config.defaultAgent)
    },
    { 
      key: 'defaultSandbox', 
      label: 'Default Sandbox', 
      value: config.defaultSandbox,
      type: 'select',
      options: sandboxOptions,
      status: getSandboxConfigStatus(config.defaultSandbox)
    },
    { 
      key: 'enableGitHub', 
      label: 'GitHub Integration', 
      value: config.enableGitHub ? 'Enabled' : 'Disabled',
      type: 'toggle',
      status: config.enableGitHub ? '✅' : '❌'
    },
    { 
      key: 'enableSessionManagement', 
      label: 'Session Management', 
      value: config.enableSessionManagement ? 'Enabled' : 'Disabled',
      type: 'toggle',
      status: config.enableSessionManagement ? '✅' : '❌'
    },
    { 
      key: 'enableStreaming', 
      label: 'Streaming Output', 
      value: config.enableStreaming ? 'Enabled' : 'Disabled',
      type: 'toggle',
      status: config.enableStreaming ? '✅' : '❌'
    },
    { 
      key: 'enableTelemetry', 
      label: 'Telemetry', 
      value: config.enableTelemetry ? 'Enabled' : 'Disabled',
      type: 'toggle',
      status: config.enableTelemetry ? '✅' : '❌'
    },
    { 
      key: 'apiKeys', 
      label: '🔑 Configure API Keys', 
      value: null,
      type: 'action',
      status: '⚙️'
    },
    { 
      key: 'save', 
      label: '💾 Save Configuration', 
      value: null,
      type: 'action',
      status: '✅'
    }
  ];

  function getAgentConfigStatus(agent) {
    if (!configStatus) return '❓';
    
    const apiKeyMap = {
      'claude': !!process.env.ANTHROPIC_API_KEY,
      'codex': !!process.env.OPENAI_API_KEY,
      'gemini': !!process.env.GOOGLE_API_KEY,
      'opencode': !!process.env.OPENCODE_API_KEY
    };
    
    return apiKeyMap[agent] ? '✅' : '❌';
  }

  function getSandboxConfigStatus(sandbox) {
    if (!configStatus) return '❓';
    
    if (sandbox === 'local') return '✅';
    
    const apiKeyMap = {
      'e2b': !!process.env.E2B_API_KEY,
      'northflank': !!process.env.NORTHFLANK_API_KEY,
      'daytona': !!process.env.DAYTONA_API_KEY
    };
    
    return apiKeyMap[sandbox] ? '✅' : '❌';
  }

  useInput((input, key) => {
    if (!isVisible) return;

    if (editingField) {
      // Handle text input when editing a field
      if (key.return) {
        // Save the edited value
        handleFieldSave();
      } else if (key.escape) {
        // Cancel editing
        setEditingField(null);
        setEditingValue('');
      } else if (key.backspace) {
        setEditingValue(prev => prev.slice(0, -1));
      } else if (input && input.length === 1) {
        setEditingValue(prev => prev + input);
      }
    } else {
      // Normal navigation
      if (key.upArrow) {
        setSelectedOption(Math.max(0, selectedOption - 1));
      } else if (key.downArrow) {
        setSelectedOption(Math.min(configOptions.length - 1, selectedOption + 1));
      } else if (key.return) {
        handleOptionSelect();
      } else if (key.escape) {
        onClose();
      }
    }
  });

  const handleFieldSave = () => {
    if (!editingField) return;
    
    // Update the config with the new value
    setConfig(prev => ({
      ...prev,
      [editingField]: editingValue
    }));
    
    setEditingField(null);
    setEditingValue('');
  };

  const handleOptionSelect = () => {
    const selected = configOptions[selectedOption];
    
    switch (selected.key) {
      case 'defaultAgent': {
        const currentIndex = agentOptions.indexOf(config.defaultAgent);
        const nextIndex = (currentIndex + 1) % agentOptions.length;
        setConfig(prev => ({ ...prev, defaultAgent: agentOptions[nextIndex] }));
        break;
      }
      
      case 'defaultSandbox': {
        const currentIndex = sandboxOptions.indexOf(config.defaultSandbox);
        const nextIndex = (currentIndex + 1) % sandboxOptions.length;
        setConfig(prev => ({ ...prev, defaultSandbox: sandboxOptions[nextIndex] }));
        break;
      }
      
      case 'enableGitHub':
        setConfig(prev => ({ ...prev, enableGitHub: !prev.enableGitHub }));
        break;
        
      case 'enableSessionManagement':
        setConfig(prev => ({ ...prev, enableSessionManagement: !prev.enableSessionManagement }));
        break;
        
      case 'enableStreaming':
        setConfig(prev => ({ ...prev, enableStreaming: !prev.enableStreaming }));
        break;
        
      case 'enableTelemetry':
        setConfig(prev => ({ ...prev, enableTelemetry: !prev.enableTelemetry }));
        break;
        
      case 'apiKeys':
        showApiKeysInfo();
        break;
        
      case 'save':
        saveConfiguration();
        break;
    }
  };

  const showApiKeysInfo = () => {
    // Show API keys configuration info (since we can't edit env vars in TUI)
    // This could trigger a help modal or show instructions
  };

  const saveConfiguration = async () => {
    if (!flowConfig) return;
    
    try {
      // Update the Flow configuration
      const vibeKitConfig = {
        defaultAgent: config.defaultAgent,
        streamingEnabled: config.enableStreaming,
        sessionManagement: {
          enabled: config.enableSessionManagement,
          persistSessions: config.enableSessionManagement
        },
        telemetry: {
          enabled: config.enableTelemetry
        }
      };
      
      // Save to Flow configuration
      flowConfig.updateVibeKitConfig(vibeKitConfig);
      
      // Close modal after save
      onClose();
    } catch (error) {
      console.error('Failed to save VibeKit configuration:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="green">
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="green">⚙️ VibeKit Configuration</Text>
      </Box>
      
      {editingField && (
        <Box marginBottom={1} borderStyle="single" borderColor="yellow" padding={1}>
          <Box flexDirection="column">
            <Text color="yellow">Editing: {configOptions.find(opt => opt.key === editingField)?.label}</Text>
            <Text>Value: {editingValue}</Text>
            <Text color="gray">Press Enter to save, Esc to cancel</Text>
          </Box>
        </Box>
      )}
      
      <Box flexDirection="column" marginBottom={1}>
        {configOptions.map((option, index) => (
          <Box key={`vibekit-config-${option.key}`}>
            <Text 
              color={index === selectedOption ? 'green' : 'white'}
              bold={index === selectedOption}
            >
              {index === selectedOption ? '▶ ' : '  '}
              {option.label}: {option.value || ''} {option.status}
            </Text>
          </Box>
        ))}
      </Box>
      
      {configStatus && (
        <Box flexDirection="column" marginBottom={1} paddingX={1} borderStyle="single" borderColor="blue">
          <Text bold color="blue">Current Status:</Text>
          <Text>Active Agent: {configStatus.agent.type} {configStatus.agent.configured ? '✅' : '❌'}</Text>
          <Text>Environments: {configStatus.environments.count} configured</Text>
          <Text>GitHub: {configStatus.github.configured ? '✅' : '❌'}</Text>
          <Text>Session Management: {configStatus.sessionManagement.enabled ? '✅' : '❌'}</Text>
          <Text>Streaming: {configStatus.streaming.enabled ? '✅' : '❌'}</Text>
          
          {configStatus.validation.issues.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="red">❌ Issues:</Text>
              {configStatus.validation.issues.map((issue, idx) => (
                <Text key={`issue-${idx}-${issue.slice(0, 10)}`} color="red">  • {issue}</Text>
              ))}
            </Box>
          )}
          
          {configStatus.validation.warnings.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="yellow">⚠️  Warnings:</Text>
              {configStatus.validation.warnings.map((warning, idx) => (
                <Text key={`status-warning-${idx}-${warning.slice(0, 10)}`} color="yellow">  • {warning}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}
      
      <Box flexDirection="column" marginTop={1} paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="gray">API Keys Required:</Text>
        <Text color="gray">• ANTHROPIC_API_KEY (for Claude)</Text>
        <Text color="gray">• OPENAI_API_KEY (for Codex)</Text>
        <Text color="gray">• GOOGLE_API_KEY (for Gemini)</Text>
        <Text color="gray">• E2B_API_KEY (for E2B sandbox)</Text>
        <Text color="gray">• GITHUB_API_KEY (for GitHub integration)</Text>
        <Text color="gray">Set these in your .env file or shell environment</Text>
      </Box>
      
      <Text color="gray" marginTop={1}>
        Use ↑↓ to navigate, Enter to select/toggle, Esc to close
      </Text>
    </Box>
  );
} 