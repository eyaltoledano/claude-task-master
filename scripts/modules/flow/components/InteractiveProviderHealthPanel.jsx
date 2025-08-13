import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Select, StatusMessage, Badge, Spinner, ProgressBar } from '@inkjs/ui';
import { useProviders } from '../shared/hooks/useProviders.js';
import { useOptimizedData } from '../shared/hooks/useOptimizedData.js';
import { usePerformanceMonitor } from '../shared/hooks/useOptimizedData.js';
import { useComponentTheme } from '../shared/hooks/useTheme.jsx';

/**
 * ProviderHealthSummary component showing overall statistics
 */
const ProviderHealthSummary = ({ providers, theme }) => {
	const healthyCount = providers.filter((p) => p.health?.success).length;
	const unhealthyCount = providers.filter(
		(p) => p.health && !p.health.success
	).length;
	const unknownCount = providers.filter((p) => !p.health).length;

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold color={theme.colors?.accent || 'yellow'}>
				Provider Health Summary:
			</Text>
			<Box paddingLeft={1} flexDirection="row" marginTop={1}>
				<Box marginRight={2}>
					<Badge color="green">✓ Healthy: {healthyCount}</Badge>
				</Box>
				<Box marginRight={2}>
					<Badge color="red">✗ Unhealthy: {unhealthyCount}</Badge>
				</Box>
				<Box>
					<Badge color="gray">? Unknown: {unknownCount}</Badge>
				</Box>
			</Box>
		</Box>
	);
};

/**
 * ProviderDetailView component showing detailed provider information
 */
