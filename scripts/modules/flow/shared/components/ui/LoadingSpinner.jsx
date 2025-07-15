import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';

const LoadingSpinner = ({
	message = '',
	type = 'spinner',
	speed = 'normal'
}) => {
	const [frame, setFrame] = useState(0);

	const spinnerFrames = {
		spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
		dots: ['⠋', '⠙', '⠚', '⠞', '⠖', '⠦', '⠴', '⠲', '⠳', '⠓'],
		line: ['⠄', '⠆', '⠇', '⠋', '⠙', '⠸', '⠰', '⠠', '⠰', '⠸', '⠙', '⠋', '⠇', '⠆'],
		pipe: ['┤', '┘', '┴', '└', '├', '┌', '┬', '┐'],
		simple: ['|', '/', '-', '\\'],
		bounce: ['⠁', '⠂', '⠄', '⠂'],
		pulse: ['●', '◐', '○', '◑'],
		expand: ['▁', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃']
	};

	const speeds = {
		slow: 200,
		normal: 100,
		fast: 50
	};

	const frames = spinnerFrames[type] || spinnerFrames.spinner;
	const interval = speeds[speed] || speeds.normal;

	useEffect(() => {
		const timer = setInterval(() => {
			setFrame(current => (current + 1) % frames.length);
		}, interval);

		return () => clearInterval(timer);
	}, [frames.length, interval]);

	return (
		<Box>
			<Text color="blue">{frames[frame]} </Text>
			{message && <Text color="white">{message}</Text>}
		</Box>
	);
};

// Simple skeleton loader for terminal
export const SkeletonLoader = ({ width = 40, text = 'Loading' }) => {
	const [dots, setDots] = useState('');

	useEffect(() => {
		const timer = setInterval(() => {
			setDots(current => {
				if (current.length >= 3) return '';
				return current + '.';
			});
		}, 500);

		return () => clearInterval(timer);
	}, []);

	const skeleton = '░'.repeat(width);

	return (
		<Box flexDirection="column">
			<Text color="gray">{skeleton}</Text>
			<Text color="white">{text}{dots}</Text>
		</Box>
	);
};

// Loading overlay for terminal
export const LoadingOverlay = ({
	visible = false,
	message = 'Loading...',
	spinnerType = 'spinner'
}) => {
	if (!visible) return null;

	return (
		<Box 
			flexDirection="column" 
			alignItems="center" 
			justifyContent="center"
			padding={2}
			borderStyle="round"
			borderColor="blue"
		>
			<LoadingSpinner type={spinnerType} />
			<Text color="white">{message}</Text>
		</Box>
	);
};

export { LoadingSpinner };
export default LoadingSpinner;
