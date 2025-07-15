import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Alert, Badge, Select, StatusMessage, Spinner } from '@inkjs/ui';
import { useServices } from '../../contexts/ServiceContext.jsx';

const CleanupDashboard = ({ onBack }) => {
	// Get backend from dependency injection
	const { backend, logger } = useServices();
	
	const [stats, setStats] = useState(null);
	const [config, setConfig] = useState(null);
	const [recentCleanups, setRecentCleanups] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedTab, setSelectedTab] = useState(0);
	const [configMode, setConfigMode] = useState(false);

	const tabs = ['Overview', 'Recent Cleanups', 'Configuration'];

	useEffect(() => {
		loadCleanupData();
		const interval = setInterval(loadCleanupData, 10000); // Refresh every 10 seconds
		return () => clearInterval(interval);
	}, []);

	const loadCleanupData = async () => {
		try {
			const result = await backend.getCleanupConfiguration();
			if (result.success) {
				setStats(result.stats);
				setConfig(result.config);
				setRecentCleanups(result.stats.recentCleanups || []);
			} else {
				setError(result.error);
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	useInput((input, key) => {
		if (key.escape) {
			if (configMode) {
				setConfigMode(false);
			} else {
				onBack();
			}
		} else if (key.leftArrow && selectedTab > 0) {
			setSelectedTab(selectedTab - 1);
		} else if (key.rightArrow && selectedTab < tabs.length - 1) {
			setSelectedTab(selectedTab + 1);
		} else if (input === 'c' && selectedTab === 2) {
			setConfigMode(true);
		} else if (input === 'r') {
			loadCleanupData();
		}
	});

	if (loading) {
		return (
			<Box padding={1}>
				<Spinner label="Loading cleanup data..." />
			</Box>
		);
	}

	if (error) {
		return (
			<Box padding={1}>
				<Alert variant="error" title="Error">
					Failed to load cleanup data: {error}
				</Alert>
			</Box>
		);
	}

	const renderTabHeader = () => (
		<Box flexDirection="row" marginBottom={1}>
			{tabs.map((tab, index) => (
				<Box key={tab} marginRight={2}>
					<Text
						color={index === selectedTab ? 'cyan' : 'gray'}
						bold={index === selectedTab}
					>
						{index === selectedTab ? '▶ ' : '  '}
						{tab}
					</Text>
				</Box>
			))}
		</Box>
	);

	const renderOverview = () => (
		<Box flexDirection="column">
			<Text bold marginBottom={1}>
				🧹 Cleanup Service Overview
			</Text>

			{/* Statistics */}
			<Box flexDirection="column" marginBottom={2}>
				<Text bold color="cyan">
					Statistics:
				</Text>
				<Box flexDirection="row" marginTop={1}>
					<Box marginRight={4}>
						<Text>Worktrees Cleaned: </Text>
						<Text color="green" bold>
							{stats.worktreesCleanedUp}
						</Text>
					</Box>
					<Box marginRight={4}>
						<Text>Cache Entries Invalidated: </Text>
						<Text color="blue" bold>
							{stats.cacheEntriesInvalidated}
						</Text>
					</Box>
					<Box marginRight={4}>
						<Text>Tasks Updated: </Text>
						<Text color="yellow" bold>
							{stats.tasksUpdated}
						</Text>
					</Box>
				</Box>
				<Box flexDirection="row" marginTop={1}>
					<Box marginRight={4}>
						<Text>Errors: </Text>
						<Text color={stats.errors > 0 ? 'red' : 'green'} bold>
							{stats.errors}
						</Text>
					</Box>
					<Box marginRight={4}>
						<Text>Active Cleanups: </Text>
						<Text color="cyan" bold>
							{stats.activeCleanups}
						</Text>
					</Box>
					<Box>
						<Text>Last Cleanup: </Text>
						<Text color="gray">
							{stats.lastCleanup
								? new Date(stats.lastCleanup).toLocaleString()
								: 'Never'}
						</Text>
					</Box>
				</Box>
			</Box>

			{/* Service Status */}
			<Box flexDirection="column" marginBottom={2}>
				<Text bold color="cyan">
					Service Status:
				</Text>
				<Box flexDirection="row" marginTop={1}>
					<Box marginRight={4}>
						<Text>Worktree Cleanup: </Text>
						<Badge color={config.worktree.enabled ? 'green' : 'gray'}>
							{config.worktree.enabled ? 'Enabled' : 'Disabled'}
						</Badge>
					</Box>
					<Box marginRight={4}>
						<Text>AST Cache Refresh: </Text>
						<Badge color={config.astCache.enabled ? 'green' : 'gray'}>
							{config.astCache.enabled ? 'Enabled' : 'Disabled'}
						</Badge>
					</Box>
					<Box>
						<Text>Task Status Updates: </Text>
						<Badge color={config.taskStatus.enabled ? 'green' : 'gray'}>
							{config.taskStatus.enabled ? 'Enabled' : 'Disabled'}
						</Badge>
					</Box>
				</Box>
			</Box>

			{/* Quick Actions */}
			<Box flexDirection="column">
				<Text bold color="cyan">
					Quick Actions:
				</Text>
				<Text color="gray" marginTop={1}>
					• Press 'r' to refresh data
				</Text>
				<Text color="gray">• Use ← → to switch tabs</Text>
				<Text color="gray">
					• Press 'c' in Configuration tab to edit settings
				</Text>
				<Text color="gray">• Press ESC to go back</Text>
			</Box>
		</Box>
	);

	const renderRecentCleanups = () => (
		<Box flexDirection="column">
			<Text bold marginBottom={1}>
				📋 Recent Cleanup Operations
			</Text>

			{recentCleanups.length === 0 ? (
				<Text color="gray">No recent cleanup operations</Text>
			) : (
				<Box flexDirection="column">
					{recentCleanups.slice(0, 10).map((cleanup, index) => (
						<Box
							key={`cleanup-${cleanup.prNumber}-${cleanup.startTime}`}
							flexDirection="column"
							marginBottom={1}
							padding={1}
							borderStyle="single"
						>
							<Box flexDirection="row" marginBottom={1}>
								<Text bold color="cyan">
									PR #{cleanup.prNumber}
								</Text>
								<Text color="gray" marginLeft={2}>
									{new Date(cleanup.startTime).toLocaleString()}
								</Text>
								<Badge
									color={
										cleanup.status === 'completed'
											? 'green'
											: cleanup.status === 'failed'
												? 'red'
												: cleanup.status === 'completed-with-errors'
													? 'yellow'
													: 'blue'
									}
									marginLeft={2}
								>
									{cleanup.status}
								</Badge>
							</Box>

							{cleanup.duration && (
								<Text color="gray">
									Duration: {Math.round(cleanup.duration / 1000)}s
								</Text>
							)}

							{cleanup.results && (
								<Box flexDirection="column" marginTop={1}>
									{cleanup.results.worktree && (
										<Text color="green">
											🗑️ Worktree: {cleanup.results.worktree.actions.join(', ')}
										</Text>
									)}
									{cleanup.results.astCache && (
										<Text color="blue">
											🔄 AST Cache: {cleanup.results.astCache.invalidatedFiles}{' '}
											files invalidated
										</Text>
									)}
									{cleanup.results.taskStatus && (
										<Text color="yellow">
											✅ Task: {cleanup.results.taskStatus.actions.join(', ')}
										</Text>
									)}
									{cleanup.results.errors &&
										cleanup.results.errors.length > 0 && (
											<Text color="red">
												❌ Errors: {cleanup.results.errors.length} occurred
											</Text>
										)}
								</Box>
							)}
						</Box>
					))}
				</Box>
			)}
		</Box>
	);

	const renderConfiguration = () => (
		<Box flexDirection="column">
			<Text bold marginBottom={1}>
				⚙️ Cleanup Configuration
			</Text>

			{configMode ? (
				<ConfigurationEditor
					config={config}
					onSave={async (newConfig) => {
						const result = await backend.updateCleanupConfiguration(newConfig);
						if (result.success) {
							setConfig(result.config);
							setConfigMode(false);
							loadCleanupData(); // Refresh to get updated stats
						}
					}}
					onCancel={() => setConfigMode(false)}
				/>
			) : (
				<Box flexDirection="column">
					{/* Worktree Configuration */}
					<Box flexDirection="column" marginBottom={2}>
						<Text bold color="cyan">
							Worktree Cleanup:
						</Text>
						<Box flexDirection="row" marginTop={1}>
							<Text>Enabled: </Text>
							<Badge color={config.worktree.enabled ? 'green' : 'red'}>
								{config.worktree.enabled ? 'Yes' : 'No'}
							</Badge>
						</Box>
						<Box flexDirection="row" marginTop={1}>
							<Text>Preserve Uncommitted: </Text>
							<Badge
								color={config.worktree.preserveUncommitted ? 'green' : 'gray'}
							>
								{config.worktree.preserveUncommitted ? 'Yes' : 'No'}
							</Badge>
						</Box>
						<Box flexDirection="row" marginTop={1}>
							<Text>Backup Before Cleanup: </Text>
							<Badge
								color={config.worktree.backupBeforeCleanup ? 'green' : 'gray'}
							>
								{config.worktree.backupBeforeCleanup ? 'Yes' : 'No'}
							</Badge>
						</Box>
						<Box flexDirection="row" marginTop={1}>
							<Text>Delete Tracking Branch: </Text>
							<Badge
								color={config.worktree.deleteTrackingBranch ? 'green' : 'gray'}
							>
								{config.worktree.deleteTrackingBranch ? 'Yes' : 'No'}
							</Badge>
						</Box>
					</Box>

					{/* AST Cache Configuration */}
					<Box flexDirection="column" marginBottom={2}>
						<Text bold color="cyan">
							AST Cache Refresh:
						</Text>
						<Box flexDirection="row" marginTop={1}>
							<Text>Enabled: </Text>
							<Badge color={config.astCache.enabled ? 'green' : 'red'}>
								{config.astCache.enabled ? 'Yes' : 'No'}
							</Badge>
						</Box>
						<Box flexDirection="row" marginTop={1}>
							<Text>Incremental Refresh: </Text>
							<Badge
								color={config.astCache.incrementalRefresh ? 'green' : 'gray'}
							>
								{config.astCache.incrementalRefresh ? 'Yes' : 'No'}
							</Badge>
						</Box>
						<Box flexDirection="row" marginTop={1}>
							<Text>Batch Size: </Text>
							<Text color="yellow">{config.astCache.batchSize}</Text>
						</Box>
						<Box flexDirection="row" marginTop={1}>
							<Text>Max Concurrent Operations: </Text>
							<Text color="yellow">
								{config.astCache.maxConcurrentOperations}
							</Text>
						</Box>
					</Box>

					{/* Task Status Configuration */}
					<Box flexDirection="column" marginBottom={2}>
						<Text bold color="cyan">
							Task Status Updates:
						</Text>
						<Box flexDirection="row" marginTop={1}>
							<Text>Enabled: </Text>
							<Badge color={config.taskStatus.enabled ? 'green' : 'red'}>
								{config.taskStatus.enabled ? 'Yes' : 'No'}
							</Badge>
						</Box>
						<Box flexDirection="row" marginTop={1}>
							<Text>Update Metrics: </Text>
							<Badge color={config.taskStatus.updateMetrics ? 'green' : 'gray'}>
								{config.taskStatus.updateMetrics ? 'Yes' : 'No'}
							</Badge>
						</Box>
						<Box flexDirection="row" marginTop={1}>
							<Text>Add PR Reference: </Text>
							<Badge
								color={config.taskStatus.addPRReference ? 'green' : 'gray'}
							>
								{config.taskStatus.addPRReference ? 'Yes' : 'No'}
							</Badge>
						</Box>
					</Box>

					<Text color="gray" marginTop={1}>
						Press 'c' to edit configuration
					</Text>
				</Box>
			)}
		</Box>
	);

	return (
		<Box flexDirection="column" padding={1} borderStyle="round">
			<Text bold color="green" marginBottom={1}>
				🧹 Intelligent Cleanup Dashboard
			</Text>

			{renderTabHeader()}

			<Box marginTop={1}>
				{selectedTab === 0 && renderOverview()}
				{selectedTab === 1 && renderRecentCleanups()}
				{selectedTab === 2 && renderConfiguration()}
			</Box>
		</Box>
	);
};

const ConfigurationEditor = ({ config, onSave, onCancel }) => {
	const [editedConfig, setEditedConfig] = useState(
		JSON.parse(JSON.stringify(config))
	);
	const [selectedSection, setSelectedSection] = useState(0);
	const [selectedSetting, setSelectedSetting] = useState(0);

	const sections = ['worktree', 'astCache', 'taskStatus'];
	const sectionLabels = [
		'Worktree Cleanup',
		'AST Cache Refresh',
		'Task Status Updates'
	];

	useInput((input, key) => {
		if (key.escape) {
			onCancel();
		} else if (key.upArrow && selectedSetting > 0) {
			setSelectedSetting(selectedSetting - 1);
		} else if (key.downArrow) {
			const currentSection = sections[selectedSection];
			const maxSettings = Object.keys(editedConfig[currentSection]).length - 1;
			if (selectedSetting < maxSettings) {
				setSelectedSetting(selectedSetting + 1);
			}
		} else if (key.leftArrow && selectedSection > 0) {
			setSelectedSection(selectedSection - 1);
			setSelectedSetting(0);
		} else if (key.rightArrow && selectedSection < sections.length - 1) {
			setSelectedSection(selectedSection + 1);
			setSelectedSetting(0);
		} else if (key.return) {
			toggleCurrentSetting();
		} else if (input === 's') {
			onSave(editedConfig);
		}
	});

	const toggleCurrentSetting = () => {
		const currentSection = sections[selectedSection];
		const settingKeys = Object.keys(editedConfig[currentSection]);
		const currentSetting = settingKeys[selectedSetting];
		const currentValue = editedConfig[currentSection][currentSetting];

		if (typeof currentValue === 'boolean') {
			setEditedConfig((prev) => ({
				...prev,
				[currentSection]: {
					...prev[currentSection],
					[currentSetting]: !currentValue
				}
			}));
		}
	};

	const renderSection = (sectionName, sectionIndex) => {
		const isSelected = selectedSection === sectionIndex;
		const sectionConfig = editedConfig[sectionName];

		return (
			<Box key={sectionName} flexDirection="column" marginBottom={2}>
				<Text bold color={isSelected ? 'cyan' : 'white'}>
					{isSelected ? '▶ ' : '  '}
					{sectionLabels[sectionIndex]}
				</Text>

				{isSelected && (
					<Box flexDirection="column" marginLeft={2} marginTop={1}>
						{Object.entries(sectionConfig).map(([key, value], index) => (
							<Box key={key} flexDirection="row" marginBottom={1}>
								<Text color={selectedSetting === index ? 'yellow' : 'white'}>
									{selectedSetting === index ? '→ ' : '  '}
									{key}:
								</Text>
								<Text
									color={
										typeof value === 'boolean'
											? value
												? 'green'
												: 'red'
											: 'cyan'
									}
									marginLeft={1}
									bold={selectedSetting === index}
								>
									{typeof value === 'boolean'
										? value
											? 'Enabled'
											: 'Disabled'
										: String(value)}
								</Text>
							</Box>
						))}
					</Box>
				)}
			</Box>
		);
	};

	return (
		<Box flexDirection="column">
			<Text bold marginBottom={1}>
				✏️ Edit Configuration
			</Text>

			{sections.map((section, index) => renderSection(section, index))}

			<Box marginTop={2}>
				<Text color="gray">• Use ← → to switch sections</Text>
				<Text color="gray">• Use ↑ ↓ to navigate settings</Text>
				<Text color="gray">• Press ENTER to toggle boolean values</Text>
				<Text color="gray">• Press 's' to save changes</Text>
				<Text color="gray">• Press ESC to cancel</Text>
			</Box>
		</Box>
	);
};

export default CleanupDashboard;
