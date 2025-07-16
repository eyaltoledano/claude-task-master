/**
 * VibeKit Setup Guide Component
 *
 * Provides comprehensive setup instructions for VibeKit integration
 * including API keys, environment configuration, and troubleshooting
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Badge } from '@inkjs/ui';

export default function VibeKitSetupGuide({ onClose, projectRoot }) {
	const [currentSection, setCurrentSection] = useState(0);
	const [envStatus, setEnvStatus] = useState({});

	const sections = [
		'overview',
		'agents',
		'sandboxes',
		'github',
		'troubleshooting'
	];

	useEffect(() => {
		// Check which environment variables are set
		const status = {
			agents: {
				'claude-code': !!process.env.ANTHROPIC_API_KEY,
				codex: !!process.env.OPENAI_API_KEY,
				'gemini-cli': !!process.env.GOOGLE_API_KEY,
				opencode: !!process.env.OPENCODE_API_KEY
			},
			github: !!process.env.GITHUB_API_KEY,
			sandboxes: {
				e2b: !!process.env.E2B_API_KEY,
				northflank: !!process.env.NORTHFLANK_API_KEY,
				daytona: !!process.env.DAYTONA_API_KEY
			}
		};
		setEnvStatus(status);
	}, []);

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			onClose();
		}
		if (key.leftArrow && currentSection > 0) {
			setCurrentSection(currentSection - 1);
		}
		if (key.rightArrow && currentSection < sections.length - 1) {
			setCurrentSection(currentSection + 1);
		}
		if (key.tab) {
			setCurrentSection((currentSection + 1) % sections.length);
		}
	});

	const getSectionTitle = (section) => {
		const titles = {
			overview: '🚀 VibeKit Overview',
			agents: '🤖 AI Agents Setup',
			sandboxes: '📦 Sandbox Environments',
			github: '🐙 GitHub Integration',
			troubleshooting: '🔧 Troubleshooting'
		};
		return titles[section] || section;
	};

	const renderOverview = () => (
		<Box flexDirection="column">
			<Text color="cyan" bold>
				Welcome to VibeKit Integration!
			</Text>
			<Text marginTop={1}>
				VibeKit provides cloud-based AI agent execution with secure sandbox
				environments, GitHub automation, and advanced task management
				capabilities.
			</Text>

			<Box marginTop={2}>
				<Text color="yellow" bold>
					Key Features:
				</Text>
				<Text>• 🤖 Multiple AI agents (Claude, GPT-4, Gemini, OpenCode)</Text>
				<Text>• 📦 Secure sandbox environments (E2B, Northflank, Daytona)</Text>
				<Text>• 🐙 Automatic GitHub branch & PR management</Text>
				<Text>• 🔄 Real-time progress tracking</Text>
				<Text>• 🛡️ Enhanced security and isolation</Text>
			</Box>

			<Box marginTop={2}>
				<Text color="green" bold>
					Setup Requirements:
				</Text>
				<Text>1. At least one AI agent API key (required)</Text>
				<Text>2. GitHub token (recommended for automation)</Text>
				<Text>3. Sandbox environment API key (optional)</Text>
			</Box>

			<Box marginTop={2} borderStyle="single" padding={1}>
				<Text color="cyan" bold>
					Current Status:
				</Text>
				<Text
					color={
						Object.values(envStatus.agents || {}).some(Boolean)
							? 'green'
							: 'red'
					}
				>
					AI Agents:{' '}
					{Object.values(envStatus.agents || {}).filter(Boolean).length}/4
					configured
				</Text>
				<Text color={envStatus.github ? 'green' : 'yellow'}>
					GitHub: {envStatus.github ? 'Configured' : 'Not configured'}
				</Text>
				<Text
					color={
						Object.values(envStatus.sandboxes || {}).some(Boolean)
							? 'green'
							: 'yellow'
					}
				>
					Sandboxes:{' '}
					{Object.values(envStatus.sandboxes || {}).filter(Boolean).length}/3
					configured
				</Text>
			</Box>
		</Box>
	);

	const renderAgents = () => (
		<Box flexDirection="column">
			<Text color="cyan" bold>
				AI Agents Configuration
			</Text>
			<Text marginTop={1}>
				Configure at least one AI agent by adding the appropriate API key to
				your .env file:
			</Text>

			<Box marginTop={2}>
				<Text color="yellow" bold>
					Available Agents:
				</Text>

				{/* Claude Code */}
				<Box marginTop={1} flexDirection="row" alignItems="center">
					<Text color={envStatus.agents?.['claude-code'] ? 'green' : 'red'}>
						{envStatus.agents?.['claude-code'] ? '✓' : '✗'}
					</Text>
					<Text marginLeft={1} bold>
						Claude Code
					</Text>
					<Text marginLeft={2} color="gray">
						(Recommended)
					</Text>
				</Box>
				<Text color="gray"> ANTHROPIC_API_KEY=your_anthropic_api_key_here</Text>
				<Text color="gray"> • Best for complex coding tasks</Text>
				<Text color="gray"> • Excellent reasoning and debugging</Text>

				{/* GPT-4 Codex */}
				<Box marginTop={1} flexDirection="row" alignItems="center">
					<Text color={envStatus.agents?.codex ? 'green' : 'red'}>
						{envStatus.agents?.codex ? '✓' : '✗'}
					</Text>
					<Text marginLeft={1} bold>
						GPT-4 Codex
					</Text>
				</Box>
				<Text color="gray"> OPENAI_API_KEY=your_openai_api_key_here</Text>
				<Text color="gray"> • Strong general coding capabilities</Text>
				<Text color="gray"> • Fast response times</Text>

				{/* Gemini CLI */}
				<Box marginTop={1} flexDirection="row" alignItems="center">
					<Text color={envStatus.agents?.['gemini-cli'] ? 'green' : 'red'}>
						{envStatus.agents?.['gemini-cli'] ? '✓' : '✗'}
					</Text>
					<Text marginLeft={1} bold>
						Gemini CLI
					</Text>
				</Box>
				<Text color="gray"> GOOGLE_API_KEY=your_google_api_key_here</Text>
				<Text color="gray"> • Good for analysis and documentation</Text>
				<Text color="gray"> • Multi-modal capabilities</Text>

				{/* OpenCode */}
				<Box marginTop={1} flexDirection="row" alignItems="center">
					<Text color={envStatus.agents?.opencode ? 'green' : 'red'}>
						{envStatus.agents?.opencode ? '✓' : '✗'}
					</Text>
					<Text marginLeft={1} bold>
						OpenCode
					</Text>
				</Box>
				<Text color="gray"> OPENCODE_API_KEY=your_opencode_api_key_here</Text>
				<Text color="gray"> • Specialized for code generation</Text>
				<Text color="gray"> • Open-source focused</Text>
			</Box>

			<Box marginTop={2} borderStyle="single" padding={1}>
				<Text color="cyan" bold>
					Getting API Keys:
				</Text>
				<Text>• Anthropic: https://console.anthropic.com/</Text>
				<Text>• OpenAI: https://platform.openai.com/api-keys</Text>
				<Text>• Google: https://console.cloud.google.com/apis/credentials</Text>
				<Text>• OpenCode: Contact your provider for access</Text>
			</Box>
		</Box>
	);

	const renderSandboxes = () => (
		<Box flexDirection="column">
			<Text color="cyan" bold>
				Sandbox Environments (Optional)
			</Text>
			<Text marginTop={1}>
				Sandbox environments provide secure, isolated execution for your tasks.
				While optional, they enhance security and enable advanced features.
			</Text>

			<Box marginTop={2}>
				<Text color="yellow" bold>
					Available Providers:
				</Text>

				{/* E2B */}
				<Box marginTop={1} flexDirection="row" alignItems="center">
					<Text color={envStatus.sandboxes?.e2b ? 'green' : 'yellow'}>
						{envStatus.sandboxes?.e2b ? '✓' : '○'}
					</Text>
					<Text marginLeft={1} bold>
						E2B
					</Text>
					<Text marginLeft={2} color="gray">
						(Recommended)
					</Text>
				</Box>
				<Text color="gray"> E2B_API_KEY=your_e2b_api_key_here</Text>
				<Text color="gray"> • Fast startup times</Text>
				<Text color="gray"> • Excellent Node.js/Python support</Text>
				<Text color="gray"> • Built for AI code execution</Text>

				{/* Northflank */}
				<Box marginTop={1} flexDirection="row" alignItems="center">
					<Text color={envStatus.sandboxes?.northflank ? 'green' : 'yellow'}>
						{envStatus.sandboxes?.northflank ? '✓' : '○'}
					</Text>
					<Text marginLeft={1} bold>
						Northflank
					</Text>
				</Box>
				<Text color="gray">
					{' '}
					NORTHFLANK_API_KEY=your_northflank_api_key_here
				</Text>
				<Text color="gray"> • Enterprise-grade infrastructure</Text>
				<Text color="gray"> • Advanced networking capabilities</Text>
				<Text color="gray"> • Kubernetes-based</Text>

				{/* Daytona */}
				<Box marginTop={1} flexDirection="row" alignItems="center">
					<Text color={envStatus.sandboxes?.daytona ? 'green' : 'yellow'}>
						{envStatus.sandboxes?.daytona ? '✓' : '○'}
					</Text>
					<Text marginLeft={1} bold>
						Daytona
					</Text>
				</Box>
				<Text color="gray"> DAYTONA_API_KEY=your_daytona_api_key_here</Text>
				<Text color="gray"> • Development-focused environments</Text>
				<Text color="gray"> • VSCode integration</Text>
				<Text color="gray"> • Git-native workflows</Text>
			</Box>

			<Box marginTop={2} borderStyle="single" padding={1}>
				<Text color="cyan" bold>
					Getting Sandbox Access:
				</Text>
				<Text>• E2B: https://e2b.dev/ (Free tier available)</Text>
				<Text>• Northflank: https://northflank.com/ (Free tier available)</Text>
				<Text>• Daytona: https://daytona.io/ (Open source)</Text>
			</Box>
		</Box>
	);

	const renderGitHub = () => (
		<Box flexDirection="column">
			<Text color="cyan" bold>
				GitHub Integration (Recommended)
			</Text>
			<Text marginTop={1}>
				GitHub integration enables automatic branch creation, pull request
				management, and seamless collaboration workflows.
			</Text>

			<Box marginTop={2} flexDirection="row" alignItems="center">
				<Text color={envStatus.github ? 'green' : 'red'}>
					{envStatus.github ? '✓' : '✗'}
				</Text>
				<Text marginLeft={1} bold>
					GitHub Token Status
				</Text>
			</Box>

			<Box marginTop={2}>
				<Text color="yellow" bold>
					Setup Instructions:
				</Text>
				<Text>
					1. Go to GitHub Settings → Developer settings → Personal access tokens
				</Text>
				<Text>2. Click "Generate new token (classic)"</Text>
				<Text>3. Select the following scopes:</Text>
				<Text color="gray"> • repo (Full control of private repositories)</Text>
				<Text color="gray"> • workflow (Update GitHub Action workflows)</Text>
				<Text color="gray">
					{' '}
					• write:packages (Upload packages to GitHub Package Registry)
				</Text>
				<Text>4. Copy the generated token</Text>
				<Text>5. Add to your .env file:</Text>
				<Text color="green"> GITHUB_API_KEY=your_github_token_here</Text>
			</Box>

			<Box marginTop={2}>
				<Text color="yellow" bold>
					Features Enabled:
				</Text>
				<Text>• 🌿 Automatic branch creation for tasks</Text>
				<Text>• 📝 Pull request generation with descriptions</Text>
				<Text>• 🔄 Status updates and progress tracking</Text>
				<Text>• 👥 Team collaboration workflows</Text>
				<Text>• 🏷️ Automatic labeling and organization</Text>
			</Box>

			<Box marginTop={2} borderStyle="single" padding={1}>
				<Text color="cyan" bold>
					Security Note:
				</Text>
				<Text>
					Your GitHub token is stored locally in .env and never shared.
				</Text>
				<Text>
					VibeKit uses it only for repository operations you authorize.
				</Text>
			</Box>
		</Box>
	);

	const renderTroubleshooting = () => (
		<Box flexDirection="column">
			<Text color="cyan" bold>
				Troubleshooting & Common Issues
			</Text>

			<Box marginTop={2}>
				<Text color="red" bold>
					❌ "Missing API key for agent" Error:
				</Text>
				<Text>• Check that your .env file is in the project root</Text>
				<Text>• Verify the API key name matches exactly (case-sensitive)</Text>
				<Text>
					• Restart the Flow TUI after adding new environment variables
				</Text>
				<Text>• Check for extra spaces or quotes around the API key</Text>
			</Box>

			<Box marginTop={2}>
				<Text color="red" bold>
					❌ "Network error" Issues:
				</Text>
				<Text>• Check your internet connection</Text>
				<Text>• Verify API keys are valid and not expired</Text>
				<Text>• Check if your firewall is blocking requests</Text>
				<Text>• Try switching to a different agent or sandbox provider</Text>
			</Box>

			<Box marginTop={2}>
				<Text color="red" bold>
					❌ "Sandbox initialization failed":
				</Text>
				<Text>• Check sandbox provider API key and quota</Text>
				<Text>• Try using local execution mode (no sandbox required)</Text>
				<Text>• Verify your account has sandbox creation permissions</Text>
				<Text>• Check provider status pages for outages</Text>
			</Box>

			<Box marginTop={2}>
				<Text color="red" bold>
					❌ "GitHub operations failed":
				</Text>
				<Text>• Verify GitHub token has correct permissions</Text>
				<Text>• Check that you have write access to the repository</Text>
				<Text>• Ensure the repository exists and is accessible</Text>
				<Text>• Try refreshing the GitHub token</Text>
			</Box>

			<Box marginTop={2} borderStyle="single" padding={1}>
				<Text color="cyan" bold>
					Need More Help?
				</Text>
				<Text>• Check the Task Master documentation</Text>
				<Text>• Review VibeKit service logs in the console</Text>
				<Text>• Test individual components using the status dashboard</Text>
				<Text>• Try minimal configuration with just one agent first</Text>
			</Box>
		</Box>
	);

	const renderCurrentSection = () => {
		const section = sections[currentSection];
		switch (section) {
			case 'overview':
				return renderOverview();
			case 'agents':
				return renderAgents();
			case 'sandboxes':
				return renderSandboxes();
			case 'github':
				return renderGitHub();
			case 'troubleshooting':
				return renderTroubleshooting();
			default:
				return <Text>Unknown section</Text>;
		}
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
			<Box
				width={90}
				height={30}
				flexDirection="column"
				borderStyle="single"
				borderColor="cyan"
				padding={1}
			>
				{/* Header */}
				<Box
					flexDirection="row"
					justifyContent="space-between"
					marginBottom={1}
				>
					<Text color="cyan" bold>
						VibeKit Setup Guide
					</Text>
					<Badge color="blue">
						{currentSection + 1}/{sections.length}
					</Badge>
				</Box>

				{/* Section Navigation */}
				<Box flexDirection="row" marginBottom={2}>
					{sections.map((section, index) => (
						<Box key={section} marginRight={2}>
							<Text color={index === currentSection ? 'green' : 'gray'}>
								{index === currentSection ? '▶ ' : '  '}
								{getSectionTitle(section)}
							</Text>
						</Box>
					))}
				</Box>

				{/* Content */}
				<Box
					height={20}
					flexDirection="column"
					borderStyle="single"
					padding={1}
				>
					{renderCurrentSection()}
				</Box>

				{/* Footer */}
				<Box marginTop={1} flexDirection="row" justifyContent="space-between">
					<Text color="gray">
						[←→] Navigate sections | [Tab] Next | [Esc/q] Close
					</Text>
					<Text color="cyan">{getSectionTitle(sections[currentSection])}</Text>
				</Box>
			</Box>
		</Box>
	);
}
