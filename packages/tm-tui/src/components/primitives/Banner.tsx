/**
 * @fileoverview Task Master Banner component
 * Matches the figlet + gradient patterns from scripts/modules/ui.js
 */

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import { coolGradient, warmGradient, colors } from '../../theme/colors.js';
import { TMBox } from './Box.js';

export interface BannerProps {
	/** Title text for the banner */
	title?: string;
	/** Subtitle or tagline */
	subtitle?: string;
	/** Version number to display */
	version?: string;
	/** Project name to display */
	projectName?: string;
	/** Font for the banner (maps to ink-big-text) */
	font?: 'block' | 'simple' | 'chrome' | 'tiny' | 'huge';
	/** Gradient style */
	gradientStyle?: 'cool' | 'warm';
	/** Show creator credit */
	showCredit?: boolean;
	/** Compact mode (no ASCII art) */
	compact?: boolean;
}

/**
 * Task Master ASCII Banner Component
 * Replicates the figlet banner from displayBanner() in ui.js
 */
export function Banner({
	title = 'Task Master',
	subtitle,
	version,
	projectName,
	font = 'block',
	gradientStyle = 'cool',
	showCredit = true,
	compact = false
}: BannerProps): React.ReactElement {
	const gradient = gradientStyle === 'cool' ? coolGradient : warmGradient;
	const gradientColors = [gradient.start, gradient.middle, gradient.end];

	if (compact) {
		// Compact mode: just title + info box
		return (
			<Box flexDirection="column">
				<Gradient colors={gradientColors}>
					<Text bold>{`━━━ ${title.toUpperCase()} ━━━`}</Text>
				</Gradient>
				{showCredit && (
					<Text>
						<Text dimColor>by </Text>
						<Text color={colors.primary} underline>
							https://x.com/eyaltoledano
						</Text>
					</Text>
				)}
				{(version || projectName) && (
					<Box marginTop={1}>
						<TMBox
							variant="primary"
							padding={{ top: 0, bottom: 0, left: 1, right: 1 }}
						>
							<Text>
								{version && (
									<>
										<Text bold>Version:</Text>
										<Text> {version}   </Text>
									</>
								)}
								{projectName && (
									<>
										<Text bold>Project:</Text>
										<Text> {projectName}</Text>
									</>
								)}
							</Text>
						</TMBox>
					</Box>
				)}
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{/* ASCII Art Banner with gradient */}
			<Gradient colors={gradientColors}>
				<BigText text={title} font={font} />
			</Gradient>

			{/* Creator credit */}
			{showCredit && (
				<Text>
					<Text dimColor>by </Text>
					<Text color={colors.primary} underline>
						https://x.com/eyaltoledano
					</Text>
				</Text>
			)}

			{/* Version and Project info box */}
			{(version || projectName) && (
				<Box marginTop={1}>
					<TMBox
						variant="primary"
						padding={{ top: 0, bottom: 0, left: 1, right: 1 }}
					>
						<Text>
							{version && (
								<>
									<Text bold>Version:</Text>
									<Text> {version}   </Text>
								</>
							)}
							{projectName && (
								<>
									<Text bold>Project:</Text>
									<Text> {projectName}</Text>
								</>
							)}
						</Text>
					</TMBox>
				</Box>
			)}

			{/* Optional subtitle */}
			{subtitle && (
				<Box marginTop={1}>
					<TMBox variant="default" padding={1}>
						<Text bold>{subtitle}</Text>
					</TMBox>
				</Box>
			)}
		</Box>
	);
}

/**
 * Success banner (for init completion, etc.)
 * Matches the warm gradient "Success!" banner from init.js
 */
export function SuccessBanner({
	title = 'Success!',
	message
}: {
	title?: string;
	message?: string;
}): React.ReactElement {
	const gradient = warmGradient;
	const gradientColors = [gradient.start, gradient.middle, gradient.end];

	return (
		<Box flexDirection="column">
			<TMBox borderStyle="double" variant="success" padding={1} margin={1}>
				<Box flexDirection="column" alignItems="center">
					<Gradient colors={gradientColors}>
						<BigText text={title} font="chrome" />
					</Gradient>
					{message && (
						<Text color={colors.success}>{message}</Text>
					)}
				</Box>
			</TMBox>
		</Box>
	);
}

/**
 * Welcome banner for init
 */
export function WelcomeBanner({
	title = 'TaskMaster'
}: {
	title?: string;
}): React.ReactElement {
	const gradient = coolGradient;
	const gradientColors = [gradient.start, gradient.middle, gradient.end];

	return (
		<Box flexDirection="column">
			<Gradient colors={gradientColors}>
				<BigText text={title} font="block" />
			</Gradient>
			<Text>
				<Text dimColor>by </Text>
				<Text color={colors.primary} underline>
					https://x.com/eyaltoledano
				</Text>
			</Text>
			<Box marginTop={1}>
				<TMBox variant="primary" padding={1}>
					<Text bold>Welcome to Taskmaster</Text>
				</TMBox>
			</Box>
		</Box>
	);
}

