import React, { useEffect, useState } from 'react';
import {
	colors,
	spacing,
	borderRadius,
	animations,
	utils
} from '../../styles/DesignSystem.js';

const ProgressBar = ({
	value = 0,
	max = 100,
	size = 'medium',
	variant = 'primary',
	showLabel = false,
	showPercentage = false,
	label = '',
	animated = true,
	striped = false,
	indeterminate = false,
	className = '',
	...props
}) => {
	const [displayValue, setDisplayValue] = useState(0);

	const sizes = {
		small: '4px',
		medium: '8px',
		large: '12px',
		xlarge: '16px'
	};

	const colorMap = {
		primary: colors.primary[600],
		success: colors.success[600],
		warning: colors.warning[600],
		error: colors.error[600],
		neutral: colors.neutral[600]
	};

	const percentage = Math.min((value / max) * 100, 100);
	const progressColor = colorMap[variant] || colors.primary[600];
	const progressHeight = sizes[size];

	// Animate value changes
	useEffect(() => {
		if (!animated) {
			setDisplayValue(percentage);
			return;
		}

		const startValue = displayValue;
		const endValue = percentage;
		const duration = 1000; // 1 second
		const startTime = Date.now();

		const animateValue = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Easing function (ease-out)
			const easeOut = 1 - (1 - progress) ** 3;
			const currentValue = startValue + (endValue - startValue) * easeOut;

			setDisplayValue(currentValue);

			if (progress < 1) {
				requestAnimationFrame(animateValue);
			}
		};

		requestAnimationFrame(animateValue);
	}, [percentage, animated, displayValue]);

	const trackStyles = {
		width: '100%',
		height: progressHeight,
		backgroundColor: colors.neutral[200],
		borderRadius: borderRadius.full,
		overflow: 'hidden',
		position: 'relative'
	};

	const fillStyles = {
		height: '100%',
		backgroundColor: progressColor,
		borderRadius: borderRadius.full,
		transition: animated
			? utils.transition(['width'], animations.duration[500])
			: 'none',
		width: indeterminate ? '30%' : `${displayValue}%`,
		minWidth: displayValue > 0 && displayValue < 5 ? '5%' : 'auto',
		position: 'relative',
		overflow: 'hidden'
	};

	const stripedBackground = striped
		? `
    background-image: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.15) 25%,
      transparent 25%,
      transparent 50%,
      rgba(255, 255, 255, 0.15) 50%,
      rgba(255, 255, 255, 0.15) 75%,
      transparent 75%,
      transparent
    );
    background-size: 1rem 1rem;
  `
		: '';

	const animatedStripes =
		animated && striped
			? `
    animation: stripes ${animations.duration[1000]} linear infinite;
  `
			: '';

	const indeterminateAnimation = indeterminate
		? `
    animation: indeterminate ${animations.duration[1000]} ease-in-out infinite alternate;
  `
		: '';

	return (
		<div className={className} {...props}>
			{(showLabel || label) && (
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: spacing[2],
						fontSize: '0.875rem',
						color: colors.neutral[700]
					}}
				>
					{(label || showLabel) && <span>{label || 'Progress'}</span>}
					{showPercentage && !indeterminate && (
						<span style={{ fontWeight: '500' }}>
							{Math.round(displayValue)}%
						</span>
					)}
				</div>
			)}

			<div style={trackStyles}>
				<div style={fillStyles}>
					<style jsx>{`
            div {
              ${stripedBackground}
              ${animatedStripes}
              ${indeterminateAnimation}
            }

            @keyframes stripes {
              from {
                background-position: 0 0;
              }
              to {
                background-position: 1rem 0;
              }
            }

            @keyframes indeterminate {
              0% {
                left: -30%;
              }
              100% {
                left: 100%;
              }
            }
          `}</style>
				</div>
			</div>
		</div>
	);
};

