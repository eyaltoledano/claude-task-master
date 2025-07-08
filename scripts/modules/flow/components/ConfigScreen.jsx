import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { getCurrentTheme } from '../theme.js';
import { useAppContext } from '../index.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';

export function ConfigScreen() {
	const theme = getCurrentTheme();
	const { setCurrentScreen, showToast } = useAppContext();
	const [activeTab, setActiveTab] = useState('agents'); // 'agents' or 'sandboxes'
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'

	// Data states
	const [agents, setAgents] = useState([]);
	const [sandboxes, setSandboxes] = useState([]);
	const [selectedItem, setSelectedItem] = useState(null);

	// Load agents and sandboxes data
	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		setLoading(true);
		setError(null);
		
		try {
			// Load agents from VibeKit service
			await loadAgents();
			
			// Load sandboxes from VibeKit service
			await loadSandboxes();
		} catch (err) {
			setError(`Failed to load configuration: ${err.message}`);
		} finally {
			setLoading(false);
		}
	};

	const loadAgents = async () => {
		try {
			const { VibeKitService } = await import('../services/vibekit.service.js');
			const vibekitService = new VibeKitService();
			
			const availableAgents = await vibekitService.getAvailableAgents();
			
			// Transform real VibeKit agent data to UI format
			const formattedAgents = availableAgents.map(agent => ({
				id: agent.type,
				name: agent.name,
				description: getAgentDescription(agent.type),
				provider: capitalizeProvider(agent.provider),
				configured: agent.configured,
				model: agent.model,
				isDefault: false, // TODO: Load from config
				type: 'AI Agent',
				features: getAgentFeatures(agent.type)
			}));
			
			setAgents(formattedAgents);
		} catch (error) {
			console.warn('Failed to load agents, using mock data:', error);
			setAgents(getMockAgents());
		}
	};

	const loadSandboxes = async () => {
		try {
			const { VibeKitService } = await import('../services/vibekit.service.js');
			const vibekitService = new VibeKitService();
			
			const availableEnvironments = await vibekitService.getAvailableEnvironments();
			
			// Transform real VibeKit sandbox data to UI format
			const formattedSandboxes = availableEnvironments.map(env => ({
				id: env.key,
				name: env.name,
				description: env.description,
				configured: env.configured,
				isDefault: false, // TODO: Load from config
				type: getSandboxType(env.key),
				features: getSandboxFeatures(env.key)
			}));
			
			setSandboxes(formattedSandboxes);
		} catch (error) {
			console.warn('Failed to load sandboxes, using mock data:', error);
			setSandboxes(getMockSandboxes());
		}
	};

	const getCurrentItems = () => {
		return activeTab === 'agents' ? agents : sandboxes;
	};

	const getCurrentItem = () => {
		const items = getCurrentItems();
		return items[selectedIndex] || null;
	};

	const handleTabSwitch = (tab) => {
		setActiveTab(tab);
		setSelectedIndex(0);
		setViewMode('list');
		setSelectedItem(null);
	};

	const handleViewDetails = () => {
		const item = getCurrentItem();
		if (item) {
			setSelectedItem(item);
			setViewMode('detail');
		}
	};

	const handleSetDefault = async () => {
		const item = getCurrentItem();
		if (!item) return;

		try {
			setLoading(true);
			
			// TODO: Implement default setting via VibeKit service or config
			if (activeTab === 'agents') {
				// Set default agent
				showToast(`Set ${item.name} as default agent`);
			} else {
				// Set default sandbox
				showToast(`Set ${item.name} as default sandbox`);
			}
		} catch (error) {
			setError(`Failed to set default: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	// Keyboard input handling
	useInput((input, key) => {
		if (loading) return;

		if (key.escape) {
			if (viewMode === 'detail') {
				// Explicitly handle escape from detail view
				setViewMode('list');
				setSelectedItem(null);
				return; // Prevent further processing
			} else {
				// Only go to welcome screen if we're in list view
				setCurrentScreen('welcome');
				return;
			}
		}

		// Handle input based on current view mode
		if (viewMode === 'detail') {
			// In detail view, only handle escape (which we already handled above)
			// No other navigation keys should be processed
			return;
		}

		// List view navigation (only when viewMode === 'list')
		if (key.upArrow && selectedIndex > 0) {
			setSelectedIndex(prev => prev - 1);
		} else if (key.downArrow && selectedIndex < getCurrentItems().length - 1) {
			setSelectedIndex(prev => prev + 1);
		} else if (key.leftArrow) {
			handleTabSwitch('agents');
		} else if (key.rightArrow) {
			handleTabSwitch('sandboxes');
		} else if (key.return) {
			handleViewDetails();
		} else if (input === 'd') {
			handleSetDefault();
		} else if (input === 'r') {
			loadData();
		}
	});

	if (loading && getCurrentItems().length === 0) {
		return (
			<Box flexDirection="column" height="100%" justifyContent="center" alignItems="center">
				<LoadingSpinner />
				<Text color={theme.textDim}>Loading configuration...</Text>
			</Box>
		);
	}

	if (viewMode === 'detail' && selectedItem) {
		return renderDetailView();
	}

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text color={theme.accent}>Task Master</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color="white">Configuration</Text>
				</Box>
				<Text color={theme.textDim}>[ESC back]</Text>
			</Box>

			{/* Tab Navigation */}
			<Box marginBottom={1} paddingLeft={1}>
				<Text 
					color={activeTab === 'agents' ? theme.accent : theme.textDim}
					bold={activeTab === 'agents'}
				>
					← Agents
				</Text>
				<Text color={theme.textDim}> • </Text>
				<Text 
					color={activeTab === 'sandboxes' ? theme.accent : theme.textDim}
					bold={activeTab === 'sandboxes'}
				>
					Sandboxes →
				</Text>
			</Box>

			{/* Error Display */}
			{error && (
				<Box marginBottom={1} paddingLeft={1}>
					<Text color={theme.error}>⚠ {error}</Text>
				</Box>
			)}

			{/* Items List */}
			<Box flexGrow={1} paddingLeft={1} paddingRight={1}>
				{getCurrentItems().length === 0 ? (
					<Box justifyContent="center" alignItems="center" height="100%">
						<Text color={theme.textDim}>
							No {activeTab} available
						</Text>
					</Box>
				) : (
					<Box flexDirection="column">
						{getCurrentItems().map((item, index) => (
							<Box 
								key={item.id} 
								marginBottom={1}
								borderStyle={index === selectedIndex ? "single" : undefined}
								borderColor={index === selectedIndex ? theme.accent : undefined}
								padding={index === selectedIndex ? 1 : 0}
							>
								<Box width={3}>
									<Text color={index === selectedIndex ? theme.accent : theme.textDim}>
										{index === selectedIndex ? '→' : ' '}
									</Text>
								</Box>
								<Box flexDirection="column" flexGrow={1}>
									<Box>
										<Text color={index === selectedIndex ? theme.accent : theme.text} bold>
											{item.name}
										</Text>
										{item.isDefault && (
											<Text color={theme.success}> (Default)</Text>
										)}
										{!item.configured && (
											<Text color={theme.warning}> (Not Configured)</Text>
										)}
									</Box>
									<Text color={theme.textDim}>{item.provider || item.description}</Text>
									{item.model && (
										<Text color={theme.textDim}>Model: {item.model}</Text>
									)}
									{/* Show key features for sandboxes */}
									{activeTab === 'sandboxes' && item.features && (
										<Text color={theme.textDim}>
											Features: {item.features.slice(0, 3).join(', ')}
											{item.features.length > 3 && '...'}
										</Text>
									)}
								</Box>
							</Box>
						))}
					</Box>
				)}
			</Box>

			{/* Footer */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
				flexShrink={0}
			>
				<Text color={theme.text}>
					↑↓ navigate • ←→ switch tabs • Enter details • d set default • r refresh • ESC back
				</Text>
			</Box>
		</Box>
	);

	function renderDetailView() {
		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color="white">Configuration</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>{selectedItem.name}</Text>
					</Box>
					<Text color={theme.textDim}>[ESC back]</Text>
				</Box>

				{/* Detail Content */}
				<Box flexGrow={1} paddingLeft={2} paddingRight={2}>
					<Box flexDirection="column">
						<Box marginBottom={1}>
							<Text color={theme.accent} bold>Name: </Text>
							<Text color={theme.text}>{selectedItem.name}</Text>
						</Box>
						
						<Box marginBottom={1}>
							<Text color={theme.accent} bold>Type: </Text>
							<Text color={theme.text}>{activeTab === 'agents' ? 'AI Agent' : 'Sandbox Environment'}</Text>
						</Box>
						
						<Box marginBottom={1}>
							<Text color={theme.accent} bold>Provider: </Text>
							<Text color={theme.text}>{selectedItem.provider}</Text>
						</Box>
						
						{selectedItem.model && (
							<Box marginBottom={1}>
								<Text color={theme.accent} bold>Model: </Text>
								<Text color={theme.text}>{selectedItem.model}</Text>
							</Box>
						)}
						
						<Box marginBottom={1}>
							<Text color={theme.accent} bold>Status: </Text>
							<Text color={selectedItem.configured ? theme.success : theme.warning}>
								{selectedItem.configured ? 'Configured' : 'Not Configured'}
							</Text>
						</Box>
						
						<Box marginBottom={1}>
							<Text color={theme.accent} bold>Default: </Text>
							<Text color={selectedItem.isDefault ? theme.success : theme.textDim}>
								{selectedItem.isDefault ? 'Yes' : 'No'}
							</Text>
						</Box>
						
						<Box marginBottom={1}>
							<Text color={theme.accent} bold>Description: </Text>
							<Text color={theme.text}>{selectedItem.description}</Text>
						</Box>

						{/* Show features for sandboxes */}
						{activeTab === 'sandboxes' && selectedItem.features && (
							<Box marginBottom={1}>
								<Text color={theme.accent} bold>Features: </Text>
								<Box flexDirection="column" marginLeft={2}>
									{selectedItem.features.map((feature) => (
										<Text key={feature} color={theme.text}>• {feature}</Text>
									))}
								</Box>
							</Box>
						)}

						{/* Configuration details */}
						{!selectedItem.configured && (
							<Box marginTop={2} padding={1} borderStyle="single" borderColor={theme.warning}>
								<Text color={theme.warning} bold>Configuration Required</Text>
								<Text color={theme.textDim}>
									{activeTab === 'agents' 
										? `This agent requires API key configuration for ${selectedItem.provider}`
										: `This sandbox environment requires setup and API key configuration`
									}
								</Text>
							</Box>
						)}
					</Box>
				</Box>

				{/* Footer */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<Text color={theme.text}>
						{selectedItem.configured ? 'd set default • ' : ''}ESC back to config list
					</Text>
				</Box>
			</Box>
		);
	}
}

// Helper functions
const getAgentDescription = (type) => {
	const descriptions = {
		'claude-code': 'Most capable model for complex coding tasks',
		'codex': 'OpenAI\'s powerful code generation model', 
		'gemini-cli': 'Google\'s multimodal AI model for diverse tasks',
		'opencode': 'Open source model for basic development tasks'
	};
	return descriptions[type] || 'AI coding assistant';
};

const capitalizeProvider = (provider) => {
	const providers = {
		'anthropic': 'Anthropic',
		'openai': 'OpenAI',
		'google': 'Google',
		'gemini': 'Google',
		'opencode': 'OpenCode'
	};
	return providers[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
};

const getAgentFeatures = (type) => {
	const features = {
		'claude-code': ['Code Generation', 'Natural Language Processing', 'API Integration'],
		'codex': ['Code Generation', 'API Integration', 'Language Understanding'],
		'gemini-cli': ['Multimodal Processing', 'API Integration', 'Language Understanding'],
		'opencode': ['Code Generation', 'API Integration', 'Language Understanding']
	};
	return features[type] || ['API Integration'];
};

const getSandboxType = (key) => {
	const types = {
		'e2b': 'Cloud Sandbox',
		'daytona': 'Development Environment',
		'modal': 'Compute Platform',
		'flyio': 'Edge Platform'
	};
	return types[key] || 'Environment';
};

const getSandboxFeatures = (key) => {
	const features = {
		'e2b': ['Node.js', 'Python', 'Browser', 'Full Filesystem', 'Package Installation'],
		'daytona': ['Team Collaboration', 'Environment Templates', 'Version Control Integration'],
		'modal': ['GPU Support', 'Distributed Computing', 'ML Libraries', 'Serverless'],
		'flyio': ['Edge Computing', 'Global Distribution', 'Docker Support', 'Auto-scaling']
	};
	return features[key] || ['API Integration'];
};

const getMockAgents = () => [
	{
		id: 'claude-code',
		name: 'Claude Code',
		description: 'Most capable model for complex coding tasks',
		provider: 'Anthropic',
		configured: true,
		model: 'claude-3-5-sonnet-20241022',
		isDefault: true
	},
	{
		id: 'codex',
		name: 'OpenAI Codex',
		description: 'OpenAI\'s powerful code generation model',
		provider: 'OpenAI',
		configured: true,
		model: 'gpt-4',
		isDefault: false
	},
	{
		id: 'gemini-cli',
		name: 'Gemini CLI',
		description: 'Google\'s multimodal AI model for diverse tasks',
		provider: 'Google',
		configured: false,
		model: 'gemini-1.5-pro',
		isDefault: false
	},
	{
		id: 'opencode',
		name: 'SST Opencode',
		description: 'Open source model for basic development tasks',
		provider: 'OpenCode',
		configured: false,
		model: 'opencode-latest',
		isDefault: false
	}
];

const getMockSandboxes = () => [
	{
		id: 'e2b',
		name: 'E2B Cloud Sandbox',
		description: 'Secure cloud-based development environment with full filesystem access',
		provider: 'E2B',
		configured: true,
		isDefault: true,
		features: ['Node.js', 'Python', 'Browser', 'Full Filesystem', 'Package Installation']
	},
	{
		id: 'daytona',
		name: 'Daytona Environment',
		description: 'Standardized development environments for teams',
		provider: 'Daytona',
		configured: false,
		isDefault: false,
		features: ['Team Collaboration', 'Environment Templates', 'Version Control Integration']
	},
	{
		id: 'modal',
		name: 'Modal Compute',
		description: 'High-performance cloud compute for ML and data workloads',
		provider: 'Modal',
		configured: false,
		isDefault: false,
		features: ['GPU Support', 'Distributed Computing', 'ML Libraries', 'Serverless']
	},
	{
		id: 'flyio',
		name: 'Fly.io Edge',
		description: 'Global edge compute platform with low latency',
		provider: 'Fly.io',
		configured: false,
		isDefault: false,
		features: ['Edge Computing', 'Global Distribution', 'Docker Support', 'Auto-scaling']
	}
]; 