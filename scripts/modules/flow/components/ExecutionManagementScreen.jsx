/**
 * VibeKit Execution Management Screen
 * Simplified execution interface focused on VibeKit SDK integration
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { Toast } from './Toast.jsx';
import { BaseModal } from './BaseModal.jsx';
import { useAppContext } from '../index.jsx';

export function ExecutionManagementScreen({ onBack }) {
	const { setNotification, backend } = useAppContext();
	
	// Core state
	const [selectedAgent, setSelectedAgent] = useState('claude-code');
	const [executionStatus, setExecutionStatus] = useState('idle');
	const [output, setOutput] = useState('');
	const [availableAgents, setAvailableAgents] = useState([]);
	const [mode, setMode] = useState('execute'); // 'execute', 'generate', 'agents'
	const [selectedTask, setSelectedTask] = useState(null);
	const [availableTasks, setAvailableTasks] = useState([]);
	const [customPrompt, setCustomPrompt] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	// Load available agents and tasks on mount
	useEffect(() => {
		loadAvailableAgents();
		loadAvailableTasks();
	}, []);

	const loadAvailableAgents = async () => {
		try {
			const { globalRegistry } = await import('../providers/registry.js');
			const providerInfo = globalRegistry.getProviderInfo('vibekit');
			setAvailableAgents(providerInfo.agents);
		} catch (error) {
			setError(`Failed to load agents: ${error.message}`);
		}
	};

	const loadAvailableTasks = async () => {
		try {
			const { getTasks } = await import('../../task-manager/get-tasks.js');
			const result = await getTasks({ status: 'pending' }, { projectRoot: process.cwd() });
			setAvailableTasks(result.tasks || []);
		} catch (error) {
			console.error('Failed to load tasks:', error);
		}
	};

	// Handle keyboard input
	useInput((input, key) => {
		if (key.escape) {
			if (selectedTask) {
				setSelectedTask(null);
			} else {
				onBack();
			}
		}

		if (input === '1') setMode('execute');
		if (input === '2') setMode('generate');
		if (input === '3') setMode('agents');
		
		if (input === 'a' && mode === 'agents') {
			// Cycle through agents
			const currentIndex = availableAgents.indexOf(selectedAgent);
			const nextIndex = (currentIndex + 1) % availableAgents.length;
			setSelectedAgent(availableAgents[nextIndex]);
		}

		if (input === 't' && mode === 'agents') {
			// Test selected agent
			testAgent(selectedAgent);
		}
	});

	// Execute task with VibeKit
	const handleExecuteTask = async (taskId) => {
		setExecutionStatus('running');
		setOutput('');
		setLoading(true);
		setError(null);

		try {
			const { executeTask } = await import('../commands/execution.command.js');
			
			setOutput('🚀 Starting task execution with VibeKit...\n');
			
			const result = await executeTask(taskId, {
				agent: selectedAgent,
				projectRoot: process.cwd(),
				mode: 'code',
				onProgress: (data) => {
					setOutput(prev => prev + `📊 Progress: ${data.progress || 0}% - ${data.message || 'Processing...'}\n`);
				}
			});

			setOutput(prev => prev + `\n✅ Task ${taskId} completed successfully!\n`);
			setOutput(prev => prev + `📝 Summary: ${result.summary || 'No summary available'}\n`);
			
			if (result.files && result.files.length > 0) {
				setOutput(prev => prev + `📁 Files modified: ${result.files.length}\n`);
				result.files.forEach(file => {
					setOutput(prev => prev + `   - ${file}\n`);
				});
			}

			setExecutionStatus('completed');
			setNotification({
				message: `Task ${taskId} completed successfully!`,
				type: 'success',
				duration: 3000
			});

		} catch (error) {
			setExecutionStatus('error');
			setError(error.message);
			setOutput(prev => prev + `\n❌ Task execution failed: ${error.message}\n`);
		} finally {
			setLoading(false);
		}
	};

	// Generate code with VibeKit
	const handleGenerateCode = async (prompt) => {
		setExecutionStatus('running');
		setOutput('');
		setLoading(true);
		setError(null);

		try {
			const { generateCode } = await import('../commands/execution.command.js');
			
			setOutput(`🤖 Generating code with ${selectedAgent}...\n`);
			
			const result = await generateCode(prompt, {
				agent: selectedAgent,
				mode: 'code',
				onUpdate: (data) => {
					if (data.content) {
						setOutput(prev => prev + data.content);
					}
				}
			});

			setOutput(prev => prev + '\n✅ Code generation completed!\n');
			setExecutionStatus('completed');
			setNotification({
				message: 'Code generation completed!',
				type: 'success',
				duration: 3000
			});

		} catch (error) {
			setExecutionStatus('error');
			setError(error.message);
			setOutput(prev => prev + `\n❌ Code generation failed: ${error.message}\n`);
		} finally {
			setLoading(false);
		}
	};

	// Test agent connectivity
	const testAgent = async (agentType) => {
		setLoading(true);
		try {
			const { globalRegistry } = await import('../providers/registry.js');
			const validation = globalRegistry.validateProviderConfig('vibekit');
			
			const requiredKey = getRequiredApiKey(agentType);
			const hasApiKey = !!process.env[requiredKey];
			
			if (!hasApiKey) {
				setError(`Missing API key: ${requiredKey}`);
				return;
			}

			setOutput(`✅ Agent ${agentType} is configured and ready\n`);
			setNotification({
				message: `Agent ${agentType} test successful`,
				type: 'success',
				duration: 2000
			});

		} catch (error) {
			setError(`Agent test failed: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	const getRequiredApiKey = (agent) => {
		switch (agent) {
			case 'claude-code': return 'ANTHROPIC_API_KEY';
			case 'codex': return 'OPENAI_API_KEY';
			case 'gemini-cli': return 'GOOGLE_API_KEY';
			case 'opencode': return 'OPENCODE_API_KEY';
			default: return 'ANTHROPIC_API_KEY';
		}
	};

	const getAgentStatus = (agent) => {
		const apiKey = getRequiredApiKey(agent);
		return process.env[apiKey] ? '✅' : '⚠️';
	};

	// Render task selection
	if (mode === 'execute' && !selectedTask) {
		const taskItems = availableTasks.map(task => ({
			label: `${task.id} - ${task.title}`,
			value: task.id,
			task: task
		}));

		return (
			<BaseModal title="🤖 VibeKit Execution - Select Task" onBack={onBack}>
				<Box flexDirection="column" padding={1}>
					<Box marginBottom={1}>
						<Text color="cyan">Agent: </Text>
						<Text bold color="green">{selectedAgent}</Text>
					</Box>

					{taskItems.length > 0 ? (
						<SelectInput 
							items={taskItems} 
							onSelect={(item) => {
								setSelectedTask(item.task);
								handleExecuteTask(item.value);
							}}
						/>
					) : (
						<Text color="gray">No pending tasks found</Text>
					)}

					<Box marginTop={1}>
						<Text color="gray">[1] Execute Task | [2] Generate Code | [3] Agents | [Esc] Back</Text>
					</Box>
				</Box>
			</BaseModal>
		);
	}

	// Render agents view
	if (mode === 'agents') {
		return (
			<BaseModal title="🤖 VibeKit Agents" onBack={onBack}>
				<Box flexDirection="column" padding={1}>
					<Box marginBottom={2}>
						<Text color="cyan">Available VibeKit Agents:</Text>
					</Box>

					{availableAgents.map(agent => (
						<Box key={agent} marginBottom={1} flexDirection="row">
							<Text color={agent === selectedAgent ? 'green' : 'white'}>
								{agent === selectedAgent ? '▶ ' : '  '}
							</Text>
							<Text color={getAgentStatus(agent) === '✅' ? 'green' : 'yellow'}>
								{getAgentStatus(agent)} {agent}
							</Text>
							<Box marginLeft={2}>
								<Text color="gray">
									{getRequiredApiKey(agent)} {getAgentStatus(agent) === '✅' ? '(configured)' : '(missing)'}
								</Text>
							</Box>
						</Box>
					))}

					<Box marginTop={2}>
						<Text color="cyan">Selected Agent: </Text>
						<Text bold color="green">{selectedAgent}</Text>
					</Box>

					<Box marginTop={1}>
						<Text color="gray">[a] Cycle Agent | [t] Test Agent | [1] Execute | [2] Generate | [Esc] Back</Text>
					</Box>
				</Box>
			</BaseModal>
		);
	}

	// Main execution/generation view
	return (
		<BaseModal 
			title={
				mode === 'execute' 
					? `🤖 VibeKit Execution - ${selectedAgent}` 
					: `🤖 VibeKit Code Generation - ${selectedAgent}`
			} 
			onBack={onBack}
		>
			<Box flexDirection="column" padding={1}>
				{/* Status Section */}
				<Box marginBottom={1} flexDirection="row" justifyContent="space-between">
					<Box>
						<Text color="cyan">Status: </Text>
						<Text bold color={
							executionStatus === 'running' ? 'yellow' :
							executionStatus === 'completed' ? 'green' :
							executionStatus === 'error' ? 'red' : 'white'
						}>
							{executionStatus}
						</Text>
					</Box>
					<Box>
						<Text color="cyan">Agent: </Text>
						<Text bold color="green">{selectedAgent}</Text>
					</Box>
				</Box>

				{/* Error Display */}
				{error && (
					<Box marginBottom={1}>
						<Text color="red">❌ Error: {error}</Text>
					</Box>
				)}

				{/* Task Info (Execute mode) */}
				{mode === 'execute' && selectedTask && (
					<Box marginBottom={1}>
						<Text color="cyan">Task: </Text>
						<Text>{selectedTask.id} - {selectedTask.title}</Text>
					</Box>
				)}

				{/* Output Section */}
				<Box borderStyle="single" padding={1} height={15} flexDirection="column">
					<Text color="yellow" bold>Output:</Text>
					<Box marginTop={1} flexGrow={1}>
						{loading && <LoadingSpinner />}
						{output ? (
							<Text>{output}</Text>
						) : (
							<Text color="gray">
								{mode === 'execute' 
									? 'Ready to execute task...' 
									: 'Ready to generate code...'}
							</Text>
						)}
					</Box>
				</Box>

				{/* Controls */}
				<Box marginTop={1}>
					<Text color="gray">
						[1] Execute Task | [2] Generate Code | [3] Agents | [Esc] {selectedTask ? 'Deselect' : 'Back'}
					</Text>
				</Box>
			</Box>
		</BaseModal>
	);
}
