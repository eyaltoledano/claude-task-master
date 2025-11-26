/**
 * @fileoverview Styled Text component for Task Master TUI
 * Provides styled text with semantic color variants
 */

import React from 'react';
import { Text as InkText, type TextProps as InkTextProps } from 'ink';
import { colors, getStatusColor, getPriorityColor } from '../../theme/colors.js';

export type TextVariant =
	| 'default'
	| 'primary'
	| 'success'
	| 'warning'
	| 'error'
	| 'info'
	| 'dim'
	| 'muted';

export type TextWeight = 'normal' | 'bold' | 'dim';

export interface TextProps extends Omit<InkTextProps, 'color'> {
	/** Semantic color variant */
	variant?: TextVariant;
	/** Custom color (overrides variant) */
	color?: string;
	/** Text weight */
	weight?: TextWeight;
	/** Underline the text */
	underline?: boolean;
	/** Task status to color by */
	status?: string;
	/** Priority to color by */
	priority?: string;
}

/**
 * Get color from variant
 */
function getVariantColor(variant: TextVariant): string {
	switch (variant) {
		case 'primary':
			return colors.primary;
		case 'success':
			return colors.success;
		case 'warning':
			return colors.warning;
		case 'error':
			return colors.error;
		case 'info':
			return colors.info;
		case 'dim':
			return colors.textDim;
		case 'muted':
			return colors.textMuted;
		default:
			return colors.text;
	}
}

/**
 * Styled Text component matching the existing chalk patterns
 */
export function Text({
	children,
	variant = 'default',
	color,
	weight = 'normal',
	underline = false,
	status,
	priority,
	...props
}: TextProps): React.ReactElement {
	// Determine the color to use
	let textColor: string;
	if (color) {
		textColor = color;
	} else if (status) {
		textColor = getStatusColor(status);
	} else if (priority) {
		textColor = getPriorityColor(priority);
	} else {
		textColor = getVariantColor(variant);
	}

	return (
		<InkText
			color={textColor}
			bold={weight === 'bold'}
			dimColor={weight === 'dim'}
			underline={underline}
			{...props}
		>
			{children}
		</InkText>
	);
}

/**
 * Pre-styled text variants for convenience
 */
export const PrimaryText = (props: Omit<TextProps, 'variant'>) => (
	<Text variant="primary" {...props} />
);

export const SuccessText = (props: Omit<TextProps, 'variant'>) => (
	<Text variant="success" {...props} />
);

export const WarningText = (props: Omit<TextProps, 'variant'>) => (
	<Text variant="warning" {...props} />
);

export const ErrorText = (props: Omit<TextProps, 'variant'>) => (
	<Text variant="error" {...props} />
);

export const InfoText = (props: Omit<TextProps, 'variant'>) => (
	<Text variant="info" {...props} />
);

export const DimText = (props: Omit<TextProps, 'variant'>) => (
	<Text variant="dim" {...props} />
);

export const MutedText = (props: Omit<TextProps, 'variant'>) => (
	<Text variant="muted" {...props} />
);

export const BoldText = (props: Omit<TextProps, 'weight'>) => (
	<Text weight="bold" {...props} />
);

export const LinkText = (props: Omit<TextProps, 'underline' | 'variant'>) => (
	<Text variant="primary" underline {...props} />
);

