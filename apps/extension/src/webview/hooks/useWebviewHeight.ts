/**
 * Hook for managing webview height
 */

import { useState, useEffect, useCallback } from 'react';

export const useWebviewHeight = () => {
	const [availableHeight, setAvailableHeight] = useState<number>(
		window.innerHeight
	);

	const updateAvailableHeight = useCallback(() => {
		const height = window.innerHeight;
		console.log('📏 Available height updated:', height);
		setAvailableHeight(height);
	}, []);

	useEffect(() => {
		updateAvailableHeight();

		const handleResize = () => {
			updateAvailableHeight();
		};

		window.addEventListener('resize', handleResize);

		// Also listen for VS Code specific events if available
		const handleVisibilityChange = () => {
			// Small delay to ensure VS Code has finished resizing
			setTimeout(updateAvailableHeight, 100);
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('resize', handleResize);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, [updateAvailableHeight]);

	return availableHeight;
};
