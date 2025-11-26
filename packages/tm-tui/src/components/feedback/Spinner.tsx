/**
 * @fileoverview Spinner/Loading components for Task Master TUI
 * Matches the ora patterns from scripts/modules/ui.js
 */

import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { colors } from '../../theme/colors.js';
import { progressIcons, logIcons } from '../../theme/icons.js';

export type SpinnerType = 'dots' | 'line' | 'circle' | 'bar';

export interface SpinnerProps {
	/** Loading message */
	message?: string;
	/** Spinner type/style */
	type?: SpinnerType;
	/** Spinner color */
	color?: string;
	/** Show spinner (when false, shows nothing) */
	isLoading?: boolean;
}

export interface LoadingIndicatorProps extends SpinnerProps {
	/** Current status: 'loading' | 'success' | 'error' */
	status?: 'loading' | 'success' | 'error';
	/** Success message (shown when status is 'success') */
	successMessage?: string;
	/** Error message (shown when status is 'error') */
	errorMessage?: string;
}

/**
 * Simple spinner component
 */
export function Spinner({
	message,
	type = 'dots',
	color = colors.primary,
	isLoading = true
}: SpinnerProps): React.ReactElement | null {
	if (!isLoading) return null;

	return (
		<Box>
			<Text color={color}>
				<InkSpinner type={type} />
			</Text>
			{message && (
				<>
					<Text> </Text>
					<Text>{message}</Text>
				</>
			)}
		</Box>
	);
}

/**
 * Loading indicator with success/error states
 * Matches the ora spinner patterns from ui.js
 */
export function LoadingIndicator({
	message,
	status = 'loading',
	successMessage,
	errorMessage,
	type = 'dots',
	color = colors.primary
}: LoadingIndicatorProps): React.ReactElement {
	if (status === 'success') {
		return (
			<Box>
				<Text color={colors.success}>{logIcons.success}</Text>
				<Text> </Text>
				<Text color={colors.success}>{successMessage || message}</Text>
			</Box>
		);
	}

	if (status === 'error') {
		return (
			<Box>
				<Text color={colors.error}>{logIcons.error}</Text>
				<Text> </Text>
				<Text color={colors.error}>{errorMessage || message}</Text>
			</Box>
		);
	}

	return (
		<Box>
			<Text color={color}>
				<InkSpinner type={type} />
			</Text>
			<Text> </Text>
			<Text>{message}</Text>
		</Box>
	);
}

/**
 * Progress bar component
 * Matches createProgressBar from ui.js
 */
export interface ProgressBarProps {
	/** Current progress (0-100) */
	progress: number;
	/** Bar width in characters */
	width?: number;
	/** Show percentage label */
	showLabel?: boolean;
	/** Color for filled portion */
	color?: string;
	/** Color for empty portion */
	emptyColor?: string;
	/** Custom label format */
	labelFormat?: (progress: number) => string;
}

export function ProgressBar({
	progress,
	width = 40,
	showLabel = true,
	color = colors.primary,
	emptyColor = colors.textMuted,
	labelFormat = (p) => `${Math.round(p)}%`
}: ProgressBarProps): React.ReactElement {
	const clampedProgress = Math.max(0, Math.min(100, progress));
	const filled = Math.round((clampedProgress / 100) * width);
	const empty = width - filled;

	const filledBar = '█'.repeat(filled);
	const emptyBar = '░'.repeat(empty);

	return (
		<Box>
			<Text color={color}>{filledBar}</Text>
			<Text color={emptyColor}>{emptyBar}</Text>
			{showLabel && (
				<>
					<Text> </Text>
					<Text>{labelFormat(clampedProgress)}</Text>
				</>
			)}
		</Box>
	);
}

/**
 * Multi-step progress indicator
 */
export interface StepIndicatorProps {
	/** Step definitions */
	steps: Array<{
		label: string;
		status: 'pending' | 'loading' | 'complete' | 'error';
	}>;
	/** Current step index */
	currentStep?: number;
	/** Compact mode */
	compact?: boolean;
}

export function StepIndicator({
	steps,
	currentStep,
	compact = false
}: StepIndicatorProps): React.ReactElement {
	const getStepIcon = (status: string): React.ReactNode => {
		switch (status) {
			case 'complete':
				return <Text color={colors.success}>{logIcons.success}</Text>;
			case 'error':
				return <Text color={colors.error}>{logIcons.error}</Text>;
			case 'loading':
				return (
					<Text color={colors.primary}>
						<InkSpinner type="dots" />
					</Text>
				);
			default:
				return <Text color={colors.textDim}>○</Text>;
		}
	};

	const getStepColor = (status: string): string => {
		switch (status) {
			case 'complete':
				return colors.success;
			case 'error':
				return colors.error;
			case 'loading':
				return colors.primary;
			default:
				return colors.textDim;
		}
	};

	if (compact) {
		return (
			<Box>
				{steps.map((step, i) => (
					<React.Fragment key={i}>
						{getStepIcon(step.status)}
						{i < steps.length - 1 && (
							<Text color={colors.textDim}> → </Text>
						)}
					</React.Fragment>
				))}
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{steps.map((step, i) => (
				<Box key={i}>
					{getStepIcon(step.status)}
					<Text> </Text>
					<Text color={getStepColor(step.status)}>{step.label}</Text>
				</Box>
			))}
		</Box>
	);
}

/**
 * Task progress summary
 */
export interface TaskProgressProps {
	done: number;
	inProgress: number;
	pending: number;
	total: number;
	showBar?: boolean;
}

export function TaskProgress({
	done,
	inProgress,
	pending,
	total,
	showBar = true
}: TaskProgressProps): React.ReactElement {
	const percentage = total > 0 ? (done / total) * 100 : 0;

	return (
		<Box flexDirection="column">
			{showBar && <ProgressBar progress={percentage} color={colors.success} />}
			<Box marginTop={showBar ? 1 : 0}>
				<Text color={colors.success}>{done} done</Text>
				<Text color={colors.textDim}> • </Text>
				<Text color={colors.info}>{inProgress} in progress</Text>
				<Text color={colors.textDim}> • </Text>
				<Text color={colors.warning}>{pending} pending</Text>
				<Text color={colors.textDim}> • </Text>
				<Text>{total} total</Text>
			</Box>
		</Box>
	);
}

