/**
 * VibeKit Agent Selector Component
 *
 * Reusable component for selecting and displaying VibeKit agents.
 * Shows agent status, API key configuration, and provides selection interface.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LoadingSpinner } from '../shared/components/ui/LoadingSpinner.jsx';

export function VibeKitAgentSelector({
	onSelect,
	selectedAgent = 'claude',
	showStatus = true,
	compact = false,
	title = '🤖 Select VibeKit Agent'
}) {
	const [agents, setAgents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [error, setError] = useState(null);

	// Load VibeKit agents on mount
	useEffect(() => {
		loadAgents();
	}, []);

	// Update selected index when selectedAgent prop changes
	useEffect(() => {
		const index = agents.findIndex((agent) => agent.key === selectedAgent);
		if (index >= 0) {
			setSelectedIndex(index);
		}
	}, [selectedAgent, agents]);

	const loadAgents = async () => {
		try {
			setLoading(true);
			const { globalRegistry } = await import('../providers/registry.js');
			const providerInfo = globalRegistry.getProviderInfo('vibekit');

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
			setError(`Failed to load agents: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	const getRequiredApiKey = (agentKey) => {
		const keyMap = {
			claude: 'ANTHROPIC_API_KEY',
			codex: 'OPENAI_API_KEY',
			gemini: 'GOOGLE_API_KEY',
			opencode: 'OPENCODE_API_KEY'
		};
		return keyMap[agentKey] || 'ANTHROPIC_API_KEY';
	};

	const formatAgentName = (agentKey) => {
		const nameMap = {
			claude: 'Claude Code',
			codex: 'OpenAI Codex',
			gemini: 'Gemini CLI',
			opencode: 'OpenCode'
		};
		return nameMap[agentKey] || agentKey;
	};

	const getAgentDescription = (agentKey) => {
		const descMap = {
			claude: 'Advanced reasoning and code generation',
			codex: 'OpenAI code completion and generation',
			gemini: 'Google development assistant',
			opencode: 'Full-stack development agent'
		};
		return descMap[agentKey] || 'VibeKit coding agent';
	};

	const renderAgentStatus = (agent) => {
		if (!showStatus) return null;

		return agent.status === 'ready' ? (
			<Text color="green">✅</Text>
		) : (
			<Text color="yellow">⚠️</Text>
		);
	};

	// Handle keyboard input
	useInput((input, key) => {
		if (key.upArrow && selectedIndex > 0) {
			setSelectedIndex(selectedIndex - 1);
		} else if (key.downArrow && selectedIndex < agents.length - 1) {
			setSelectedIndex(selectedIndex + 1);
		} else if (key.return && agents[selectedIndex]) {
			onSelect?.(agents[selectedIndex].key);
		}
	});

	if (loading) {
		return (
			<Box flexDirection="column" padding={compact ? 0 : 1}>
				<LoadingSpinner />
				<Text color="gray">Loading agents...</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column" padding={compact ? 0 : 1}>
				<Text color="red">❌ {error}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={compact ? 0 : 1}>
			{!compact && (
				<Box marginBottom={1}>
					<Text color="cyan" bold>
						{title}
					</Text>
				</Box>
			)}

			{agents.map((agent, index) => (
				<Box key={agent.key} marginBottom={compact ? 0 : 1} flexDirection="row">
					<Text color={index === selectedIndex ? 'cyan' : 'white'}>
						{index === selectedIndex ? '▶ ' : '  '}
					</Text>

					{showStatus && <Box marginRight={1}>{renderAgentStatus(agent)}</Box>}

					<Box flexGrow={1}>
						<Text
							color={index === selectedIndex ? 'cyan' : 'white'}
							bold={index === selectedIndex}
						>
							{agent.name}
						</Text>
						{!compact && (
							<Box marginLeft={2}>
								<Text color="gray">{agent.description}</Text>
							</Box>
						)}
					</Box>

					{!compact && showStatus && agent.status === 'no-key' && (
						<Box marginLeft={2}>
							<Text color="yellow">Missing: {agent.apiKey}</Text>
						</Box>
					)}
				</Box>
			))}

			{!compact && (
				<Box marginTop={1}>
					<Text color="gray">[↑↓] Navigate | [Enter] Select</Text>
				</Box>
			)}
		</Box>
	);
}

/**
 * VibeKit Agent Status Grid
 * Compact grid view of all agents with status indicators
 */
export function VibeKitAgentStatusGrid({
	selectedAgent = 'claude',
	onAgentClick,
	showLabels = true
}) {
	const [agents, setAgents] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadAgents();
	}, []);

	const loadAgents = async () => {
		try {
			const { globalRegistry } = await import('../providers/registry.js');
			const providerInfo = globalRegistry.getProviderInfo('vibekit');

			const agentList = providerInfo.agents.map((agentKey) => {
				const apiKey = getRequiredApiKey(agentKey);
				const hasApiKey = !!process.env[apiKey];

				return {
					key: agentKey,
					name: formatAgentName(agentKey),
					status: hasApiKey ? 'ready' : 'no-key'
				};
			});

			setAgents(agentList);
		} catch (error) {
			console.error('Failed to load agents:', error);
		} finally {
			setLoading(false);
		}
	};

	const getRequiredApiKey = (agentKey) => {
		const keyMap = {
			claude: 'ANTHROPIC_API_KEY',
			codex: 'OPENAI_API_KEY',
			gemini: 'GOOGLE_API_KEY',
			opencode: 'OPENCODE_API_KEY'
		};
		return keyMap[agentKey] || 'ANTHROPIC_API_KEY';
	};

	const formatAgentName = (agentKey) => {
		const nameMap = {
			claude: 'Claude',
			codex: 'Codex',
			gemini: 'Gemini',
			opencode: 'OpenCode'
		};
		return nameMap[agentKey] || agentKey;
	};

	if (loading) {
		return <LoadingSpinner />;
	}

	return (
		<Box flexDirection="row" flexWrap="wrap">
			{agents.map((agent, index) => (
				<Box key={agent.key} marginRight={2} marginBottom={1}>
					<Box flexDirection="row" alignItems="center">
						<Text color={agent.status === 'ready' ? 'green' : 'yellow'}>
							{agent.status === 'ready' ? '✅' : '⚠️'}
						</Text>
						{showLabels && (
							<Text
								color={agent.key === selectedAgent ? 'cyan' : 'white'}
								bold={agent.key === selectedAgent}
								marginLeft={1}
							>
								{agent.name}
							</Text>
						)}
					</Box>
				</Box>
			))}
		</Box>
	);
}
