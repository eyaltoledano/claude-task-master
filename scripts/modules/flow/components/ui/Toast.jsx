import React, { useState, useEffect, createContext, useContext } from 'react';
import {
	colors,
	spacing,
	borderRadius,
	shadows,
	animations,
	utils,
	icons
} from '../../styles/DesignSystem.js';

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
			<div
				style={{
					position: 'fixed',
					zIndex: 10000,
					pointerEvents: 'none',
					...positions[position]
				}}
			>
				<div
					style={{
						display: 'flex',
						flexDirection: position.includes('bottom')
							? 'column-reverse'
							: 'column',
						gap: spacing[2],
						minWidth: '320px',
						maxWidth: '500px'
					}}
				>
					{toasts.map((toastData) => (
						<Toast
							key={toastData.id}
							{...toastData}
							onClose={() => removeToast(toastData.id)}
						/>
					))}
				</div>
			</div>
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
			icon: icons.status.success
		},
		error: {
			color: colors.error[600],
			backgroundColor: colors.error[50],
			borderColor: colors.error[200],
			icon: icons.status.error
		},
		warning: {
			color: colors.warning[600],
			backgroundColor: colors.warning[50],
			borderColor: colors.warning[200],
			icon: icons.status.warning
		},
		info: {
			color: colors.primary[600],
			backgroundColor: colors.primary[50],
			borderColor: colors.primary[200],
			icon: icons.status.info
		},
		loading: {
			color: colors.neutral[600],
			backgroundColor: colors.neutral[50],
			borderColor: colors.neutral[200],
			icon: icons.status.loading
		}
	};

	const config = typeConfig[type] || typeConfig.info;

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
		<div
			style={{
				width: '16px',
				height: '16px',
				border: `2px solid ${config.color}`,
				borderTop: '2px solid transparent',
				borderRadius: '50%',
				animation: `spin ${animations.duration[1000]} linear infinite`,
				flexShrink: 0,
				marginTop: '2px'
			}}
		/>
	);

	return (
		<div style={toastStyles}>
			{/* Progress bar for timed toasts */}
			{duration > 0 && (
				<div
					style={{
						position: 'absolute',
						bottom: 0,
						left: 0,
						height: '3px',
						backgroundColor: config.color,
						borderRadius: '0 0 8px 8px',
						animation: `toast-progress ${duration}ms linear forwards`
					}}
				/>
			)}

			{/* Icon */}
			<div
				style={{
					color: config.color,
					fontSize: '16px',
					flexShrink: 0,
					marginTop: title ? '0' : '2px'
				}}
			>
				{type === 'loading' ? <LoadingIcon /> : config.icon}
			</div>

			{/* Content */}
			<div style={{ flex: 1, minWidth: 0 }}>
				{title && (
					<div
						style={{
							fontSize: '0.875rem',
							fontWeight: '600',
							color: colors.neutral[900],
							marginBottom: spacing[1],
							lineHeight: 1.4
						}}
					>
						{title}
					</div>
				)}

				<div
					style={{
						fontSize: '0.875rem',
						color: colors.neutral[700],
						lineHeight: 1.4,
						wordBreak: 'break-word'
					}}
				>
					{message}
				</div>

				{action && <div style={{ marginTop: spacing[2] }}>{action}</div>}
			</div>

			{/* Close button */}
			<button
				type="button"
				onClick={handleClose}
				style={{
					background: 'none',
					border: 'none',
					color: colors.neutral[500],
					cursor: 'pointer',
					padding: spacing[1],
					borderRadius: borderRadius.sm,
					fontSize: '16px',
					lineHeight: 1,
					flexShrink: 0,
					transition: utils.transition(
						['color', 'background-color'],
						animations.duration[150]
					),
					'&:hover': {
						color: colors.neutral[700],
						backgroundColor: colors.neutral[100]
					}
				}}
				aria-label="Close notification"
			>
				{icons.actions.close}
			</button>

			<style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }

        button:hover {
          color: ${colors.neutral[700]} !important;
          background-color: ${colors.neutral[100]} !important;
        }
      `}</style>
		</div>
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

	return (
		<Toast
			type={type}
			message={message}
			title={title}
			onClose={onClose}
			id="simple-toast"
			{...props}
		/>
	);
};

export default Toast;
