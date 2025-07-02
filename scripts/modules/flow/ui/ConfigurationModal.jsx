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

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>Safety Configuration</Text>

			<Box marginTop={1} flexDirection="column">
				<Text>Validate PR State:</Text>
				<ConfirmInput
					message=""
					onConfirm={() =>
						updateConfig('autoMerge.safetyChecks.validatePRState', true)
					}
					onCancel={() =>
						updateConfig('autoMerge.safetyChecks.validatePRState', false)
					}
				/>
				<Text
					color={
						getConfigValue('autoMerge.safetyChecks.validatePRState', true)
							? 'green'
							: 'red'
					}
				>
					{getConfigValue('autoMerge.safetyChecks.validatePRState', true)
						? 'Enabled'
						: 'Disabled'}
				</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Validate Required Checks:</Text>
				<ConfirmInput
					message=""
					onConfirm={() =>
						updateConfig('autoMerge.safetyChecks.validateRequiredChecks', true)
					}
					onCancel={() =>
						updateConfig('autoMerge.safetyChecks.validateRequiredChecks', false)
					}
				/>
				<Text
					color={
						getConfigValue(
							'autoMerge.safetyChecks.validateRequiredChecks',
							true
						)
							? 'green'
							: 'red'
					}
				>
					{getConfigValue('autoMerge.safetyChecks.validateRequiredChecks', true)
						? 'Enabled'
						: 'Disabled'}
				</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Validate No Conflicts:</Text>
				<ConfirmInput
					message=""
					onConfirm={() =>
						updateConfig('autoMerge.safetyChecks.validateNoConflicts', true)
					}
					onCancel={() =>
						updateConfig('autoMerge.safetyChecks.validateNoConflicts', false)
					}
				/>
				<Text
					color={
						getConfigValue('autoMerge.safetyChecks.validateNoConflicts', true)
							? 'green'
							: 'red'
					}
				>
					{getConfigValue('autoMerge.safetyChecks.validateNoConflicts', true)
						? 'Enabled'
						: 'Disabled'}
				</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text>Validate Recent Activity:</Text>
				<ConfirmInput
					message=""
					onConfirm={() =>
						updateConfig('autoMerge.safetyChecks.validateRecentActivity', true)
					}
					onCancel={() =>
						updateConfig('autoMerge.safetyChecks.validateRecentActivity', false)
					}
				/>
				<Text
					color={
						getConfigValue(
							'autoMerge.safetyChecks.validateRecentActivity',
							true
						)
							? 'green'
							: 'red'
					}
				>
					{getConfigValue('autoMerge.safetyChecks.validateRecentActivity', true)
						? 'Enabled'
						: 'Disabled'}
				</Text>
			</Box>
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
