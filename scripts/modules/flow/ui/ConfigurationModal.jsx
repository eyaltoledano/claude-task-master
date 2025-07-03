import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import {
	Alert,
	Badge,
	Select,
	TextInput,
	ConfirmInput,
	StatusMessage,
	Spinner
} from '@inkjs/ui';
import { useConfiguration } from './ConfigurationProvider.jsx';

const TabButton = ({ label, isActive, badgeText }) => (
	<Box
		paddingX={1}
		borderStyle={isActive ? 'double' : 'single'}
		borderColor={isActive ? 'cyan' : 'gray'}
	>
		<Text color={isActive ? 'cyan' : 'white'}>{label}</Text>
		{badgeText && <Badge color={isActive ? 'cyan' : 'gray'}>{badgeText}</Badge>}
	</Box>
);

const AutoMergeTab = () => {
	const { getConfigValue, updateConfig, hasError, getError } =
		useConfiguration();

	const mergeMethodOptions = [
		{ label: 'Squash and merge', value: 'squash' },
		{ label: 'Merge commit', value: 'merge' },
		{ label: 'Rebase and merge', value: 'rebase' }
	];

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>Auto-Merge Configuration</Text>

			<Box marginTop={1} flexDirection="column">
				<Text>Enable Auto-Merge:</Text>
				<Box marginTop={1}>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('autoMerge.enabled', true)}
						onCancel={() => updateConfig('autoMerge.enabled', false)}
					/>
					<Text color={getConfigValue('autoMerge.enabled') ? 'green' : 'red'}>
						{getConfigValue('autoMerge.enabled') ? 'Enabled' : 'Disabled'}
					</Text>
				</Box>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Merge Method:</Text>
				<Select
					options={mergeMethodOptions}
					defaultValue={getConfigValue('mergeMethod', 'squash')}
					onChange={(value) => updateConfig('mergeMethod', value)}
				/>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Strict Mode:</Text>
				<Box marginTop={1}>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('autoMerge.strictMode', true)}
						onCancel={() => updateConfig('autoMerge.strictMode', false)}
					/>
					<Text
						color={getConfigValue('autoMerge.strictMode') ? 'yellow' : 'green'}
					>
						{getConfigValue('autoMerge.strictMode') ? 'Strict' : 'Normal'}
					</Text>
				</Box>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Recent Activity Window:</Text>
				<TextInput
					placeholder="30 minutes ago"
					defaultValue={getConfigValue(
						'autoMerge.recentActivityWindow',
						'30 minutes ago'
					)}
					onSubmit={(value) =>
						updateConfig('autoMerge.recentActivityWindow', value)
					}
				/>
				{hasError('autoMerge.recentActivityWindow') && (
					<StatusMessage variant="error">
						{getError('autoMerge.recentActivityWindow')}
					</StatusMessage>
				)}
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Max Retries:</Text>
				<TextInput
					placeholder="3"
					defaultValue={String(getConfigValue('autoMerge.maxRetries', 3))}
					onSubmit={(value) =>
						updateConfig('autoMerge.maxRetries', parseInt(value))
					}
				/>
				{hasError('autoMerge.maxRetries') && (
					<StatusMessage variant="error">
						{getError('autoMerge.maxRetries')}
					</StatusMessage>
				)}
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Retry Delay (ms):</Text>
				<TextInput
					placeholder="60000"
					defaultValue={String(getConfigValue('autoMerge.retryDelay', 60000))}
					onSubmit={(value) =>
						updateConfig('autoMerge.retryDelay', parseInt(value))
					}
				/>
				{hasError('autoMerge.retryDelay') && (
					<StatusMessage variant="error">
						{getError('autoMerge.retryDelay')}
					</StatusMessage>
				)}
			</Box>
		</Box>
	);
};

