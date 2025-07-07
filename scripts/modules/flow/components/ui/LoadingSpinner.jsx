import React from 'react';
import {
	colors,
	spacing,
	animations,
	utils
} from '../../styles/DesignSystem.js';

const LoadingSpinner = ({
	size = 'medium',
	color = 'primary',
	thickness = 2,
	speed = 'normal',
	type = 'spinner',
	className = '',
	...props
}) => {
	const sizes = {
		small: '16px',
		medium: '24px',
		large: '32px',
		xlarge: '48px'
	};

	const speeds = {
		slow: animations.duration[1000],
		normal: animations.duration[700],
		fast: animations.duration[500]
	};

	const colorMap = {
		primary: colors.primary[600],
		success: colors.success[600],
		warning: colors.warning[600],
		error: colors.error[600],
		neutral: colors.neutral[600],
		white: colors.neutral[50]
	};

	const spinnerSize = sizes[size];
	const spinnerColor = colorMap[color] || colors.primary[600];
	const animationSpeed = speeds[speed];

	const SpinnerType = ({ type }) => {
		switch (type) {
			case 'dots':
				return (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: spacing[1]
						}}
					>
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								style={{
									width: `calc(${spinnerSize} / 3)`,
									height: `calc(${spinnerSize} / 3)`,
									backgroundColor: spinnerColor,
									borderRadius: '50%',
									animation: `bounce ${animationSpeed} infinite ease-in-out`,
									animationDelay: `${i * 0.16}s`
								}}
							/>
						))}
					</div>
				);

			case 'pulse':
				return (
					<div
						style={{
							width: spinnerSize,
							height: spinnerSize,
							backgroundColor: spinnerColor,
							borderRadius: '50%',
							animation: `pulse ${animationSpeed} infinite ease-in-out`
						}}
					/>
				);

			case 'bars':
				return (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: spacing[1],
							height: spinnerSize
						}}
					>
						{[0, 1, 2, 3].map((i) => (
							<div
								key={i}
								style={{
									width: `calc(${spinnerSize} / 6)`,
									height: '100%',
									backgroundColor: spinnerColor,
									borderRadius: spacing[1],
									animation: `bars ${animationSpeed} infinite ease-in-out`,
									animationDelay: `${i * 0.1}s`
								}}
							/>
						))}
					</div>
				);

			case 'ring':
				return (
					<div
						style={{
							width: spinnerSize,
							height: spinnerSize,
							border: `${thickness}px solid ${utils.rgba(spinnerColor, 0.2)}`,
							borderTop: `${thickness}px solid ${spinnerColor}`,
							borderRadius: '50%',
							animation: `spin ${animationSpeed} linear infinite`
						}}
					/>
				);

			case 'gradient':
				return (
					<div
						style={{
							width: spinnerSize,
							height: spinnerSize,
							background: `conic-gradient(from 0deg, transparent, ${spinnerColor})`,
							borderRadius: '50%',
							animation: `spin ${animationSpeed} linear infinite`,
							'&::before': {
								content: '""',
								position: 'absolute',
								inset: thickness + 'px',
								background: 'inherit',
								borderRadius: '50%'
							}
						}}
					/>
				);

			default: // spinner
				return (
					<div
						style={{
							width: spinnerSize,
							height: spinnerSize,
							border: `${thickness}px solid transparent`,
							borderTop: `${thickness}px solid ${spinnerColor}`,
							borderRadius: '50%',
							animation: `spin ${animationSpeed} linear infinite`
						}}
					/>
				);
		}
	};

	return (
		<div
			className={className}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				...props.style
			}}
			{...props}
		>
			<SpinnerType type={type} />

			<style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.8);
          }
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bars {
          0%, 40%, 100% {
            transform: scaleY(0.4);
            opacity: 0.5;
          }
          20% {
            transform: scaleY(1);
            opacity: 1;
          }
        }
      `}</style>
		</div>
	);
};

// Skeleton loading component for content placeholders
export const SkeletonLoader = ({
	width = '100%',
	height = '16px',
	borderRadius = '4px',
	className = '',
	...props
}) => {
	return (
		<div
			className={className}
			style={{
				width,
				height,
				borderRadius,
				background: `linear-gradient(90deg, ${colors.neutral[200]} 25%, ${colors.neutral[100]} 50%, ${colors.neutral[200]} 75%)`,
				backgroundSize: '200% 100%',
				animation: `shimmer ${animations.duration[1000]} ease-in-out infinite`,
				...props.style
			}}
			{...props}
		>
			<style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
		</div>
	);
};

// Full screen loading overlay
export const LoadingOverlay = ({
	visible = false,
	message = 'Loading...',
	spinnerType = 'spinner',
	backgroundColor = 'rgba(255, 255, 255, 0.9)',
	...props
}) => {
	if (!visible) return null;

	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: spacing[4],
				zIndex: 9999,
				backdropFilter: 'blur(2px)',
				animation: `fadeIn ${animations.duration[300]} ${animations.timing.out}`
			}}
			{...props}
		>
			<LoadingSpinner size="large" type={spinnerType} />
			{message && (
				<div
					style={{
						color: colors.neutral[700],
						fontSize: '1rem',
						fontWeight: '500',
						textAlign: 'center'
					}}
				>
					{message}
				</div>
			)}

			<style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
		</div>
	);
};

export default LoadingSpinner;
