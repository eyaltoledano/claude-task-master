import React, { useState, useEffect, createContext, useContext } from 'react';
import { Box, Text } from 'ink';
import {
	colors,
	spacing,
	borderRadius,
	shadows,
	animations,
	utils,
	icons
} from '../../theme/DesignSystem.js';

// Toast context for managing global toasts
const ToastContext = createContext();

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error('useToast must be used within a ToastProvider');
	}
	return context;
};

// Toast provider component
export const ToastProvider = ({
	children,
	position = 'top-right',
	maxToasts = 5
}) => {
	const [toasts, setToasts] = useState([]);

	const addToast = (toast) => {
		const id = Math.random().toString(36).substr(2, 9);
		const newToast = {
			id,
			...toast,
			createdAt: Date.now()
		};

		setToasts((prevToasts) => {
			const updated = [newToast, ...prevToasts];
			return updated.slice(0, maxToasts);
		});

		// Auto dismiss if duration is specified
		if (toast.duration !== 0) {
			const duration = toast.duration || 5000;
			setTimeout(() => {
				removeToast(id);
			}, duration);
		}

		return id;
	};

	const removeToast = (id) => {
		setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
	};

	const removeAllToasts = () => {
		setToasts([]);
	};

	const toast = {
		success: (message, options = {}) =>
			addToast({ type: 'success', message, ...options }),
		error: (message, options = {}) =>
			addToast({ type: 'error', message, ...options }),
		warning: (message, options = {}) =>
			addToast({ type: 'warning', message, ...options }),
		info: (message, options = {}) =>
			addToast({ type: 'info', message, ...options }),
		loading: (message, options = {}) =>
			addToast({ type: 'loading', message, duration: 0, ...options })
	};

	const positions = {
		'top-left': { top: spacing[4], left: spacing[4] },
		'top-center': {
			top: spacing[4],
			left: '50%',
			transform: 'translateX(-50%)'
		},
		'top-right': { top: spacing[4], right: spacing[4] },
		'bottom-left': { bottom: spacing[4], left: spacing[4] },
		'bottom-center': {
			bottom: spacing[4],
			left: '50%',
			transform: 'translateX(-50%)'
		},
		'bottom-right': { bottom: spacing[4], right: spacing[4] }
	};

	return (
		<ToastContext.Provider value={{ toast, removeToast, removeAllToasts }}>
			{children}

			{/* Toast container */}
			<Box
				position="absolute"
				top={position.includes('top') ? 0 : undefined}
				bottom={position.includes('bottom') ? 0 : undefined}
				left={position.includes('center') ? '50%' : 0}
				right={position.includes('right') ? 0 : undefined}
				flexDirection={
					position.includes('bottom') ? 'column-reverse' : 'column'
				}
				width={500}
				gap={1}
			>
				{toasts.map((toastData) => (
					<Toast
						key={toastData.id}
						{...toastData}
						onClose={() => removeToast(toastData.id)}
					/>
				))}
			</Box>
		</ToastContext.Provider>
	);
};