const ProviderDetailView = ({ provider, theme }) => {
	if (!provider) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color={theme.colors?.muted || 'gray'}>
					Select a provider to view details
				</Text>
			</Box>
		);
	}

	const formatCapabilities = (capabilities) => {
		if (!capabilities) return 'Not available';

		const features = [];
		if (capabilities.languages?.length > 0) {
			features.push(`Languages: ${capabilities.languages.join(', ')}`);
		}
		if (capabilities.features) {
			const featureList = Object.entries(capabilities.features)
				.filter(([_, enabled]) => enabled)
				.map(([feature, _]) => feature);
			if (featureList.length > 0) {
				features.push(`Features: ${featureList.join(', ')}`);
			}
		}
		return features.length > 0 ? features : ['No specific capabilities listed'];
	};

	return (
		<Box flexDirection="column" padding={1} height="100%">
			{/* Provider Header */}
			<Box marginBottom={1} flexDirection="column">
				<Box alignItems="center">
					<Text bold color={theme.colors?.primary || 'cyan'}>
						{provider.name}
					</Text>
					<Box marginLeft={2}>
						<Badge color={provider.isDefault ? 'green' : 'gray'}>
							{provider.isDefault ? 'Default' : 'Available'}
						</Badge>
					</Box>
				</Box>
				<Text color={theme.colors?.muted || 'gray'}>
					Type: {provider.type || 'Unknown'} • Key: {provider.key}
				</Text>
			</Box>

			{/* Health Status */}
			<Box marginBottom={1} flexDirection="column">
				<Text bold color={theme.colors?.accent || 'yellow'}>
					Health Status:
				</Text>
				<Box paddingLeft={1} marginTop={1}>
					{provider.health ? (
						<Box flexDirection="column">
							<Box alignItems="center">
								<StatusMessage
									variant={provider.health.success ? 'success' : 'error'}
								>
									{provider.health.success ? 'Healthy' : 'Unhealthy'}
								</StatusMessage>
								{provider.health.message && (
									<Text marginLeft={2} color={theme.colors?.text || 'white'}>
										{provider.health.message}
									</Text>
								)}
							</Box>
							{provider.lastHealthCheck && (
								<Text color={theme.colors?.muted || 'gray'} marginTop={1}>
									Last checked:{' '}
									{new Date(provider.lastHealthCheck).toLocaleString()}
								</Text>
							)}
						</Box>
					) : (
						<Text color={theme.colors?.warning || 'yellow'}>
							Health status unknown
						</Text>
					)}
				</Box>
			</Box>

			{/* Capabilities */}
			<Box marginBottom={1} flexDirection="column">
				<Text bold color={theme.colors?.accent || 'yellow'}>
					Capabilities:
				</Text>
				<Box paddingLeft={1} marginTop={1} flexDirection="column">
					{formatCapabilities(provider.capabilities).map(
						(capability, index) => (
							<Text
								key={capability || `capability-${index}`}
								color={theme.colors?.text || 'white'}
							>
								• {capability}
							</Text>
						)
					)}
				</Box>
			</Box>

			{/* Configuration */}
			<Box marginBottom={1} flexDirection="column">
				<Text bold color={theme.colors?.accent || 'yellow'}>
					Configuration:
				</Text>
				<Box paddingLeft={1} marginTop={1} flexDirection="column">
					{provider.config ? (
						Object.entries(provider.config).map(([key, value]) => (
							<Text key={key} color={theme.colors?.text || 'white'}>
								{key}:{' '}
								{typeof value === 'string' ? value : JSON.stringify(value)}
							</Text>
						))
					) : (
						<Text color={theme.colors?.muted || 'gray'}>
							No configuration available
						</Text>
					)}
				</Box>
			</Box>

			{/* Error Information */}
			{provider.health && !provider.health.success && provider.health.error && (
				<Box flexDirection="column">
					<Text bold color={theme.colors?.error || 'red'}>
						Error Details:
					</Text>
					<Box
						paddingLeft={1}
						marginTop={1}
						borderStyle="round"
						borderColor={theme.colors?.error || 'red'}
						padding={1}
					>
						<Text color={theme.colors?.error || 'red'}>
							{provider.health.error}
						</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};

/**
 * InteractiveProviderHealthPanel component with enhanced provider monitoring
 */
export function InteractiveProviderHealthPanel({ onBack }) {
	const [selectedProviderId, setSelectedProviderId] = useState(null);
	const [autoRefresh, setAutoRefresh] = useState(true);
	const { theme } = useComponentTheme('providerPanel');
	const { renderCount } = usePerformanceMonitor(
		'InteractiveProviderHealthPanel'
	);

	// Load providers with health checking
	const {
		providers,
		loading,
		healthCheckProgress,
		lastHealthCheck,
		error,
		refreshHealth,
		refetch
	} = useProviders({
		healthCheckInterval: autoRefresh ? 30000 : 0,
		enableAutoHealthCheck: autoRefresh,
		enableDetailedCapabilities: true
	});

	// Optimize provider data for display
	const optimizedProviders = useOptimizedData(providers, [providers]);

	// Prepare provider options for Select component
	const providerOptions = useMemo(() => {
		return optimizedProviders.map((provider) => ({
			label: `${provider.name} (${provider.key}) - ${
				provider.health?.success
					? '✓ Healthy'
					: provider.health
						? '✗ Unhealthy'
						: '? Unknown'
			}`,
			value: provider.key,
			provider: provider
		}));
	}, [optimizedProviders]);

	// Find selected provider
	const selectedProvider = useMemo(() => {
		return optimizedProviders.find(
			(provider) => provider.key === selectedProviderId
		);
	}, [optimizedProviders, selectedProviderId]);

	// Handle keyboard input
	useInput((input, key) => {
		if (key.escape) {
			onBack?.();
		} else if (input === 'r') {
			refreshHealth(); // Manual refresh all providers
		} else if (input === 'a') {
			setAutoRefresh(!autoRefresh);
		} else if (input === 's' && selectedProvider) {
			refreshHealth(selectedProvider.key); // Refresh single provider
		}
	});

	// Handle provider selection
	const handleProviderSelect = (selectedOption) => {
		setSelectedProviderId(selectedOption.value);
	};

	if (loading && providers.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box alignItems="center">
					<Spinner />
					<Text marginLeft={1}>Loading providers...</Text>
				</Box>
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<StatusMessage variant="error">
					Failed to load providers: {error}
				</StatusMessage>
				<Text marginTop={1} color={theme.colors?.muted || 'gray'}>
					Press 'r' to retry or ESC to go back
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" height="100%">
			{/* Header with status indicators */}
			<Box
				paddingX={1}
				paddingY={1}
				borderStyle="single"
				borderColor={theme.colors?.border || 'gray'}
			>
				<Text bold color={theme.colors?.primary || 'cyan'}>
					🏗️ Provider Health Monitor
				</Text>
				<Box marginLeft={2}>
					<Badge color={autoRefresh ? 'green' : 'gray'}>
						Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
					</Badge>
				</Box>
				<Box marginLeft={2}>
					<Text color={theme.colors?.muted || 'gray'}>
						Renders: {renderCount}
					</Text>
				</Box>
				{lastHealthCheck && (
					<Box marginLeft={2}>
						<Text color={theme.colors?.muted || 'gray'}>
							Last check: {new Date(lastHealthCheck).toLocaleTimeString()}
						</Text>
					</Box>
				)}
			</Box>

			{/* Health check progress */}
			{healthCheckProgress > 0 && healthCheckProgress < 100 && (
				<Box paddingX={1} paddingY={1}>
					<ProgressBar
						value={healthCheckProgress}
						label={`Health check progress: ${healthCheckProgress}%`}
					/>
				</Box>
			)}

			{/* Provider Summary */}
			<Box paddingX={1} paddingY={1}>
				<ProviderHealthSummary providers={optimizedProviders} theme={theme} />
			</Box>

			{/* Content Area - Split view */}
			<Box flexGrow={1} flexDirection="row">
				{/* Left Panel - Provider Selection */}
				<Box
					width="40%"
					flexDirection="column"
					borderRight
					borderColor={theme.colors?.border || 'gray'}
					paddingRight={1}
					paddingLeft={1}
				>
					<Text marginBottom={1} bold color={theme.colors?.accent || 'yellow'}>
						Select Provider:
					</Text>

					{providerOptions.length === 0 ? (
						<Text color={theme.colors?.muted || 'gray'}>
							No providers available
						</Text>
					) : (
						<Select options={providerOptions} onChange={handleProviderSelect} />
					)}
				</Box>

				{/* Right Panel - Provider Details */}
				<Box width="60%" paddingLeft={1}>
					<ProviderDetailView provider={selectedProvider} theme={theme} />
				</Box>
			</Box>

			{/* Footer with controls */}
			<Box
				paddingX={1}
				paddingY={1}
				borderStyle="single"
				borderTop
				borderColor={theme.colors?.border || 'gray'}
			>
				<Text color={theme.colors?.muted || 'gray'}>
					[r] Refresh All • [a] Toggle Auto-refresh • [s] Refresh Selected •
					[ESC] Back
				</Text>
			</Box>
		</Box>
	);
}
