/**
 * Header.tsx - Top header bar with branding and context
 *
 * Shows Task Master logo, version, and current context
 */
import React from 'react';
import { Box, Text } from 'ink';
import { colors, coolGradient } from '../../theme/colors.js';

// Mini ASCII logo
const LOGO_MINI = '═══ TASK MASTER ═══';

interface HeaderProps {
	version?: string;
	tag?: string;
	briefName?: string;
	briefId?: string;
	storageType?: 'local' | 'api';
	showLogo?: boolean;
}

export function Header({
	version = '0.35.0',
	tag = 'master',
	briefName,
	briefId,
	storageType = 'local',
	showLogo = true,
}: HeaderProps) {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={colors.accent.cyan}
			paddingX={2}
			paddingY={1}
			marginBottom={1}
		>
			{/* Top row: Logo + Version + Storage Mode */}
			<Box justifyContent="space-between" alignItems="center">
				{/* Logo */}
				{showLogo && (
					<Box>
						<Text bold color={colors.accent.cyan}>
							{LOGO_MINI}
						</Text>
					</Box>
				)}

				{/* Center: Storage mode indicator */}
				<Box>
					{storageType === 'api' ? (
						<Box>
							<Text color={colors.accent.purple}>●</Text>
							<Text bold color={colors.accent.purple}> Multiplayer</Text>
							<Text dimColor> (Hamster Studio)</Text>
						</Box>
					) : (
						<Box>
							<Text color={colors.accent.green}>●</Text>
							<Text bold color={colors.accent.green}> Solo</Text>
							<Text dimColor> (Local)</Text>
						</Box>
					)}
				</Box>

				{/* Right: Version */}
				<Box>
					<Text dimColor>v{version}</Text>
				</Box>
			</Box>

			{/* Context row */}
			<Box marginTop={1} justifyContent="center">
				{briefName ? (
					<Text>
						<Text color={colors.accent.yellow}>🏷</Text>
						{'  '}
						<Text bold>Brief:</Text>{' '}
						<Text color={colors.accent.cyan}>{briefName}</Text>
						{briefId && (
							<Text dimColor> ({briefId})</Text>
						)}
					</Text>
				) : (
					<Text>
						<Text color={colors.accent.yellow}>🏷</Text>
						{'  '}
						<Text bold>Tag:</Text>{' '}
						<Text color={colors.accent.cyan}>{tag}</Text>
					</Text>
				)}
			</Box>
		</Box>
	);
}

export default Header;

