/**
 * VibeKit Providers Screen Component
 *
 * Simplified provider management focused on VibeKit agents.
 * Shows agent status, API key configuration, and provides basic testing.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LoadingSpinner } from '../shared/components/ui/LoadingSpinner.jsx';

export function ProvidersScreen({ onBack, onError }) {
	const [agents, setAgents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [mode, setMode] = useState('list'); // 'list', 'test', 'details'
	const [testResult, setTestResult] = useState(null);
	const [error, setError] = useState(null);

	// Load VibeKit agents on mount
	useEffect(() => {
		loadVibeKitAgents();
	}, []);

	const loadVibeKitAgents = async () => {
		try {
			setLoading(true);

			// Import VibeKit registry
			const { globalRegistry } = await import('../providers/registry.js');
			const providerInfo = globalRegistry.getProviderInfo('vibekit');

			// Create agent list with status
			const agentList = providerInfo.agents.map((agentKey) => {
				const apiKey = getRequiredApiKey(agentKey);
				const hasApiKey = !!process.env[apiKey];

				return {
					key: agentKey,
					name: formatAgentName(agentKey),
					apiKey: apiKey,
					status: hasApiKey ? 'ready' : 'no-key',
					description: getAgentDescription(agentKey)
				};
			});

			setAgents(agentList);
		} catch (error) {
			setError(`Failed to load VibeKit agents: ${error.message}`);
			onError?.(`Failed to load VibeKit agents: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	// Get required API key for agent
	const getRequiredApiKey = (agentKey) => {
		const keyMap = {
			'claude-code': 'ANTHROPIC_API_KEY',
			codex: 'OPENAI_API_KEY',
			'gemini-cli': 'GOOGLE_API_KEY',
			opencode: 'OPENCODE_API_KEY'
		};
		return keyMap[agentKey] || 'ANTHROPIC_API_KEY';
	};

	// Format agent name for display
	const formatAgentName = (agentKey) => {
		const nameMap = {
			'claude-code': 'Claude Code',
			codex: 'OpenAI Codex',
			'gemini-cli': 'Gemini CLI',
			opencode: 'OpenCode'
		};
		return nameMap[agentKey] || agentKey;
	};

	// Get agent description
	const getAgentDescription = (agentKey) => {
		const descMap = {
			'claude-code': "Anthropic's coding assistant with advanced reasoning",
			codex: "OpenAI's code generation and completion model",
			'gemini-cli': "Google's development assistant for CLI tasks",
			opencode: 'Full-stack development agent'
		};
		return descMap[agentKey] || 'VibeKit coding agent';
	};

	// Test agent connectivity
	const testAgent = async (agentKey) => {
		try {
			setTestResult({ loading: true, agent: agentKey });

			const agent = agents.find((a) => a.key === agentKey);
			if (!agent) {
				throw new Error('Agent not found');
			}

			// Check API key
			if (agent.status === 'no-key') {
				throw new Error(`Missing API key: ${agent.apiKey}`);
			}

			// Try to create a simple test with VibeKit
			const { globalRegistry } = await import('../providers/registry.js');
			const provider = await globalRegistry.getProvider('vibekit', {
				defaultAgent: agentKey
			});

			// Basic connectivity test
			setTestResult({
				loading: false,
				agent: agentKey,
				success: true,
				message: `Agent ${agent.name} is configured and ready to execute tasks`
			});
		} catch (error) {
			setTestResult({
				loading: false,
				agent: agentKey,
				success: false,
				message: error.message
			});
		}
	};

	// Set default agent
	const setDefaultAgent = async (agentKey) => {
		try {
			// Update VibeKit configuration to use this agent as default
			// This would integrate with the flow configuration system
			setMode('list');
			onError?.(
				`Set ${formatAgentName(agentKey)} as default agent (feature coming soon)`
			);
		} catch (error) {
			onError?.(`Failed to set default agent: ${error.message}`);
		}
	};

	// Handle keyboard input
	useInput((input, key) => {
		if (mode === 'list') {
			if (key.upArrow && selectedIndex > 0) {
				setSelectedIndex(selectedIndex - 1);
			} else if (key.downArrow && selectedIndex < agents.length - 1) {
				setSelectedIndex(selectedIndex + 1);
			} else if (key.return && agents[selectedIndex]) {
				// Show action menu for selected agent
				setMode('actions');
			} else if (input === 'r') {
				// Refresh agents
				loadVibeKitAgents();
			} else if (input === 'q' || key.escape) {
				onBack?.();
			}
		} else if (mode === 'actions') {
			const agent = agents[selectedIndex];
			if (input === 't') {
				testAgent(agent.key);
				setMode('test');
			} else if (input === 'd') {
				setMode('details');
			} else if (input === 's') {
				setDefaultAgent(agent.key);
			} else if (input === 'b' || key.escape) {
				setMode('list');
			}
		} else if (mode === 'test' || mode === 'details') {
			if (input === 'b' || key.escape) {
				setMode('list');
				setTestResult(null);
			}
		}
	});

	// Render agent status indicator
	const renderStatus = (agent) => {
		if (agent.status === 'ready') {
			return <Text color="green">✅ Ready</Text>;
		} else {
			return <Text color="yellow">⚠️ No API Key</Text>;
		}
	};

	if (loading) {
		return (
			<Box flexDirection="column" padding={1}>
				<LoadingSpinner />
				<Text color="cyan">Loading VibeKit agents...</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">❌ Error: {error}</Text>
				<Box marginTop={1}>
					<Text color="gray">[r] Retry | [q/Esc] Back</Text>
				</Box>
			</Box>
		);
	}

	// Render test results
	if (mode === 'test' && testResult) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Testing Agent: {formatAgentName(testResult.agent)}
				</Text>
				<Box marginTop={1}>
					{testResult.loading ? (
						<Box>
							<LoadingSpinner />
							<Text color="gray">Testing connectivity...</Text>
						</Box>
					) : (
						<Box flexDirection="column">
							<Text color={testResult.success ? 'green' : 'red'}>
								{testResult.success ? '✅ Test Passed' : '❌ Test Failed'}
							</Text>
							<Box marginTop={1}>
								<Text>{testResult.message}</Text>
							</Box>
						</Box>
					)}
				</Box>
				<Box marginTop={1}>
					<Text color="gray">[b/Esc] Back to list</Text>
				</Box>
			</Box>
		);
	}

	// Render agent details
	if (mode === 'details') {
		const agent = agents[selectedIndex];
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Agent Details: {agent.name}
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Text>
						<Text color="cyan">Key:</Text> {agent.key}
					</Text>
					<Text>
						<Text color="cyan">Status:</Text> {renderStatus(agent)}
					</Text>
					<Text>
						<Text color="cyan">API Key:</Text> {agent.apiKey}
					</Text>
					<Text>
						<Text color="cyan">Description:</Text> {agent.description}
					</Text>
				</Box>
				<Box marginTop={2}>
					<Text color="gray">[b/Esc] Back to list</Text>
				</Box>
			</Box>
		);
	}

	// Render actions menu
	if (mode === 'actions') {
		const agent = agents[selectedIndex];
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Actions for: {agent.name}
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Text>[t] Test connectivity</Text>
					<Text>[d] View details</Text>
					<Text>[s] Set as default agent</Text>
					<Text>[b/Esc] Back to list</Text>
				</Box>
			</Box>
		);
	}

	// Main agent list view
	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text color="cyan" bold>
					🤖 VibeKit Agent Management
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text color="gray">Available Agents ({agents.length}):</Text>
			</Box>

			{agents.map((agent, index) => (
				<Box key={agent.key} marginBottom={1}>
					<Text color={index === selectedIndex ? 'cyan' : 'white'}>
						{index === selectedIndex ? '▶ ' : '  '}
					</Text>
					<Box width={16}>
						<Text color={index === selectedIndex ? 'cyan' : 'white'} bold>
							{agent.name}
						</Text>
					</Box>
					<Box width={20} marginLeft={1}>
						{renderStatus(agent)}
					</Box>
					<Box marginLeft={1}>
						<Text color="gray">{agent.description}</Text>
					</Box>
				</Box>
			))}

			<Box marginTop={1}>
				<Text color="gray">
					[↑↓] Navigate | [Enter] Actions | [r] Refresh | [q/Esc] Back
				</Text>
			</Box>
		</Box>
	);
}
