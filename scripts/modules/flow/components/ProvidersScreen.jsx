/**
 * @fileoverview Providers Screen Component
 *
 * Interactive provider management for the Flow TUI.
 * Integrates with existing Phase 7 provider management system.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { theme } from '../theme.js';

export function ProvidersScreen({ onBack, onError }) {
	const [providers, setProviders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [mode, setMode] = useState('list'); // 'list', 'test', 'capabilities', 'set'
	const [inputValue, setInputValue] = useState('');
	const [testResult, setTestResult] = useState(null);
	const [capabilities, setCapabilities] = useState(null);

	// Load providers on mount
	useEffect(() => {
		loadProviders();
	}, []);

	const loadProviders = async () => {
		try {
			setLoading(true);

			// Import provider registry
			const { availableProviders } = await import('../providers/registry.js');

			// Check which providers have API keys configured
			const providerList = await Promise.all(
				Object.entries(availableProviders).map(async ([key, provider]) => {
					try {
						// Check if API key is configured (basic check)
						const hasApiKey = checkApiKeyPresence(key);

						return {
							key,
							name: provider.name,
							description: provider.description,
							status: hasApiKey ? 'ready' : 'no-key',
							config: provider.config || {}
						};
					} catch (error) {
						return {
							key,
							name: provider.name || key,
							description:
								provider.description || 'Provider description not available',
							status: 'error',
							error: error.message
						};
					}
				})
			);

			setProviders(providerList);
		} catch (error) {
			onError?.(`Failed to load providers: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	// Check if API key environment variable exists for provider
	const checkApiKeyPresence = (providerKey) => {
		const envVars = {
			e2b: 'E2B_API_KEY',
			modal: 'MODAL_API_KEY',
			daytona: 'DAYTONA_API_KEY',
			fly: 'FLY_API_TOKEN',
			mock: null // Mock doesn't need API key
		};

		const envVar = envVars[providerKey];
		if (!envVar) return true; // Mock provider is always ready

		return process.env[envVar] && process.env[envVar] !== 'your_api_key_here';
	};

	// Test provider connectivity
	const testProvider = async (providerKey) => {
		try {
			setTestResult({ loading: true, provider: providerKey });

			// Use existing execution command infrastructure
			const { executionCommands } = await import(
				'../commands/execution.command.js'
			);

			// Call the existing test function but capture output
			let testOutput = '';
			const originalLog = console.log;
			const originalError = console.error;

			console.log = (...args) => {
				testOutput += args.join(' ') + '\n';
			};
			console.error = (...args) => {
				testOutput += args.join(' ') + '\n';
			};

			try {
				await executionCommands.provider({
					action: 'test',
					provider: providerKey,
					json: false
				});

				setTestResult({
					loading: false,
					provider: providerKey,
					success: true,
					message: testOutput.trim() || 'Provider test completed successfully'
				});
			} catch (error) {
				setTestResult({
					loading: false,
					provider: providerKey,
					success: false,
					message: error.message || testOutput.trim()
				});
			} finally {
				console.log = originalLog;
				console.error = originalError;
			}
		} catch (error) {
			setTestResult({
				loading: false,
				provider: providerKey,
				success: false,
				message: `Test failed: ${error.message}`
			});
		}
	};

	// Get provider capabilities
	const getCapabilities = async (providerKey) => {
		try {
			setCapabilities({ loading: true, provider: providerKey });

			const { executionCommands } = await import(
				'../commands/execution.command.js'
			);

			// Get capabilities using existing infrastructure
			let capOutput = '';
			const originalLog = console.log;
			console.log = (...args) => {
				capOutput += args.join(' ') + '\n';
			};

			try {
				await executionCommands.provider({
					action: 'capabilities',
					provider: providerKey,
					json: false
				});

				setCapabilities({
					loading: false,
					provider: providerKey,
					data: capOutput.trim()
				});
			} catch (error) {
				setCapabilities({
					loading: false,
					provider: providerKey,
					error: error.message
				});
			} finally {
				console.log = originalLog;
			}
		} catch (error) {
			setCapabilities({
				loading: false,
				provider: providerKey,
				error: error.message
			});
		}
	};

	// Set default provider
	const setDefaultProvider = async (providerKey) => {
		try {
			const { executionCommands } = await import(
				'../commands/execution.command.js'
			);

			await executionCommands.provider({
				action: 'set',
				provider: providerKey
			});

			// Reload providers to show updated status
			await loadProviders();
			setMode('list');
		} catch (error) {
			onError?.(`Failed to set default provider: ${error.message}`);
		}
	};

	// Handle keyboard input
	useInput((input, key) => {
		if (mode === 'list') {
			if (key.upArrow && selectedIndex > 0) {
				setSelectedIndex(selectedIndex - 1);
			} else if (key.downArrow && selectedIndex < providers.length - 1) {
				setSelectedIndex(selectedIndex + 1);
			} else if (key.return && providers[selectedIndex]) {
				// Show action menu for selected provider
				setMode('actions');
			} else if (input === 'r') {
				// Refresh providers
				loadProviders();
			} else if (input === 'q' || key.escape) {
				onBack?.();
			}
		} else if (mode === 'actions') {
			const provider = providers[selectedIndex];
			if (input === 't') {
				testProvider(provider.key);
				setMode('test');
			} else if (input === 'c') {
				getCapabilities(provider.key);
				setMode('capabilities');
			} else if (input === 's') {
				setDefaultProvider(provider.key);
			} else if (input === 'b' || key.escape) {
				setMode('list');
			}
		} else if (mode === 'test' || mode === 'capabilities') {
			if (input === 'b' || key.escape) {
				setMode('list');
				setTestResult(null);
				setCapabilities(null);
			}
		}
	});

	// Render provider status indicator
	const renderStatus = (provider) => {
		if (provider.status === 'ready') {
			return <Text color={theme.colors.success}>✅ Ready</Text>;
		} else if (provider.status === 'no-key') {
			return <Text color={theme.colors.warning}>⚠️ No API Key</Text>;
		} else {
			return <Text color={theme.colors.error}>❌ Error</Text>;
		}
	};

	if (loading) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color={theme.colors.accent}>Loading providers...</Text>
			</Box>
		);
	}

	// Render different modes
	if (mode === 'test' && testResult) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color={theme.colors.accent} bold>
					Testing Provider: {testResult.provider}
				</Text>
				<Box marginTop={1}>
					{testResult.loading ? (
						<Text color={theme.colors.muted}>Testing connectivity...</Text>
					) : (
						<Box flexDirection="column">
							<Text
								color={
									testResult.success ? theme.colors.success : theme.colors.error
								}
							>
								{testResult.success ? '✅ Test Passed' : '❌ Test Failed'}
							</Text>
							<Box marginTop={1}>
								<Text>{testResult.message}</Text>
							</Box>
						</Box>
					)}
				</Box>
				<Box marginTop={1}>
					<Text color={theme.colors.muted}>[b/Esc] Back to list</Text>
				</Box>
			</Box>
		);
	}

	if (mode === 'capabilities' && capabilities) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color={theme.colors.accent} bold>
					Capabilities: {capabilities.provider}
				</Text>
				<Box marginTop={1}>
					{capabilities.loading ? (
						<Text color={theme.colors.muted}>Loading capabilities...</Text>
					) : capabilities.error ? (
						<Text color={theme.colors.error}>Error: {capabilities.error}</Text>
					) : (
						<Box flexDirection="column">
							<Text>{capabilities.data}</Text>
						</Box>
					)}
				</Box>
				<Box marginTop={1}>
					<Text color={theme.colors.muted}>[b/Esc] Back to list</Text>
				</Box>
			</Box>
		);
	}

	if (mode === 'actions') {
		const provider = providers[selectedIndex];
		return (
			<Box flexDirection="column" padding={1}>
				<Text color={theme.colors.accent} bold>
					Actions for: {provider?.name}
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Text>[t] Test connectivity</Text>
					<Text>[c] View capabilities</Text>
					<Text>[s] Set as default provider</Text>
					<Text>[b/Esc] Back to list</Text>
				</Box>
			</Box>
		);
	}

	// Main provider list view
	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text color={theme.colors.accent} bold>
					Provider Management
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text color={theme.colors.muted}>
					Available Providers ({providers.length}):
				</Text>
			</Box>

			{providers.map((provider, index) => (
				<Box key={provider.key} marginBottom={1}>
					<Text
						color={
							index === selectedIndex ? theme.colors.accent : theme.colors.text
						}
					>
						{index === selectedIndex ? '▶ ' : '  '}
					</Text>
					<Box width={16}>
						<Text
							color={
								index === selectedIndex
									? theme.colors.accent
									: theme.colors.text
							}
							bold
						>
							{provider.name}
						</Text>
					</Box>
					<Box width={20} marginLeft={1}>
						{renderStatus(provider)}
					</Box>
					<Box marginLeft={1}>
						<Text color={theme.colors.muted}>{provider.description}</Text>
					</Box>
				</Box>
			))}

			<Box marginTop={1}>
				<Text color={theme.colors.muted}>
					[↑↓] Navigate | [Enter] Actions | [r] Refresh | [q/Esc] Back
				</Text>
			</Box>
		</Box>
	);
}
