/**
 * Webview Entry Point
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// CSS is built separately by Tailwind

// VS Code API declaration
declare global {
	interface Window {
		acquireVsCodeApi?: () => {
			postMessage: (message: any) => void;
			setState: (state: any) => void;
			getState: () => any;
		};
	}
}

// Initialize React app
const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(<App />);
} else {
	console.error('❌ Root container not found');
}
