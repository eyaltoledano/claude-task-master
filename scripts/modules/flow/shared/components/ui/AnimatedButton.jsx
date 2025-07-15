import React, { useState, useRef } from 'react';
import {
	colors,
	spacing,
	borderRadius,
	animations,
	variants,
	utils
} from '../../../styles/DesignSystem.js';

const AnimatedButton = ({
	children,
	onClick,
	variant = 'primary',
	size = 'medium',
	disabled = false,
	loading = false,
	leftIcon = null,
	rightIcon = null,
	fullWidth = false,
	className = '',
	...props
}) => {
	const [isPressed, setIsPressed] = useState(false);
	const [ripples, setRipples] = useState([]);
	const buttonRef = useRef(null);

	const sizes = {
		small: {
			padding: `${spacing[1.5]} ${spacing[3]}`,
			fontSize: '0.875rem',
			height: '32px',
			minWidth: '64px'
		},
		medium: {
			padding: `${spacing[2]} ${spacing[4]}`,
			fontSize: '1rem',
			height: '40px',
			minWidth: '80px'
		},
		large: {
			padding: `${spacing[3]} ${spacing[6]}`,
			fontSize: '1.125rem',
			height: '48px',
			minWidth: '96px'
		}
	};

	const variantStyles = variants.button[variant] || variants.button.primary;
	const sizeStyles = sizes[size];

	const handleMouseDown = (e) => {
		if (disabled || loading) return;

		setIsPressed(true);

		// Create ripple effect
		const rect = buttonRef.current.getBoundingClientRect();
		const size = Math.max(rect.width, rect.height);
		const x = e.clientX - rect.left - size / 2;
		const y = e.clientY - rect.top - size / 2;

		const newRipple = {
			x,
			y,
			size,
			id: Date.now()
		};

		setRipples((prev) => [...prev, newRipple]);

		// Remove ripple after animation
		setTimeout(() => {
			setRipples((prev) => prev.filter((ripple) => ripple.id !== newRipple.id));
		}, 600);
	};

	const handleMouseUp = () => {
		setIsPressed(false);
	};

	const handleClick = (e) => {
		if (disabled || loading) return;
		onClick?.(e);
	};

	const buttonStyles = {
		position: 'relative',
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing[2],
		border: variantStyles.border,
		borderRadius: borderRadius.md,
		background: disabled
			? variants.button.primary['&:disabled'].background
			: variantStyles.background,
		color: disabled
			? variants.button.primary['&:disabled'].color || colors.neutral[500]
			: variantStyles.color,
		cursor: disabled ? 'not-allowed' : loading ? 'wait' : 'pointer',
		fontSize: sizeStyles.fontSize,
		fontWeight: '500',
		fontFamily: 'inherit',
		padding: sizeStyles.padding,
		height: sizeStyles.height,
		minWidth: sizeStyles.minWidth,
		width: fullWidth ? '100%' : 'auto',
		overflow: 'hidden',
		userSelect: 'none',
		outline: 'none',
		transition: utils.transition(['all'], animations.duration[200]),
		transform: isPressed && !disabled && !loading ? 'scale(0.98)' : 'scale(1)',
		opacity: disabled ? 0.6 : 1,
		...props.style
	};

	const LoadingSpinner = () => (
		<div
			style={{
				width: '16px',
				height: '16px',
				border: '2px solid transparent',
				borderTop: '2px solid currentColor',
				borderRadius: '50%',
				animation: `spin ${animations.duration[1000]} ${animations.timing.linear} infinite`
			}}
		/>
	);

	return (
		<button
			ref={buttonRef}
			className={className}
			style={buttonStyles}
			onMouseDown={handleMouseDown}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onClick={handleClick}
			disabled={disabled}
			{...props}
		>
			{/* Ripple effect container */}
			<div
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					overflow: 'hidden',
					borderRadius: borderRadius.md,
					pointerEvents: 'none'
				}}
			>
				{ripples.map((ripple) => (
					<div
						key={ripple.id}
						style={{
							position: 'absolute',
							left: ripple.x,
							top: ripple.y,
							width: ripple.size,
							height: ripple.size,
							background: utils.rgba(
								variant === 'ghost' ? colors.neutral[900] : colors.neutral[50],
								0.3
							),
							borderRadius: '50%',
							transform: 'scale(0)',
							animation: `ripple ${animations.duration[600]} ${animations.timing.out} forwards`,
							pointerEvents: 'none'
						}}
					/>
				))}
			</div>

			{/* Button content */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: spacing[2],
					position: 'relative',
					zIndex: 1
				}}
			>
				{loading ? (
					<LoadingSpinner />
				) : leftIcon ? (
					<span style={{ display: 'flex', alignItems: 'center' }}>
						{leftIcon}
					</span>
				) : null}

				{children && (
					<span
						style={{
							opacity: loading ? 0.7 : 1,
							transition: utils.transition(
								['opacity'],
								animations.duration[150]
							)
						}}
					>
						{children}
					</span>
				)}

				{!loading && rightIcon && (
					<span style={{ display: 'flex', alignItems: 'center' }}>
						{rightIcon}
					</span>
				)}
			</div>

			<style jsx>{`
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        button:hover:not(:disabled) {
          background: ${
						!disabled && !loading
							? variant === 'primary'
								? colors.primary[700]
								: variant === 'secondary'
									? colors.neutral[300]
									: variant === 'success'
										? colors.success[700]
										: variant === 'warning'
											? colors.warning[700]
											: variant === 'danger'
												? colors.error[700]
												: variant === 'ghost'
													? colors.neutral[100]
													: variantStyles.background
							: variantStyles.background
					} !important;
          transform: ${!disabled && !loading ? 'translateY(-1px)' : 'none'};
          box-shadow: ${!disabled && !loading ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none'};
        }

        button:active:not(:disabled) {
          transform: ${!disabled && !loading ? 'translateY(0) scale(0.98)' : 'none'};
        }

        button:focus-visible {
          ${utils.focusRing(colors.primary[500])}
        }
      `}</style>
		</button>
	);
};

export default AnimatedButton;