const SafetyTab = () => {
	const { getConfigValue, updateConfig } = useConfiguration();

	const safetyModeOptions = [
		{ 
			label: 'Vibe Mode (Fast & Minimal)', 
			value: 'vibe',
			description: 'Skip most checks, fast iteration'
		},
		{ 
			label: 'Standard Mode (Balanced)', 
			value: 'standard',
			description: 'Basic safety checks, auto-create PRs'
		},
		{ 
			label: 'Strict Mode (Comprehensive)', 
			value: 'strict',
			description: 'All checks required, manual approval'
		}
	];

	const currentSafetyMode = getConfigValue('hooks.builtIn.claudeCodeStop.safetyMode', 'standard');
	const isVibeMode = currentSafetyMode === 'vibe';
	const isStrictMode = currentSafetyMode === 'strict';

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="cyan">Safety Mode Configuration</Text>
			
			<Box flexDirection="column" gap={1} marginLeft={2}>
				{safetyModeOptions.map((option) => (
					<Box key={option.value} flexDirection="row" alignItems="center">
						<Text color={currentSafetyMode === option.value ? 'green' : 'gray'}>
							{currentSafetyMode === option.value ? '●' : '○'} {option.label}
						</Text>
					</Box>
				))}
			</Box>

			<Box marginTop={1}>
				<Text dimColor>{safetyModeOptions.find(o => o.value === currentSafetyMode)?.description}</Text>
			</Box>

			<Box flexDirection="column" gap={1} marginTop={2}>
				<Text bold>Safety Checks</Text>
				<Box marginLeft={2} flexDirection="column">
					<Text color={isVibeMode ? 'red' : 'green'}>
						Git Status: {isVibeMode ? 'Disabled' : 'Enabled'}
					</Text>
					<Text color={isVibeMode ? 'red' : 'green'}>
						Linting: {isVibeMode ? 'Disabled' : 'Enabled'}
					</Text>
					<Text color={isVibeMode ? 'red' : 'green'}>
						Build: {isVibeMode ? 'Disabled' : 'Enabled'}
					</Text>
					<Text color={isStrictMode ? 'green' : 'yellow'}>
						Tests: {isStrictMode ? 'Required' : 'Optional'}
					</Text>
					<Text color={isVibeMode ? 'red' : 'green'}>
						Conflict Detection: {isVibeMode ? 'Disabled' : 'Enabled'}
					</Text>
				</Box>
			</Box>

			<Box flexDirection="column" gap={1} marginTop={2}>
				<Text bold>PR Creation</Text>
				<Box marginLeft={2} flexDirection="column">
					<Text color={isStrictMode ? 'yellow' : 'green'}>
						Auto-create PRs: {isStrictMode ? 'Manual Approval Required' : 'Enabled'}
					</Text>
				</Box>
			</Box>
		</Box>
	);
};