// Circular progress component
export const CircularProgress = ({
	value = 0,
	max = 100,
	size = 80,
	thickness = 4,
	variant = 'primary',
	showLabel = false,
	showPercentage = true,
	label = '',
	animated = true,
	indeterminate = false,
	className = '',
	...props
}) => {
	const [displayValue, setDisplayValue] = useState(0);

	const colorMap = {
		primary: colors.primary[600],
		success: colors.success[600],
		warning: colors.warning[600],
		error: colors.error[600],
		neutral: colors.neutral[600]
	};

	const percentage = Math.min((value / max) * 100, 100);
	const progressColor = colorMap[variant] || colors.primary[600];

	const radius = (size - thickness) / 2;
	const circumference = radius * 2 * Math.PI;
	const strokeDasharray = circumference;
	const strokeDashoffset = indeterminate
		? 0
		: circumference - (displayValue / 100) * circumference;

	// Animate value changes
	useEffect(() => {
		if (!animated || indeterminate) {
			setDisplayValue(percentage);
			return;
		}

		const startValue = displayValue;
		const endValue = percentage;
		const duration = 1000;
		const startTime = Date.now();

		const animateValue = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			const easeOut = 1 - (1 - progress) ** 3;
			const currentValue = startValue + (endValue - startValue) * easeOut;

			setDisplayValue(currentValue);

			if (progress < 1) {
				requestAnimationFrame(animateValue);
			}
		};

		requestAnimationFrame(animateValue);
	}, [percentage, animated, indeterminate, displayValue]);

	return (
		<div
			className={className}
			style={{
				position: 'relative',
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				width: size,
				height: size
			}}
			{...props}
		>
			<svg
				width={size}
				height={size}
				style={{
					transform: 'rotate(-90deg)'
				}}
				aria-hidden="true"
			>
				{/* Background circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={colors.neutral[200]}
					strokeWidth={thickness}
					fill="transparent"
				/>

				{/* Progress circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={progressColor}
					strokeWidth={thickness}
					fill="transparent"
					strokeDasharray={strokeDasharray}
					strokeDashoffset={strokeDashoffset}
					strokeLinecap="round"
					style={{
						transition:
							animated && !indeterminate
								? utils.transition(
										['stroke-dashoffset'],
										animations.duration[500]
									)
								: 'none',
						animation: indeterminate
							? `circular-indeterminate ${animations.duration[1000]} linear infinite`
							: 'none'
					}}
				/>
			</svg>

			{/* Label content */}
			{(showLabel || showPercentage || label) && (
				<div
					style={{
						position: 'absolute',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						textAlign: 'center',
						pointerEvents: 'none'
					}}
				>
					{showPercentage && !indeterminate && (
						<span
							style={{
								fontSize: size > 60 ? '1rem' : '0.875rem',
								fontWeight: '600',
								color: colors.neutral[900],
								lineHeight: 1
							}}
						>
							{Math.round(displayValue)}%
						</span>
					)}
					{(label || showLabel) && (
						<span
							style={{
								fontSize: size > 60 ? '0.75rem' : '0.625rem',
								color: colors.neutral[600],
								marginTop: spacing[0.5]
							}}
						>
							{label || 'Progress'}
						</span>
					)}
				</div>
			)}

			<style jsx>{`
        @keyframes circular-indeterminate {
          0% {
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 89, 200;
            stroke-dashoffset: -35;
          }
          100% {
            stroke-dasharray: 89, 200;
            stroke-dashoffset: -124;
          }
        }
      `}</style>
		</div>
	);
};

// Step progress component
export const StepProgress = ({
	steps = [],
	currentStep = 0,
	variant = 'primary',
	size = 'medium',
	className = '',
	...props
}) => {
	const colorMap = {
		primary: colors.primary[600],
		success: colors.success[600],
		warning: colors.warning[600],
		error: colors.error[600],
		neutral: colors.neutral[600]
	};

	const sizes = {
		small: { circle: '24px', fontSize: '0.75rem' },
		medium: { circle: '32px', fontSize: '0.875rem' },
		large: { circle: '40px', fontSize: '1rem' }
	};

	const progressColor = colorMap[variant] || colors.primary[600];
	const sizeConfig = sizes[size];

	return (
		<div
			className={className}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: spacing[2],
				width: '100%'
			}}
			{...props}
		>
			{steps.map((step, index) => {
				const isCompleted = index < currentStep;
				const isCurrent = index === currentStep;
				const isUpcoming = index > currentStep;

				return (
					<React.Fragment key={`step-${index}-${step || 'empty'}`}>
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: spacing[2],
								flex: 1
							}}
						>
							{/* Step circle */}
							<div
								style={{
									width: sizeConfig.circle,
									height: sizeConfig.circle,
									borderRadius: '50%',
									backgroundColor:
										isCompleted || isCurrent
											? progressColor
											: colors.neutral[300],
									color:
										isCompleted || isCurrent
											? colors.neutral[50]
											: colors.neutral[600],
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									fontSize: sizeConfig.fontSize,
									fontWeight: '600',
									transition: utils.transition(
										['all'],
										animations.duration[300]
									),
									border: isCurrent
										? `2px solid ${colors.neutral[50]}`
										: 'none',
									boxShadow: isCurrent ? `0 0 0 2px ${progressColor}` : 'none'
								}}
							>
								{isCompleted ? '✓' : index + 1}
							</div>

							{/* Step label */}
							{step && (
								<span
									style={{
										fontSize: '0.75rem',
										color:
											isCompleted || isCurrent
												? colors.neutral[900]
												: colors.neutral[500],
										textAlign: 'center',
										fontWeight: isCurrent ? '600' : '400',
										transition: utils.transition(
											['color', 'font-weight'],
											animations.duration[300]
										)
									}}
								>
									{step}
								</span>
							)}
						</div>

						{/* Connector line */}
						{index < steps.length - 1 && (
							<div
								style={{
									flex: 1,
									height: '2px',
									backgroundColor:
										index < currentStep ? progressColor : colors.neutral[300],
									transition: utils.transition(
										['background-color'],
										animations.duration[300]
									),
									marginBottom: step ? spacing[6] : 0
								}}
							/>
						)}
					</React.Fragment>
				);
			})}
		</div>
	);
};

export default ProgressBar;
