import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { theme } from '../theme-advanced.js';

export const LoadingSpinner = ({ message = 'Loading...' }) => {
	const [frame, setFrame] = useState(0);
	const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

	useEffect(() => {
		const timer = setInterval(() => {
			setFrame((prev) => (prev + 1) % frames.length);
		}, 80);

		return () => clearInterval(timer);
	}, []);

	return (
		<Text color={theme.accent}>
			{frames[frame]} {message}
		</Text>
	);
};