const NotificationTab = () => {
	const { getConfigValue, updateConfig } = useConfiguration();

	const notificationChannels = [
		{ 
			key: 'app', 
			label: 'In-App Notifications', 
			description: 'Show notifications in the TUI interface',
			icon: '📱'
		},
		{ 
			key: 'email', 
			label: 'Email Notifications', 
			description: 'Send notifications via email webhook',
			icon: '📧'
		},
		{ 
			key: 'slack', 
			label: 'Slack Notifications', 
			description: 'Send notifications to Slack channel',
			icon: '💬'
		},
		{ 
			key: 'telegram', 
			label: 'Telegram Notifications', 
			description: 'Send notifications via Telegram bot',
			icon: '✈️'
		},
		{ 
			key: 'sms', 
			label: 'SMS Notifications', 
			description: 'Send critical alerts via SMS',
			icon: '📱'
		}
	];

	const notificationEvents = [
		{ key: 'pr-created', label: 'PR Created', description: 'When a new PR is created' },
		{ key: 'pr-merged', label: 'PR Merged', description: 'When a PR is successfully merged' },
		{ key: 'checks-failed', label: 'Checks Failed', description: 'When PR checks fail' },
		{ key: 'session-completed', label: 'Session Completed', description: 'When Claude Code session completes' },
		{ key: 'error', label: 'Errors', description: 'When errors occur' },
		{ key: 'critical', label: 'Critical Alerts', description: 'Critical system alerts' }
	];

	const isNotificationsEnabled = getConfigValue('notifications.enabled', true);

	const getChannelEnabled = (channel) => {
		return getConfigValue(`notifications.channels.${channel}.enabled`, channel === 'app');
	};

	const getChannelEvents = (channel) => {
		return getConfigValue(`notifications.channels.${channel}.events`, []);
	};

	const toggleChannel = (channel) => {
		const currentState = getChannelEnabled(channel);
		updateConfig(`notifications.channels.${channel}.enabled`, !currentState);
	};

	const toggleChannelEvent = (channel, event) => {
		const currentEvents = getChannelEvents(channel);
		const hasEvent = currentEvents.includes(event);
		
		if (hasEvent) {
			const newEvents = currentEvents.filter(e => e !== event);
			updateConfig(`notifications.channels.${channel}.events`, newEvents);
		} else {
			const newEvents = [...currentEvents, event];
			updateConfig(`notifications.channels.${channel}.events`, newEvents);
		}
	};

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="cyan">Notification Configuration</Text>
			
			<Box flexDirection="row" alignItems="center" gap={2}>
				<Text>Global Notifications:</Text>
				<Text color={isNotificationsEnabled ? 'green' : 'red'}>
					{isNotificationsEnabled ? 'Enabled' : 'Disabled'}
				</Text>
			</Box>

			{isNotificationsEnabled && (
				<>
					<Box flexDirection="column" gap={1} marginTop={2}>
						<Text bold>Notification Channels</Text>
						{notificationChannels.map((channel) => {
							const isEnabled = getChannelEnabled(channel.key);
							const events = getChannelEvents(channel.key);
							
							return (
								<Box key={channel.key} flexDirection="column" marginLeft={2} gap={1}>
									<Box flexDirection="row" alignItems="center" gap={2}>
										<Text>{channel.icon}</Text>
										<Text color={isEnabled ? 'green' : 'gray'}>
											{isEnabled ? '●' : '○'} {channel.label}
										</Text>
									</Box>
									<Box marginLeft={4}>
										<Text dimColor wrap="wrap">{channel.description}</Text>
										{isEnabled && events.length > 0 && (
											<Text color="yellow">
												Events: {events.join(', ')}
											</Text>
										)}
										{isEnabled && events.length === 0 && (
											<Text color="red">No events configured</Text>
										)}
									</Box>
								</Box>
							);
						})}
					</Box>

					<Box flexDirection="column" gap={1} marginTop={2}>
						<Text bold>Escalation Rules</Text>
						<Box marginLeft={2} flexDirection="column">
							<Text color="green">✓ Immediate: In-app notifications</Text>
							<Text color="yellow">⏰ 5min delay: In-app + Slack</Text>
							<Text color="orange">⏰ 15min delay: In-app + Slack + Email</Text>
							<Text color="red">🚨 Critical: All enabled channels</Text>
						</Box>
					</Box>

					<Box flexDirection="column" gap={1} marginTop={2}>
						<Text bold>Configuration Status</Text>
						<Box marginLeft={2} flexDirection="column">
							{notificationChannels.map((channel) => {
								if (channel.key === 'app') return null; // Skip app channel
								
								const isEnabled = getChannelEnabled(channel.key);
								if (!isEnabled) return null;
								
								// Check for required environment variables
								const envVars = {
									email: ['EMAIL_WEBHOOK', 'EMAIL_RECIPIENT'],
									slack: ['SLACK_WEBHOOK'],
									telegram: ['TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID'],
									sms: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'SMS_RECIPIENT']
								};
								
								const requiredVars = envVars[channel.key] || [];
								const missingVars = requiredVars.filter(varName => !process.env[varName]);
								
								return (
									<Box key={channel.key} flexDirection="row" alignItems="center" gap={2}>
										<Text>{channel.icon}</Text>
										<Text color={missingVars.length === 0 ? 'green' : 'red'}>
											{channel.label}: {missingVars.length === 0 ? 'Configured' : `Missing: ${missingVars.join(', ')}`}
										</Text>
									</Box>
								);
							})}
						</Box>
					</Box>
				</>
			)}
		</Box>
	);
};

