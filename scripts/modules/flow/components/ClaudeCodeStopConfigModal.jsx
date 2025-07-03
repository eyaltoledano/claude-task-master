import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { BaseModal } from './BaseModal.jsx';
import { useBaseModal } from '../hooks/modals/useBaseModal.js';
import { useComponentTheme } from '../hooks/useComponentTheme.js';

export default function ClaudeCodeStopConfigModal({ 
	backend, 
	onClose, 
	onSave 
}) {
	const [loading, setLoading] = useState(true);
	const [config, setConfig] = useState(null);
	const [selectedOption, setSelectedOption] = useState(0);
	const [error, setError] = useState(null);
	const theme = useComponentTheme('modal');

	// Configuration options
	const configOptions = [
		{
			key: 'enabled',
			label: 'Enable Claude Code Stop Hook',
			type: 'boolean',
			description: 'Automatically create PRs when Claude Code sessions complete'
		},
		{
			key: 'defaultSafetyMode',
			label: 'Default Safety Mode',
			type: 'select',
			options: [
				{ value: 'vibe', label: 'Vibe Mode - Fast, minimal checks' },
				{ value: 'standard', label: 'Standard Mode - Balanced safety checks' },
				{ value: 'strict', label: 'Strict Mode - Comprehensive checks, manual approval' }
			],
			description: 'Default safety mode for automatic PR creation'
		},
		{
			key: 'allowModeOverride',
			label: 'Allow Mode Override',
			type: 'boolean',
			description: 'Allow tasks to override the default safety mode'
		},
		{
			key: 'enableAutoCommit',
			label: 'Enable Auto Commit',
			type: 'boolean',
			description: 'Automatically commit changes before creating PR'
		},
		{
			key: 'enableAutoPR',
			label: 'Enable Auto PR Creation',
			type: 'boolean',
			description: 'Automatically create PRs (when safety checks pass)'
		}
	];

	// Load current configuration
	useEffect(() => {
		loadConfig();
	}, []);

	const loadConfig = async () => {
		setLoading(true);
		try {
			// Get current hook configuration
			const hookStatus = backend.hookIntegration?.getHookStatus();
			const claudeCodeStopConfig = hookStatus?.hooks?.['claude-code-stop'];

			if (claudeCodeStopConfig) {
				setConfig({
					enabled: claudeCodeStopConfig.enabled,
					defaultSafetyMode: claudeCodeStopConfig.config?.defaultSafetyMode || 'standard',
					allowModeOverride: claudeCodeStopConfig.config?.allowModeOverride !== false,
					enableAutoCommit: claudeCodeStopConfig.config?.enableAutoCommit !== false,
					enableAutoPR: claudeCodeStopConfig.config?.enableAutoPR !== false
				});
			} else {
				// Default configuration
				setConfig({
					enabled: true,
					defaultSafetyMode: 'standard',
					allowModeOverride: true,
					enableAutoCommit: true,
					enableAutoPR: true
				});
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		try {
			setLoading(true);

			// Update hook configuration
			if (backend.hookIntegration) {
				await backend.hookIntegration.setHookEnabled('claude-code-stop', config.enabled);
				
				// Update hook config (this would need to be implemented in HookIntegrationService)
				// For now, we'll just trigger the save callback
			}

			if (onSave) {
				await onSave(config);
			}

			onClose();
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const toggleBooleanOption = (key) => {
		setConfig(prev => ({
			...prev,
			[key]: !prev[key]
		}));
	};

	const cycleSelectOption = (key) => {
		const option = configOptions.find(opt => opt.key === key);
		if (option && option.options) {
			const currentIndex = option.options.findIndex(opt => opt.value === config[key]);
			const nextIndex = (currentIndex + 1) % option.options.length;
			setConfig(prev => ({
				...prev,
				[key]: option.options[nextIndex].value
			}));
		}
	};

	const handleKeyPress = (input, key) => {
		if (loading) return;

		if (key.escape) {
			onClose();
			return;
		}

		if (key.upArrow) {
			setSelectedOption(prev => Math.max(0, prev - 1));
		} else if (key.downArrow) {
			setSelectedOption(prev => Math.min(configOptions.length - 1, prev + 1));
		} else if (key.return || input === ' ') {
			const option = configOptions[selectedOption];
			if (option.type === 'boolean') {
				toggleBooleanOption(option.key);
			} else if (option.type === 'select') {
				cycleSelectOption(option.key);
			}
		} else if (input === 's' && !loading) {
			handleSave();
		}
	};

	const getModalProps = () => {
		const hints = ['ESC close'];
		if (!loading) {
			hints.unshift('s save');
			hints.unshift('↑↓ navigate', 'ENTER/SPACE toggle');
		}

		return {
			...useBaseModal({
				title: 'Claude Code Stop Configuration',
				onKeyPress: handleKeyPress,
				preset: error ? 'error' : 'default'
			}),
			footer: (
				<Box>
					<Text color={theme.muted}>
						{hints.join(' • ')}
					</Text>
				</Box>
			)
		};
	};

	if (loading) {
		return (
			<BaseModal {...getModalProps()}>
				<Box flexDirection="column" alignItems="center" justifyContent="center" height={10}>
					<Text color={theme.info}>Loading configuration...</Text>
				</Box>
			</BaseModal>
		);
	}

	if (error) {
		return (
			<BaseModal {...getModalProps()}>
				<Box flexDirection="column" alignItems="center" justifyContent="center" height={10}>
					<Text color="red">Error: {error}</Text>
				</Box>
			</BaseModal>
		);
	}

	return (
		<BaseModal {...getModalProps()}>
			<Box flexDirection="column" padding={1}>
				<Text bold color={theme.primary} marginBottom={1}>
					Claude Code Stop Hook Settings
				</Text>
				
				<Text color={theme.muted} marginBottom={2}>
					Configure automatic PR creation when Claude Code sessions complete
				</Text>

				{configOptions.map((option, index) => {
					const isSelected = index === selectedOption;
					const value = config[option.key];

					return (
						<Box key={option.key} marginBottom={1}>
							<Box>
								<Text 
									color={isSelected ? theme.accent : theme.text}
									backgroundColor={isSelected ? theme.selectionBg : undefined}
								>
									{isSelected ? '► ' : '  '}
									{option.label}: 
								</Text>
								
								{option.type === 'boolean' && (
									<Text 
										color={value ? theme.success : theme.error}
										bold={isSelected}
									>
										{' '}{value ? 'Enabled' : 'Disabled'}
									</Text>
								)}
								
								{option.type === 'select' && (
									<Text 
										color={theme.accent}
										bold={isSelected}
									>
										{' '}{option.options.find(opt => opt.value === value)?.label || value}
									</Text>
								)}
							</Box>
							
							{isSelected && (
								<Box marginLeft={2} marginTop={1}>
									<Text color={theme.muted} italic>
										{option.description}
									</Text>
								</Box>
							)}
						</Box>
					);
				})}

				<Box marginTop={2} paddingTop={1} borderTop borderColor={theme.border}>
					<Text bold color={theme.primary}>Safety Mode Details:</Text>
					<Box marginTop={1} flexDirection="column">
						<Text color={theme.muted}>• <Text color={theme.accent}>Vibe:</Text> Fast mode - minimal checks, just commit and create PR</Text>
						<Text color={theme.muted}>• <Text color={theme.accent}>Standard:</Text> Balanced mode - basic safety checks before PR creation</Text>
						<Text color={theme.muted}>• <Text color={theme.accent}>Strict:</Text> Safe mode - comprehensive checks, manual PR approval</Text>
					</Box>
				</Box>
			</Box>
		</BaseModal>
	);
} 