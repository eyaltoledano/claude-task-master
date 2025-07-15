import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

export function Toast({
	message,
	type = 'info',
	duration = 3000,
	onDismiss,
	position = 'top'
}) {
	const [visible, setVisible] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => {
			setVisible(false);
			if (onDismiss) onDismiss();
		}, duration);

		return () => clearTimeout(timer);
	}, [duration, onDismiss]);

	if (!visible || !message) return null;

	const colors = {
		success: 'green',
		error: 'red',
		warning: 'yellow',
		info: 'cyan'
	};

	const borderColors = {
		success: 'green',
		error: 'red',
		warning: 'yellow',
		info: 'cyan'
	};

	const icons = {
		success: '✓',
		error: '✗',
		warning: '⚠',
		info: 'ℹ'
	};

	// Position styles
	const positionStyles =
		position === 'top'
			? {
					position: 'absolute',
					top: 1,
					left: '50%',
					transform: 'translateX(-50%)'
				}
			: {
					position: 'absolute',
					bottom: 2,
					right: 2
				};

	return (
		<Box
			{...positionStyles}
			borderStyle="round"
			borderColor={borderColors[type]}
			paddingLeft={2}
			paddingRight={2}
			paddingTop={0}
			paddingBottom={0}
		>
			<Text color={colors[type]} bold>
				{icons[type]} {message}
			</Text>
		</Box>
	);
}
