import { useState, useEffect } from 'react';

/**
 * Hook for responsive terminal layouts based on terminal dimensions
 * Simplified approach inspired by Gemini CLI - focuses on practical breakpoints
 */
export function useTerminalSize() {
	const [size, setSize] = useState(() => ({
		width: process.stdout.columns || 80,
		height: process.stdout.rows || 24
	}));

	const [layout, setLayout] = useState(() => getLayoutType(size.width));

	useEffect(() => {
		const handleResize = () => {
			const newSize = {
				width: process.stdout.columns || 80,
				height: process.stdout.rows || 24
			};
			setSize(newSize);
			setLayout(getLayoutType(newSize.width));
		};

		// Listen for terminal resize events
		process.stdout.on('resize', handleResize);

		return () => {
			process.stdout.off('resize', handleResize);
		};
	}, []);

	return {
		width: size.width,
		height: size.height,
		layout,
		
		// Practical breakpoints - only three that matter
		isNarrow: size.width < 60,
		isMedium: size.width >= 60 && size.width < 100,
		isWide: size.width >= 100,
		
		// Cap effective width at 120 for readability
		effectiveWidth: Math.min(size.width, 120),
		
		// Utility functions for responsive design
		contentWidth: Math.min(size.width - 4, 116), // Account for padding, cap at 116
		availableHeight: size.height - 6, // Account for header/footer
		
		// Helper for responsive values
		getResponsiveValue: (narrow, medium, wide) => {
			if (size.width < 60) return narrow;
			if (size.width < 100) return medium;
			return wide;
		}
	};
}

function getLayoutType(width) {
	if (width < 60) return 'narrow';
	if (width < 100) return 'medium';
	return 'wide';
}
