/**
 * StatusBar.tsx - Bottom status bar for the shell
 *
 * Shows current context, shortcuts, and status information
 */
import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme/colors.js';

interface StatusBarProps {
	tag?: string;
	briefName?: string;
	storageType?: 'local' | 'api';
	version?: string;
	projectPath?: string;
}

export function StatusBar({
	tag = 'master',
	briefName,
	storageType = 'local',
	version = '0.35.0',
	projectPath,
}: StatusBarProps) {
	const termWidth = process.stdout.columns || 80;

	// Shortcuts
	const shortcuts = [
		{ key: '?', label: 'help' },
		{ key: 'ctrl+c', label: 'exit' },
		{ key: 'tab', label: 'autocomplete' },
	];

	return (
		<Box
			flexDirection="column"
			borderStyle="single"
			borderColor={colors.semantic.muted}
			borderTop={true}
			borderBottom={false}
			borderLeft={false}
			borderRight={false}
			paddingX={1}
		>
			<Box justifyContent="space-between">
				{/* Left side: Context */}
				<Box>
					<Text dimColor>
						{storageType === 'api' ? (
							<>
								<Text color={colors.accent.purple}>●</Text>
								{' Multiplayer'}
								{briefName && (
									<Text> · {briefName}</Text>
								)}
							</>
						) : (
							<>
								<Text color={colors.accent.green}>●</Text>
								{' Solo · '}
								<Text color={colors.accent.cyan}>{tag}</Text>
							</>
						)}
					</Text>
				</Box>

				{/* Center: Shortcuts */}
				<Box>
					{shortcuts.map((shortcut, i) => (
						<Text key={shortcut.key} dimColor>
							{i > 0 && '  '}
							<Text color={colors.accent.cyan}>{shortcut.key}</Text>
							{' '}
							{shortcut.label}
						</Text>
					))}
				</Box>

				{/* Right side: Version & Path */}
				<Box>
					<Text dimColor>
						v{version}
						{projectPath && (
							<Text> · {projectPath.length > 30 ? '...' + projectPath.slice(-27) : projectPath}</Text>
						)}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

export default StatusBar;