// Individual toast component
const Toast = ({
	id,
	type = 'info',
	message,
	title,
	duration,
	action,
	onClose,
	createdAt
}) => {
	const [isVisible, setIsVisible] = useState(false);
	const [isRemoving, setIsRemoving] = useState(false);

	const typeConfig = {
		success: {
			color: colors.success[600],
			backgroundColor: colors.success[50],
			borderColor: colors.success[200],
			icon: <Text>{icons.status.success}</Text>
		},
		error: {
			color: colors.error[600],
			backgroundColor: colors.error[50],
			borderColor: colors.error[200],
			icon: <Text>{icons.status.error}</Text>
		},
		warning: {
			color: colors.warning[600],
			backgroundColor: colors.warning[50],
			borderColor: colors.warning[200],
			icon: <Text>{icons.status.warning}</Text>
		},
		info: {
			color: colors.primary[600],
			backgroundColor: colors.primary[50],
			borderColor: colors.primary[200],
			icon: <Text>{icons.status.info}</Text>
		},
		loading: {
			color: colors.neutral[600],
			backgroundColor: colors.neutral[50],
			borderColor: colors.neutral[200],
			icon: <Text>{icons.status.loading}</Text>
		}
	};

	const config = typeConfig[type];

	useEffect(() => {
		// Trigger entrance animation
		const timer = setTimeout(() => setIsVisible(true), 50);
		return () => clearTimeout(timer);
	}, []);

	const handleClose = () => {
		setIsRemoving(true);
		setTimeout(() => {
			onClose?.();
		}, 300);
	};

	const toastStyles = {
		pointerEvents: 'auto',
		background: config.backgroundColor,
		border: `1px solid ${config.borderColor}`,
		borderRadius: borderRadius.lg,
		boxShadow: shadows.lg,
		padding: spacing[4],
		display: 'flex',
		alignItems: 'flex-start',
		gap: spacing[3],
		minHeight: '60px',
		opacity: isRemoving ? 0 : isVisible ? 1 : 0,
		transform: isRemoving
			? 'translateX(100%) scale(0.8)'
			: isVisible
				? 'translateX(0) scale(1)'
				: 'translateX(100%) scale(0.8)',
		transition: utils.transition(['all'], animations.duration[300]),
		cursor: 'default',
		position: 'relative',
		overflow: 'hidden'
	};

	const LoadingIcon = () => (
		<Box>
			<Text>⏳</Text>
		</Box>
	);

	return (
		<Box
			flexDirection="row"
			alignItems="center"
			padding={1}
			borderStyle="round"
			borderColor={config.borderColor}
			backgroundColor={config.backgroundColor}
			width={40}
		>
			{/* Icon */}
			<Box marginRight={1}>
				{type === 'loading' ? <Text>⏳</Text> : config.icon}
			</Box>

			{/* Content */}
			<Box flexDirection="column" flexGrow={1}>
				{title && (
					<Box marginBottom={0}>
						<Text bold color={colors.neutral[900]}>
							{title}
						</Text>
					</Box>
				)}
				<Box>
					<Text color={colors.neutral[700]}>{message}</Text>
				</Box>
				{action && <Box marginTop={1}>{action}</Box>}
			</Box>

			{/* Close button */}
			<Box marginLeft={1}>
				<Text onPress={handleClose}>✖️</Text>
			</Box>
		</Box>
	);
};

// Simple toast component for standalone use
export const SimpleToast = ({
	type = 'info',
	message,
	title,
	visible = true,
	onClose,
	className = '',
	...props
}) => {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		if (visible) {
			const timer = setTimeout(() => setIsVisible(true), 50);
			return () => clearTimeout(timer);
		} else {
			setIsVisible(false);
		}
	}, [visible]);

	if (!visible && !isVisible) return null;

	const typeConfig = {
		success: {
			borderColor: colors.success[200],
			icon: <Text>{icons.status.success}</Text>
		},
		error: {
			borderColor: colors.error[200],
			icon: <Text>{icons.status.error}</Text>
		},
		warning: {
			borderColor: colors.warning[200],
			icon: <Text>{icons.status.warning}</Text>
		},
		info: {
			borderColor: colors.primary[200],
			icon: <Text>{icons.status.info}</Text>
		}
	};
	const config = typeConfig[type];

	return (
		<Box
			paddingX={2}
			paddingY={1}
			borderStyle="round"
			borderColor={config.borderColor}
			flexDirection="row"
			alignItems="center"
		>
			<Box marginRight={1}>{config.icon}</Box>
			{title && (
				<Box marginRight={1}>
					<Text bold>{title}</Text>
				</Box>
			)}
			<Text>{message}</Text>
		</Box>
	);
};

export { Toast };
export default Toast;
