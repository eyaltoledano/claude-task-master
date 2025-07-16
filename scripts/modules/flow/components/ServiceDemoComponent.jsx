import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useServices } from '../shared/contexts/ServiceContext.jsx';

/**
 * Demo component showing how to use services from dependency injection
 * This demonstrates the clean, consistent naming pattern
 */
export function ServiceDemoComponent() {
	const { backend, logger, configManager, branchManager, hookManager } =
		useServices();

	const [taskCount, setTaskCount] = useState(0);
	const [currentBranch, setCurrentBranch] = useState('');
	const [config, setConfig] = useState(null);

	useEffect(() => {
		const loadData = async () => {
			try {
				// Use logger service
				logger.info('Loading demo data...');

				// Use backend service
				const tasks = await backend.getTasks();
				setTaskCount(tasks.length);

				// Use branch manager service
				const branchInfo = await branchManager.getCurrentBranchInfo();
				setCurrentBranch(branchInfo?.name || 'unknown');

				// Use config manager service
				const flowConfig = await configManager.loadConfig();
				setConfig(flowConfig);

				logger.success('Demo data loaded successfully');
			} catch (error) {
				logger.error('Failed to load demo data:', error);
			}
		};

		loadData();
	}, [backend, logger, configManager, branchManager]);

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>Service Demo Component</Text>
			<Text>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>

			<Box marginTop={1}>
				<Text>📊 Task Count: {taskCount}</Text>
			</Box>

			<Box marginTop={1}>
				<Text>🌿 Current Branch: {currentBranch}</Text>
			</Box>

			<Box marginTop={1}>
				<Text>⚙️ Config Loaded: {config ? '✅' : '❌'}</Text>
			</Box>

			<Box marginTop={1}>
				<Text>
					🔌 Hook Manager: {hookManager ? '✅ Available' : '❌ Not Available'}
				</Text>
			</Box>

			<Box marginTop={2}>
				<Text color="gray">
					This component demonstrates clean service usage with consistent
					naming. No more renaming like "backend: contextBackend"!
				</Text>
			</Box>
		</Box>
	);
}
