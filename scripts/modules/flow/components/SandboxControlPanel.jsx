import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { VibeKitService } from '../services/vibekit.service.js';
import LoadingSpinner from '../shared/components/ui/LoadingSpinner.jsx';

export function SandboxControlPanel({ 
  isVisible, 
  onClose, 
  projectRoot,
  vibeKitService: providedService 
}) {
  const [vibeKitService, setVibeKitService] = useState(providedService);
  const [selectedOption, setSelectedOption] = useState(0);
  const [sandboxStatus, setSandboxStatus] = useState('unknown');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [hostUrls, setHostUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);

  // Initialize VibeKit service if not provided
  useEffect(() => {
    if (isVisible && !vibeKitService && projectRoot) {
      try {
        const service = new VibeKitService({
          projectRoot,
          strictValidation: false
        });
        setVibeKitService(service);
      } catch (err) {
        setError(`Failed to initialize VibeKit service: ${err.message}`);
      }
    }
  }, [isVisible, vibeKitService, projectRoot]);

  // Load sandbox status and session info when visible
  useEffect(() => {
    if (isVisible && vibeKitService) {
      refreshSandboxStatus();
      refreshSessionInfo();
    }
  }, [isVisible, vibeKitService]);

  const refreshSandboxStatus = async () => {
    if (!vibeKitService) return;
    
    try {
      const configStatus = vibeKitService.getConfigurationStatus();
      const readiness = vibeKitService.isReady();
      
      if (readiness.ready && readiness.sandbox.available) {
        setSandboxStatus('ready');
      } else {
        setSandboxStatus('not-configured');
      }
    } catch (err) {
      setSandboxStatus('error');
      setError(err.message);
    }
  };

  const refreshSessionInfo = async () => {
    if (!vibeKitService) return;
    
    try {
      const sessionInfo = await vibeKitService.getSessionInfo();
      setSessionInfo(sessionInfo);
    } catch (err) {
      console.warn('Failed to get session info:', err.message);
    }
  };

  const controlOptions = [
    {
      key: 'pause',
      label: '⏸️  Pause Sandbox',
      description: 'Pause the active sandbox to save resources',
      enabled: sandboxStatus === 'ready'
    },
    {
      key: 'resume',
      label: '▶️  Resume Sandbox',
      description: 'Resume a paused sandbox',
      enabled: sandboxStatus === 'ready'
    },
    {
      key: 'kill',
      label: '🛑 Terminate Sandbox',
      description: 'Completely terminate the active sandbox',
      enabled: sandboxStatus === 'ready'
    },
    {
      key: 'getSession',
      label: '🔍 Get Session ID',
      description: 'Display the current sandbox session ID',
      enabled: sandboxStatus === 'ready'
    },
    {
      key: 'setSession',
      label: '🔧 Set Session ID',
      description: 'Switch to a different session',
      enabled: sandboxStatus === 'ready'
    },
    {
      key: 'getHost',
      label: '🌐 Get Host URL',
      description: 'Get URL for accessing a port on the sandbox',
      enabled: sandboxStatus === 'ready'
    },
    {
      key: 'refresh',
      label: '🔄 Refresh Status',
      description: 'Refresh sandbox and session status',
      enabled: true
    }
  ];

  useInput((input, key) => {
    if (!isVisible || isLoading) return;

    if (key.upArrow) {
      setSelectedOption(Math.max(0, selectedOption - 1));
    } else if (key.downArrow) {
      setSelectedOption(Math.min(controlOptions.length - 1, selectedOption + 1));
    } else if (key.return) {
      handleControlAction();
    } else if (key.escape) {
      onClose();
    }
  });

  const handleControlAction = async () => {
    const selected = controlOptions[selectedOption];
    if (!selected.enabled || !vibeKitService) return;

    setIsLoading(true);
    setError(null);
    setStatusMessage('');

    try {
      switch (selected.key) {
        case 'pause':
          await vibeKitService.pause();
          setStatusMessage('✅ Sandbox paused successfully');
          setSandboxStatus('paused');
          break;

        case 'resume':
          await vibeKitService.resume();
          setStatusMessage('✅ Sandbox resumed successfully');
          setSandboxStatus('active');
          break;

        case 'kill':
          await vibeKitService.kill();
          setStatusMessage('✅ Sandbox terminated successfully');
          setSandboxStatus('terminated');
          break;

        case 'getSession': {
          const sessionId = await vibeKitService.getSession();
          if (sessionId) {
            setStatusMessage(`📋 Current Session: ${sessionId}`);
          } else {
            setStatusMessage('ℹ️  No active session found');
          }
          break;
        }

        case 'setSession': {
          // For simplicity, this example uses a fixed session ID
          // In a real implementation, you'd want a text input modal
          const newSessionId = 'flow-session-' + Date.now();
          await vibeKitService.setSession(newSessionId);
          setStatusMessage(`✅ Session set to: ${newSessionId}`);
          await refreshSessionInfo();
          break;
        }

        case 'getHost': {
          // Get host URLs for common ports
          const commonPorts = [3000, 8000, 8080, 5000, 4000];
          const urls = [];
          
          for (const port of commonPorts) {
            try {
              const hostUrl = vibeKitService.getHost(port);
              urls.push({ port, url: hostUrl });
            } catch (err) {
              // Port might not be available, skip silently
            }
          }
          
          setHostUrls(urls);
          if (urls.length > 0) {
            setStatusMessage(`🌐 Found ${urls.length} host URLs`);
          } else {
            setStatusMessage('ℹ️  No accessible ports found');
          }
          break;
        }

        case 'refresh':
          await refreshSandboxStatus();
          await refreshSessionInfo();
          setStatusMessage('🔄 Status refreshed');
          break;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getSandboxStatusDisplay = () => {
    switch (sandboxStatus) {
      case 'ready': return { color: 'green', text: '✅ Ready', description: 'Sandbox is configured and ready for use' };
      case 'active': return { color: 'green', text: '🟢 Active', description: 'Sandbox is running and available' };
      case 'paused': return { color: 'yellow', text: '⏸️  Paused', description: 'Sandbox is paused to save resources' };
      case 'terminated': return { color: 'red', text: '🛑 Terminated', description: 'Sandbox has been terminated' };
      case 'not-configured': return { color: 'yellow', text: '⚠️  Not Configured', description: 'Sandbox environment needs configuration' };
      case 'error': return { color: 'red', text: '❌ Error', description: 'Error accessing sandbox' };
      default: return { color: 'gray', text: '❓ Unknown', description: 'Sandbox status unknown' };
    }
  };

  if (!isVisible) return null;

  const statusDisplay = getSandboxStatusDisplay();

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">🏗️ Sandbox Control Panel</Text>
      </Box>

      {error && (
        <Box marginBottom={1} borderStyle="single" borderColor="red" padding={1}>
          <Text color="red">❌ Error: {error}</Text>
        </Box>
      )}

      {statusMessage && (
        <Box marginBottom={1} borderStyle="single" borderColor="green" padding={1}>
          <Text color="green">{statusMessage}</Text>
        </Box>
      )}

      {isLoading && (
        <Box marginBottom={1}>
          <LoadingSpinner />
          <Text color="blue"> Processing...</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1} paddingX={1} borderStyle="single" borderColor="blue">
        <Text bold color="blue">Status:</Text>
        <Text color={statusDisplay.color}>
          Sandbox: {statusDisplay.text}
        </Text>
        <Text color="gray">{statusDisplay.description}</Text>
        
        {sessionInfo && (
          <Box flexDirection="column" marginTop={1}>
            <Text>Session: {sessionInfo.hasActiveSession ? '✅ Active' : '❌ None'}</Text>
            {sessionInfo.sessionId && (
              <Text color="gray">ID: {sessionInfo.sessionId}</Text>
            )}
            <Text>Management: {sessionInfo.sessionManagement.enabled ? '✅ Enabled' : '❌ Disabled'}</Text>
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan" marginBottom={1}>Controls:</Text>
        {controlOptions.map((option, index) => (
          <Box key={`sandbox-control-${option.key}`}>
            <Text 
              color={index === selectedOption ? 'cyan' : (option.enabled ? 'white' : 'gray')}
              bold={index === selectedOption}
              dimColor={!option.enabled}
            >
              {index === selectedOption ? '▶ ' : '  '}
              {option.label}
            </Text>
          </Box>
        ))}
      </Box>

      {hostUrls.length > 0 && (
        <Box flexDirection="column" marginBottom={1} paddingX={1} borderStyle="single" borderColor="green">
          <Text bold color="green">Host URLs:</Text>
          {hostUrls.map((host) => (
            <Box key={`host-${host.port}`}>
              <Text color="green">Port {host.port}: </Text>
              <Text color="blue">{host.url}</Text>
            </Box>
          ))}
        </Box>
      )}

      {sandboxStatus === 'not-configured' && (
        <Box flexDirection="column" marginTop={1} paddingX={1} borderStyle="single" borderColor="yellow">
          <Text bold color="yellow">⚙️ Configuration Required:</Text>
          <Text color="yellow">• Set up sandbox environment (E2B, Northflank, or Daytona)</Text>
          <Text color="yellow">• Configure API keys in environment variables</Text>
          <Text color="yellow">• Use VibeKit Settings to configure defaults</Text>
        </Box>
      )}

      <Text color="gray" marginTop={1}>
        Use ↑↓ to navigate, Enter to execute, Esc to close
      </Text>
    </Box>
  );
} 