const RollbackTab = () => {
	const { getConfigValue, updateConfig } = useConfiguration();

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>Rollback Configuration</Text>

			<Box marginTop={1} flexDirection="column">
				<Text>Enable Rollback:</Text>
				<ConfirmInput
					message=""
					onConfirm={() => updateConfig('rollback.enabled', true)}
					onCancel={() => updateConfig('rollback.enabled', false)}
				/>
				<Text
					color={getConfigValue('rollback.enabled', true) ? 'green' : 'red'}
				>
					{getConfigValue('rollback.enabled', true) ? 'Enabled' : 'Disabled'}
				</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Create Incident Report:</Text>
				<ConfirmInput
					message=""
					onConfirm={() => updateConfig('rollback.createIncidentReport', true)}
					onCancel={() => updateConfig('rollback.createIncidentReport', false)}
				/>
				<Text
					color={
						getConfigValue('rollback.createIncidentReport', true)
							? 'green'
							: 'red'
					}
				>
					{getConfigValue('rollback.createIncidentReport', true)
						? 'Enabled'
						: 'Disabled'}
				</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Preserve Evidence:</Text>
				<ConfirmInput
					message=""
					onConfirm={() => updateConfig('rollback.preserveEvidence', true)}
					onCancel={() => updateConfig('rollback.preserveEvidence', false)}
				/>
				<Text
					color={
						getConfigValue('rollback.preserveEvidence', true) ? 'green' : 'red'
					}
				>
					{getConfigValue('rollback.preserveEvidence', true)
						? 'Enabled'
						: 'Disabled'}
				</Text>
			</Box>
		</Box>
	);
};

const ConfigurationModal = ({ onClose, onNotification }) => {
	const [activeTab, setActiveTab] = useState(0);
	const {
		loading,
		saving,
		hasChanges,
		saveConfiguration,
		resetConfiguration,
		validationErrors
	} = useConfiguration();

	const tabs = [
		{
			label: 'Auto-Merge',
			component: AutoMergeTab,
			badge: hasChanges ? 'Modified' : null
		},
		{ label: 'Safety', component: SafetyTab, badge: null },
		{ label: 'Notification', component: NotificationTab, badge: null },
		{ label: 'Rollback', component: RollbackTab, badge: null }
	];

	const ActiveTabComponent = tabs[activeTab].component;
	const hasValidationErrors = Object.keys(validationErrors).length > 0;

	useInput((input, key) => {
		if (key.escape) {
			onClose();
		}
		if (key.tab) {
			setActiveTab((prev) => (prev + 1) % tabs.length);
		}
		if (key.leftArrow) {
			setActiveTab((prev) => (prev > 0 ? prev - 1 : tabs.length - 1));
		}
		if (key.rightArrow) {
			setActiveTab((prev) => (prev < tabs.length - 1 ? prev + 1 : 0));
		}
		if (input === 's' && hasChanges && !hasValidationErrors) {
			handleSave();
		}
		if (input === 'r' && hasChanges) {
			handleReset();
		}
	});

	const handleSave = async () => {
		const success = await saveConfiguration();
		if (success) {
			onNotification('Configuration saved successfully');
		} else {
			onNotification('Failed to save configuration');
		}
	};

	const handleReset = () => {
		resetConfiguration();
		onNotification('Configuration reset to original values');
	};

	if (loading) {
		return (
			<Box justifyContent="center" alignItems="center" height={20}>
				<Spinner label="Loading configuration..." />
			</Box>
		);
	}

	return (
		<Box
			borderStyle="double"
			borderColor="cyan"
			padding={1}
			flexDirection="column"
			width="80%"
			height="80%"
		>
			<Alert variant="info">PR Auto-Merge Configuration</Alert>

			{/* Tab Navigation */}
			<Box marginTop={1}>
				{tabs.map((tab, index) => (
					<Box key={tab.label} marginRight={1}>
						<TabButton
							label={tab.label}
							isActive={index === activeTab}
							badgeText={tab.badge}
						/>
					</Box>
				))}
			</Box>

			{/* Tab Content */}
			<Box marginTop={1} flexGrow={1} overflow="hidden">
				<ActiveTabComponent />
			</Box>

			{/* Status and Actions */}
			<Box marginTop={1} flexDirection="column">
				{hasValidationErrors && (
					<StatusMessage variant="error">
						Please fix validation errors before saving
					</StatusMessage>
				)}

				{hasChanges && (
					<StatusMessage variant="warning">
						You have unsaved changes
					</StatusMessage>
				)}

				<Box marginTop={1} justifyContent="space-between">
					<Box>
						<Text dimColor>
							Tab: Switch tabs | s: Save | r: Reset | Esc: Close
						</Text>
					</Box>
					<Box>
						{saving && <Spinner label="Saving..." />}
						{hasChanges && !saving && (
							<Badge color={hasValidationErrors ? 'red' : 'yellow'}>
								{hasValidationErrors ? 'Errors' : 'Unsaved'}
							</Badge>
						)}
					</Box>
				</Box>
			</Box>
		</Box>
	);
};

export default ConfigurationModal;
