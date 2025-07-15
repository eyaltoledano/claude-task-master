import React from 'react';
import { Box, Text } from 'ink';
import { useBaseModal } from '../../../shared/hooks/modals/useBaseModal.js';

/**
 * BaseModal component providing standardized modal layout and behavior
 * @param {Object} props
 * @param {React.ReactNode} props.children - Modal content
 * @param {Function} props.onClose - Close callback
 * @param {string} props.title - Modal title
 * @param {string|number} props.width - Modal width (default: '80%')
 * @param {string|number} props.height - Modal height (default: 'auto')
 * @param {string} props.preset - Theme preset: 'default', 'error', 'warning', 'info', 'success'
 * @param {boolean} props.showCloseHint - Show ESC close hint (default: true)
 * @param {boolean} props.autoFocus - Enable auto focus management (default: true)

 * @param {string} props.borderColor - Override border color
 * @param {React.ReactNode} props.footer - Optional footer content
 */
export function BaseModal({
	children,
	onClose,
	title,
	width = '80%',
	height = 'auto',
	preset = 'default',
	showCloseHint = true,
	autoFocus = true,
	borderColor,
	footer
}) {
	const { modalProps, theme, baseTheme, isNarrow, handleClose } = useBaseModal({
		onClose,
		title,
		width,
		height,
		preset,
		showCloseHint,
		autoFocus
	});

	// Override border color if provided
	const finalModalProps = {
		...modalProps,
		borderColor: borderColor || modalProps.borderColor
	};

	return (
		<Box
			flexDirection="column"
			justifyContent="center"
			alignItems="center"
			height="100%"
			width="100%"
		>
			<Box {...finalModalProps} flexDirection="column">
				{/* Header */}
				{title && (
					<Box
						marginBottom={1}
						justifyContent="space-between"
						alignItems="center"
					>
						<Text color={theme.titleColor} bold>
							{title}
						</Text>
						{showCloseHint && (
							<Text color={baseTheme.textDim} dimColor>
								[ESC close]
							</Text>
						)}
					</Box>
				)}

				{/* Content */}
				<Box flexDirection="column" flexGrow={1}>
					{children}
				</Box>

				{/* Footer */}
				{footer && (
					<Box
						marginTop={1}
						borderStyle="single"
						borderTop
						borderBottom={false}
						borderLeft={false}
						borderRight={false}
						borderColor={baseTheme.border}
						paddingTop={1}
					>
						{footer}
					</Box>
				)}
			</Box>
		</Box>
	);
}

/**
 * Preset modal variants for common use cases
 */
export const ErrorModal = (props) => <BaseModal {...props} preset="error" />;

export const WarningModal = (props) => (
	<BaseModal {...props} preset="warning" />
);

export const InfoModal = (props) => <BaseModal {...props} preset="info" />;

export const SuccessModal = (props) => (
	<BaseModal {...props} preset="success" />
);
