/**
 * Splash.tsx - Dramatic loading splash screen
 *
 * Shows an immersive splash while Task Master initializes
 */
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colors, coolGradient } from '../../theme/colors.js';
import { icons } from '../../theme/icons.js';

// ASCII art for Task Master - matches figlet "ANSI Shadow" style
const TASK_MASTER_ASCII = `
████████╗ █████╗ ███████╗██╗  ██╗    ███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗ 
╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝    ████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
   ██║   ███████║███████╗█████╔╝     ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝
   ██║   ██╔══██║╚════██║██╔═██╗     ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
   ██║   ██║  ██║███████║██║  ██╗    ██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║
   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
`.trim();

// Smaller version for narrower terminals
const TASK_MASTER_ASCII_SMALL = `
╔╦╗╔═╗╔═╗╦╔═  ╔╦╗╔═╗╔═╗╔╦╗╔═╗╦═╗
 ║ ╠═╣╚═╗╠╩╗  ║║║╠═╣╚═╗ ║ ║╣ ╠╦╝
 ╩ ╩ ╩╚═╝╩ ╩  ╩ ╩╩ ╩╚═╝ ╩ ╚═╝╩╚═
`.trim();

interface SplashProps {
	version?: string;
	onComplete?: () => void;
	duration?: number; // ms before auto-complete
}

const loadingSteps = [
	{ text: 'Initializing Task Master', icon: icons.progress.dots[0] },
	{ text: 'Loading configuration', icon: icons.progress.dots[1] },
	{ text: 'Connecting to services', icon: icons.progress.dots[2] },
	{ text: 'Preparing workspace', icon: icons.progress.dots[3] },
	{ text: 'Ready', icon: icons.status.done },
];

export function Splash({
	version = '0.35.0',
	onComplete,
	duration = 1500,
}: SplashProps) {
	const [stepIndex, setStepIndex] = useState(0);
	const [gradientOffset, setGradientOffset] = useState(0);
	const [showSubtitle, setShowSubtitle] = useState(false);

	// Animate through loading steps
	useEffect(() => {
		const stepDuration = duration / loadingSteps.length;
		const interval = setInterval(() => {
			setStepIndex((prev) => {
				if (prev >= loadingSteps.length - 1) {
					clearInterval(interval);
					setTimeout(() => onComplete?.(), 300);
					return prev;
				}
				return prev + 1;
			});
		}, stepDuration);

		return () => clearInterval(interval);
	}, [duration, onComplete]);

	// Animate gradient
	useEffect(() => {
		const interval = setInterval(() => {
			setGradientOffset((prev) => (prev + 1) % 100);
		}, 50);
		return () => clearInterval(interval);
	}, []);

	// Show subtitle after a brief delay
	useEffect(() => {
		const timeout = setTimeout(() => setShowSubtitle(true), 200);
		return () => clearTimeout(timeout);
	}, []);

	// Get terminal width to choose ASCII art size
	const termWidth = process.stdout.columns || 80;
	const asciiArt = termWidth >= 100 ? TASK_MASTER_ASCII : TASK_MASTER_ASCII_SMALL;

	// Apply gradient to ASCII art
	const gradientColors = coolGradient;
	const lines = asciiArt.split('\n');

	return (
		<Box
			flexDirection="column"
			alignItems="center"
			justifyContent="center"
			paddingY={2}
		>
			{/* ASCII Banner with gradient effect */}
			<Box flexDirection="column" alignItems="center">
				{lines.map((line, i) => {
					const colorIndex = (i + gradientOffset) % gradientColors.length;
					return (
						<Text key={i} color={gradientColors[colorIndex]}>
							{line}
						</Text>
					);
				})}
			</Box>

			{/* Subtitle */}
			{showSubtitle && (
				<Box marginTop={1} flexDirection="column" alignItems="center">
					<Text dimColor>
						AI-Powered Development Task Management
					</Text>
					<Text dimColor>
						by{' '}
						<Text color={colors.accent.cyan} underline>
							https://x.com/eyaltoledano
						</Text>
					</Text>
				</Box>
			)}

			{/* Version badge */}
			<Box marginTop={1}>
				<Text color={colors.semantic.muted}>v{version}</Text>
			</Box>

			{/* Loading indicator */}
			<Box
				marginTop={2}
				paddingX={4}
				paddingY={1}
				borderStyle="round"
				borderColor={colors.accent.cyan}
			>
				<Text color={stepIndex >= loadingSteps.length - 1 ? colors.semantic.success : colors.accent.cyan}>
					{loadingSteps[stepIndex].icon}{' '}
					{loadingSteps[stepIndex].text}
					{stepIndex < loadingSteps.length - 1 && '...'}
				</Text>
			</Box>

			{/* Progress dots */}
			<Box marginTop={1}>
				{loadingSteps.map((_, i) => (
					<Text
						key={i}
						color={
							i <= stepIndex
								? colors.accent.cyan
								: colors.semantic.muted
						}
					>
						{i <= stepIndex ? '●' : '○'}{' '}
					</Text>
				))}
			</Box>
		</Box>
	);
}

export default Splash;

