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
		<Box flexDirection="column" padding={1}>
			<Text bold>Safety Configuration</Text>

			{/* Safety Mode Selection */}
			<Box marginTop={1} flexDirection="column">
				<Text bold color="cyan">Safety Mode:</Text>
				<Box marginTop={1}>
					<Select
						options={safetyModeOptions}
						defaultValue={currentSafetyMode}
						onChange={(value) => updateConfig('hooks.builtIn.claudeCodeStop.safetyMode', value)}
					/>
				</Box>
				<Box marginTop={1}>
					<Text dimColor>
						{safetyModeOptions.find(opt => opt.value === currentSafetyMode)?.description || ''}
					</Text>
				</Box>
			</Box>

			{/* Basic Safety Checks */}
			<Box marginTop={2} flexDirection="column">
				<Text bold>Basic Safety Checks:</Text>
				
				<Box marginTop={1} flexDirection="column">
					<Text>Git Status Check:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.gitStatus', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.gitStatus', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.gitStatus', true) ? 'green' : 'red'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.gitStatus', true) ? 'Enabled' : 'Disabled'}
					</Text>
				</Box>

				<Box marginTop={1} flexDirection="column">
					<Text>Conflict Detection:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.conflictDetection', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.conflictDetection', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.conflictDetection', !isVibeMode) ? 'green' : 'red'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.conflictDetection', !isVibeMode) ? 'Enabled' : 'Disabled'}
					</Text>
					{isVibeMode && <Text dimColor>(Disabled in Vibe Mode)</Text>}
				</Box>
			</Box>

			{/* Build Validation */}
			<Box marginTop={2} flexDirection="column">
				<Text bold>Build Validation:</Text>
				
				<Box marginTop={1} flexDirection="column">
					<Text>Enable Build Checks:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.build', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.build', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.build', !isVibeMode) ? 'green' : 'red'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.build', !isVibeMode) ? 'Enabled' : 'Disabled'}
					</Text>
					{isVibeMode && <Text dimColor>(Disabled in Vibe Mode)</Text>}
				</Box>

				<Box marginTop={1} flexDirection="column">
					<Text>Build Timeout (seconds):</Text>
					<TextInput
						placeholder="120"
						defaultValue={String(getConfigValue('hooks.builtIn.claudeCodeStop.buildValidation.timeout', 120000) / 1000)}
						onSubmit={(value) => updateConfig('hooks.builtIn.claudeCodeStop.buildValidation.timeout', parseInt(value) * 1000)}
					/>
				</Box>

				<Box marginTop={1} flexDirection="column">
					<Text>Fail on Build Error:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.buildValidation.failOnError', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.buildValidation.failOnError', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.buildValidation.failOnError', isStrictMode) ? 'red' : 'yellow'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.buildValidation.failOnError', isStrictMode) ? 'Fail' : 'Warn'}
					</Text>
				</Box>
			</Box>

			{/* Lint Validation */}
			<Box marginTop={2} flexDirection="column">
				<Text bold>Lint Validation:</Text>
				
				<Box marginTop={1} flexDirection="column">
					<Text>Enable Linting Checks:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.linting', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.linting', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.linting', !isVibeMode) ? 'green' : 'red'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.linting', !isVibeMode) ? 'Enabled' : 'Disabled'}
					</Text>
					{isVibeMode && <Text dimColor>(Disabled in Vibe Mode)</Text>}
				</Box>

				<Box marginTop={1} flexDirection="column">
					<Text>Auto-fix Lint Issues:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.lintValidation.autoFix', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.lintValidation.autoFix', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.lintValidation.autoFix', false) ? 'green' : 'red'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.lintValidation.autoFix', false) ? 'Enabled' : 'Disabled'}
					</Text>
				</Box>

				<Box marginTop={1} flexDirection="column">
					<Text>Biome Enabled:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.lintValidation.tools.biome.enabled', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.lintValidation.tools.biome.enabled', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.lintValidation.tools.biome.enabled', true) ? 'green' : 'red'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.lintValidation.tools.biome.enabled', true) ? 'Enabled' : 'Disabled'}
					</Text>
				</Box>

				<Box marginTop={1} flexDirection="column">
					<Text>ESLint Enabled:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.lintValidation.tools.eslint.enabled', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.lintValidation.tools.eslint.enabled', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.lintValidation.tools.eslint.enabled', true) ? 'green' : 'red'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.lintValidation.tools.eslint.enabled', true) ? 'Enabled' : 'Disabled'}
					</Text>
				</Box>
			</Box>

			{/* Test Validation */}
			<Box marginTop={2} flexDirection="column">
				<Text bold>Test Validation:</Text>
				
				<Box marginTop={1} flexDirection="column">
					<Text>Require Tests:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.tests', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.safetyChecks.tests', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.tests', isStrictMode) ? 'green' : 'red'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.safetyChecks.tests', isStrictMode) ? 'Required' : 'Optional'}
					</Text>
					{!isStrictMode && <Text dimColor>(Only required in Strict Mode)</Text>}
				</Box>
			</Box>

			{/* PR Creation */}
			<Box marginTop={2} flexDirection="column">
				<Text bold>PR Creation:</Text>
				
				<Box marginTop={1} flexDirection="column">
					<Text>Auto-create PR:</Text>
					<ConfirmInput
						message=""
						onConfirm={() => updateConfig('hooks.builtIn.claudeCodeStop.autoCreatePR', true)}
						onCancel={() => updateConfig('hooks.builtIn.claudeCodeStop.autoCreatePR', false)}
					/>
					<Text color={getConfigValue('hooks.builtIn.claudeCodeStop.autoCreatePR', !isStrictMode) ? 'green' : 'red'}>
						{getConfigValue('hooks.builtIn.claudeCodeStop.autoCreatePR', !isStrictMode) ? 'Enabled' : 'Disabled'}
					</Text>
					{isStrictMode && <Text dimColor>(Disabled in Strict Mode - manual approval required)</Text>}
				</Box>
			</Box>

			{/* Mode Summary */}
			<Box marginTop={2} flexDirection="column">
				<Text bold color="cyan">Current Mode Summary:</Text>
				<Box marginTop={1}>
					{currentSafetyMode === 'vibe' && (
						<Box flexDirection="column">
							<Text color="green">✓ Git status check</Text>
							<Text color="red">✗ Build validation</Text>
							<Text color="red">✗ Lint validation</Text>
							<Text color="red">✗ Test requirements</Text>
							<Text color="red">✗ Conflict detection</Text>
							<Text color="green">✓ Auto-create PR</Text>
						</Box>
					)}
					{currentSafetyMode === 'standard' && (
						<Box flexDirection="column">
							<Text color="green">✓ Git status check</Text>
							<Text color="green">✓ Build validation</Text>
							<Text color="green">✓ Lint validation</Text>
							<Text color="yellow">○ Test requirements (optional)</Text>
							<Text color="green">✓ Conflict detection</Text>
							<Text color="green">✓ Auto-create PR</Text>
						</Box>
					)}
					{currentSafetyMode === 'strict' && (
						<Box flexDirection="column">
							<Text color="green">✓ Git status check</Text>
							<Text color="green">✓ Build validation</Text>
							<Text color="green">✓ Lint validation</Text>
							<Text color="green">✓ Test requirements</Text>
							<Text color="green">✓ Conflict detection</Text>
							<Text color="yellow">○ Manual PR approval</Text>
						</Box>
					)}
				</Box>
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
