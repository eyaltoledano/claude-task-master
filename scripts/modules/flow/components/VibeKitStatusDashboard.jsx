/**
 * VibeKit Status Dashboard Component
 *
 * Simple dashboard showing VibeKit status, agent availability, and recent activity.
 * Provides quick access to common VibeKit operations.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LoadingSpinner } from '../shared/components/ui/LoadingSpinner.jsx';
import { VibeKitAgentStatusGrid } from './VibeKitAgentSelector.jsx';

export function VibeKitStatusDashboard({
	onBack,
	onExecuteTask,
	onGenerateCode,
	onManageAgents
}) {
	const [status, setStatus] = useState({
		agents: [],
		recentExecutions: [],
		usage: { tasksCompleted: 0, agentsUsed: 0 }
	});
	const [loading, setLoading] = useState(true);
	const [selectedAction, setSelectedAction] = useState(0);
	const [error, setError] = useState(null);

	const actions = [
		{ key: 'execute', label: '🚀 Execute Task', action: onExecuteTask },
		{ key: 'generate', label: '🤖 Generate Code', action: onGenerateCode },
		{ key: 'agents', label: '⚙️ Manage Agents', action: onManageAgents }
	];

	useEffect(() => {
		loadDashboardData();
		// Refresh every 30 seconds
		const interval = setInterval(loadDashboardData, 30000);
		return () => clearInterval(interval);
	}, []);

	const loadDashboardData = async () => {
		try {
			setLoading(true);

			// Load agent status
			const { globalRegistry } = await import('../providers/registry.js');
			const providerInfo = globalRegistry.getProviderInfo('vibekit');

			const agents = providerInfo.agents.map((agentKey) => {
				const apiKey = getRequiredApiKey(agentKey);
				const hasApiKey = !!process.env[apiKey];

				return {
					key: agentKey,
					name: formatAgentName(agentKey),
					status: hasApiKey ? 'ready' : 'no-key'
				};
			});

			// Get recent executions (mock data for now)
			const recentExecutions = [
				{
					id: '1',
					taskId: 'Task 5',
					agent: 'claude-code',
					status: 'completed',
					timestamp: new Date(Date.now() - 300000)
				},
				{
					id: '2',
					taskId: 'Task 3',
					agent: 'gemini-cli',
					status: 'completed',
					timestamp: new Date(Date.now() - 600000)
				},
				{
					id: '3',
					taskId: 'Task 8',
					agent: 'claude-code',
					status: 'failed',
					timestamp: new Date(Date.now() - 900000)
				}
			];

			// Calculate usage stats
			const usage = {
				tasksCompleted: recentExecutions.filter((e) => e.status === 'completed')
					.length,
				agentsUsed: [...new Set(recentExecutions.map((e) => e.agent))].length
			};

			setStatus({ agents, recentExecutions, usage });
		} catch (error) {
			setError(`Failed to load dashboard: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	const getRequiredApiKey = (agentKey) => {
		const keyMap = {
			'claude-code': 'ANTHROPIC_API_KEY',
			codex: 'OPENAI_API_KEY',
			'gemini-cli': 'GOOGLE_API_KEY',
			opencode: 'OPENCODE_API_KEY'
		};
		return keyMap[agentKey] || 'ANTHROPIC_API_KEY';
	};

	const formatAgentName = (agentKey) => {
		const nameMap = {
			'claude-code': 'Claude',
			codex: 'Codex',
			'gemini-cli': 'Gemini',
			opencode: 'OpenCode'
		};
		return nameMap[agentKey] || agentKey;
	};

	// Handle keyboard input
	useInput((input, key) => {
		if (key.escape || input === 'q') {
			onBack?.();
		} else if (key.upArrow && selectedAction > 0) {
			setSelectedAction(selectedAction - 1);
		} else if (key.downArrow && selectedAction < actions.length - 1) {
			setSelectedAction(selectedAction + 1);
		} else if (key.return && actions[selectedAction]) {
			actions[selectedAction].action?.();
		} else if (input === 'r') {
			loadDashboardData();
		}
	});

	if (loading) {
		return (
			<Box flexDirection="column" padding={1}>
				<LoadingSpinner />
				<Text color="cyan">Loading VibeKit dashboard...</Text>
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

	const readyAgents = status.agents.filter((a) => a.status === 'ready');
	const pendingAgents = status.agents.filter((a) => a.status === 'no-key');

	return (
		<Box flexDirection="column" padding={1}>
			{/* Header */}
			<Box marginBottom={2}>
				<Text color="cyan" bold>
					🤖 VibeKit Status Dashboard
				</Text>
			</Box>

			{/* Status Overview */}
			<Box marginBottom={2} borderStyle="single" padding={1}>
				<Box flexDirection="column">
					<Text color="green" bold>
						VibeKit Status: Ready
					</Text>
					<Box marginTop={1} flexDirection="row">
						<Box marginRight={4}>
							<Text color="cyan">Ready Agents: </Text>
							<Text color="green" bold>
								{readyAgents.length}/{status.agents.length}
							</Text>
						</Box>
						<Box marginRight={4}>
							<Text color="cyan">Tasks Completed: </Text>
							<Text color="green" bold>
								{status.usage.tasksCompleted}
							</Text>
						</Box>
						<Box>
							<Text color="cyan">Agents Used: </Text>
							<Text color="green" bold>
								{status.usage.agentsUsed}
							</Text>
						</Box>
					</Box>
				</Box>
			</Box>

			{/* Agent Status Grid */}
			<Box marginBottom={2}>
				<Text color="cyan" bold>
					Agent Status:
				</Text>
				<Box marginTop={1}>
					<VibeKitAgentStatusGrid showLabels={true} />
				</Box>
				{pendingAgents.length > 0 && (
					<Box marginTop={1}>
						<Text color="yellow">
							⚠️ {pendingAgents.length} agent(s) missing API keys
						</Text>
					</Box>
				)}
			</Box>

			{/* Recent Executions */}
			<Box marginBottom={2} borderStyle="single" padding={1}>
				<Text color="cyan" bold>
					Recent Executions:
				</Text>
				{status.recentExecutions.length > 0 ? (
					status.recentExecutions.slice(0, 3).map((exec) => (
						<Box key={exec.id} marginTop={1} flexDirection="row">
							<Text color={exec.status === 'completed' ? 'green' : 'red'}>
								{exec.status === 'completed' ? '✅' : '❌'}
							</Text>
							<Text marginLeft={1}>{exec.taskId}</Text>
							<Text marginLeft={2} color="gray">
								({formatAgentName(exec.agent)})
							</Text>
							<Text marginLeft={2} color="gray">
								{exec.timestamp.toLocaleTimeString()}
							</Text>
						</Box>
					))
				) : (
					<Box marginTop={1}>
						<Text color="gray">No recent executions</Text>
					</Box>
				)}
			</Box>

			{/* Quick Actions */}
			<Box marginBottom={1}>
				<Text color="cyan" bold>
					Quick Actions:
				</Text>
				{actions.map((action, index) => (
					<Box key={action.key} marginTop={1} flexDirection="row">
						<Text color={index === selectedAction ? 'cyan' : 'white'}>
							{index === selectedAction ? '▶ ' : '  '}
						</Text>
						<Text
							color={index === selectedAction ? 'cyan' : 'white'}
							bold={index === selectedAction}
						>
							{action.label}
						</Text>
					</Box>
				))}
			</Box>

			{/* Controls */}
			<Box marginTop={1}>
				<Text color="gray">
					[↑↓] Navigate | [Enter] Select | [r] Refresh | [q/Esc] Back
				</Text>
			</Box>
		</Box>
	);
}
