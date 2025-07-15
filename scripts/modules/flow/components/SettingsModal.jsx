import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { FlowConfig } from '../shared/config/flow-config.js';
import VibeKitSetupGuide from './VibeKitSetupGuide.jsx';

export default function SettingsModal({ onClose, onSettingsChange, projectRoot }) {
	const [currentSection, setCurrentSection] = useState('vibekit');
	const [showSetupGuide, setShowSetupGuide] = useState(false);

	// Initialize config with fallbacks
	const config = new FlowConfig(projectRoot);
	const vibekitConfig = config.getVibeKitConfig() || {};
	
	// Ensure we have arrays to work with
	const agents = vibekitConfig.agents || [];
	const environments = vibekitConfig.environments || [];
	const github = vibekitConfig.github || {};

	// Input handling
	useInput((input, key) => {
		if (key.escape || input === 'q') {
			onClose();
		} else if (input === 'h' && currentSection === 'vibekit') {
			setShowSetupGuide(!showSetupGuide);
		} else if (input === '1') {
			setCurrentSection('vibekit');
			setShowSetupGuide(false);
		} else if (input === '2') {
			setCurrentSection('flow');
			setShowSetupGuide(false);
		}
	});

	// Helper functions
	const getAgentStatusColor = (agentId) => {
		const agent = agents.find(a => a.id === agentId);
		if (!agent) return 'gray';
		return agent.configured ? 'green' : 'red';
	};

	const getEnvironmentStatus = (envId) => {
		const env = environments.find(e => e.id === envId);
		if (!env) return '❌';
		return env.available ? '✅' : '❌';
	};

	// Show setup guide if requested
	if (showSetupGuide) {
		return (
			<VibeKitSetupGuide 
				onClose={() => setShowSetupGuide(false)}
				projectRoot={projectRoot}
			/>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="single" borderColor="blue" flexDirection="column" padding={1} marginBottom={1}>
				<Text bold color="blue">⚙️  Task Master Settings</Text>
				<Text color="gray">Press 'q' or ESC to close • Press 'h' for VibeKit setup help</Text>
			</Box>

			<Box flexDirection="row" height={20}>
				{/* Left sidebar - Navigation */}
				<Box flexDirection="column" width={25} marginRight={2}>
					<Box borderStyle="single" flexDirection="column" padding={1}>
						<Text bold>📋 Categories</Text>
						<Text color={currentSection === 'vibekit' ? 'cyan' : 'white'}>
							{currentSection === 'vibekit' ? '▶ ' : '  '}1. VibeKit Integration
						</Text>
						<Text color={currentSection === 'flow' ? 'cyan' : 'white'}>
							{currentSection === 'flow' ? '▶ ' : '  '}2. Flow Configuration
						</Text>
					</Box>
				</Box>

				{/* Right content area */}
				<Box flexDirection="column" flexGrow={1}>
					{currentSection === 'vibekit' && (
						<Box flexDirection="column">
							{/* VibeKit Status */}
							<Box borderStyle="single" borderColor="green" flexDirection="column" padding={1} marginBottom={1}>
								<Text bold color="green">🤖 VibeKit Service Status</Text>
								<Text>Status: {vibekitConfig.isConfigured ? '✅ Configured' : '❌ Not Configured'}</Text>
								<Text>Agents: {agents.filter(a => a.configured).length}/4 configured</Text>
								<Text>Default Agent: {vibekitConfig.defaultAgent || 'Not set'}</Text>
								<Text>Environments: {environments.filter(e => e.available).length}/3 available</Text>
							</Box>

							{/* Agents Panel */}
							<Box borderStyle="single" flexDirection="column" padding={1} marginBottom={1}>
								<Text bold>🤖 AI Agents ({agents.filter(a => a.configured).length}/4)</Text>
								<Text color={getAgentStatusColor('claude')}>
									Claude: {getAgentStatusColor('claude') === 'green' ? '✅' : '❌'} Configured
									{vibekitConfig.defaultAgent === 'claude' && <Text color="cyan"> (Default)</Text>}
								</Text>
								<Text color={getAgentStatusColor('gpt4')}>
									GPT-4: {getAgentStatusColor('gpt4') === 'green' ? '✅' : '❌'} Configured
									{vibekitConfig.defaultAgent === 'gpt4' && <Text color="cyan"> (Default)</Text>}
								</Text>
								<Text color={getAgentStatusColor('gemini')}>
									Gemini: {getAgentStatusColor('gemini') === 'green' ? '✅' : '❌'} Configured
									{vibekitConfig.defaultAgent === 'gemini' && <Text color="cyan"> (Default)</Text>}
								</Text>
								<Text color={getAgentStatusColor('opencode')}>
									OpenCode: {getAgentStatusColor('opencode') === 'green' ? '✅' : '❌'} Configured
									{vibekitConfig.defaultAgent === 'opencode' && <Text color="cyan"> (Default)</Text>}
								</Text>
							</Box>

							{/* Environments Panel */}
							<Box borderStyle="single" flexDirection="column" padding={1} marginBottom={1}>
								<Text bold>🏗️  Sandbox Environments ({environments.filter(e => e.available).length}/3)</Text>
								<Text>E2B: {getEnvironmentStatus('e2b')} Available</Text>
								<Text>Northflank: {getEnvironmentStatus('northflank')} Available</Text>
								<Text>Daytona: {getEnvironmentStatus('daytona')} Available</Text>
							</Box>

							{/* GitHub Integration */}
							<Box borderStyle="single" flexDirection="column" padding={1}>
								<Text bold>🐙 GitHub Integration</Text>
								<Text>Status: {github.configured ? '✅ Connected' : '❌ Not Connected'}</Text>
								{github.configured && (
									<Text>Repository: {github.repository || 'Not specified'}</Text>
								)}
							</Box>
						</Box>
					)}

					{currentSection === 'flow' && (
						<Box borderStyle="single" flexDirection="column" padding={1}>
							<Text bold color="blue">🌊 Flow Configuration</Text>
							<Text>Theme: Auto</Text>
							<Text>Project Root: {projectRoot}</Text>
							<Text>Debug Mode: Disabled</Text>
							<Text color="gray">Flow configuration options coming soon...</Text>
						</Box>
					)}
				</Box>
			</Box>

			<Box borderStyle="single" borderColor="gray" padding={1} marginTop={1}>
				<Text color="gray">
					💡 Tip: Press 'h' for VibeKit setup guide • Numbers 1-2 to switch sections • 'q' to close
				</Text>
			</Box>
		</Box>
	);
}
