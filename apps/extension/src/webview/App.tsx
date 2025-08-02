/**
 * Main App Component
 */

import React, { useReducer, useState, useEffect, useRef } from 'react';
import { VSCodeContext } from './contexts/VSCodeContext';
import { QueryProvider } from './providers/QueryProvider';
import { AppContent } from './components/AppContent';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { appReducer, initialState } from './reducers/appReducer';
import { useWebviewHeight } from './hooks/useWebviewHeight';
import { useVSCodeMessages } from './hooks/useVSCodeMessages';
import {
	showSuccessToast,
	showInfoToast,
	showWarningToast,
	showErrorToast,
	createToast
} from './utils/toast';

export const App: React.FC = () => {
	const [state, dispatch] = useReducer(appReducer, initialState);
	const [vscode] = useState(() => window.acquireVsCodeApi?.());
	const availableHeight = useWebviewHeight();
	const { sendMessage } = useVSCodeMessages(vscode, state, dispatch);
	const hasInitialized = useRef(false);

	// Initialize the webview
	useEffect(() => {
		if (hasInitialized.current) return;
		hasInitialized.current = true;

		if (!vscode) {
			console.warn('⚠️ VS Code API not available - running in standalone mode');
			dispatch({
				type: 'SET_CONNECTION_STATUS',
				payload: { isConnected: false, status: 'Standalone Mode' }
			});
			return;
		}

		console.log('🔄 Initializing webview...');

		// Notify extension that webview is ready
		vscode.postMessage({ type: 'ready' });

		// React Query will handle task fetching, so we only need to load tags data
		sendMessage({ type: 'getTags' })
			.then((tagsData) => {
				if (tagsData?.tags && tagsData?.currentTag) {
					const tagNames = tagsData.tags.map((tag: any) => tag.name || tag);
					dispatch({
						type: 'SET_TAG_DATA',
						payload: {
							currentTag: tagsData.currentTag,
							availableTags: tagNames
						}
					});
				}
			})
			.catch((error) => {
				console.error('❌ Failed to load tags:', error);
			});
	}, [vscode, sendMessage, dispatch]);

	const contextValue = {
		vscode,
		state,
		dispatch,
		sendMessage,
		availableHeight,
		// Toast notification functions
		showSuccessToast: showSuccessToast(dispatch),
		showInfoToast: showInfoToast(dispatch),
		showWarningToast: showWarningToast(dispatch),
		showErrorToast: showErrorToast(dispatch)
	};

	return (
		<QueryProvider>
			<VSCodeContext.Provider value={contextValue}>
				<ErrorBoundary
					onError={(error) => {
						// Handle React errors and show appropriate toast
						dispatch({
							type: 'ADD_TOAST',
							payload: createToast(
								'error',
								'Component Error',
								`A React component crashed: ${error.message}`,
								10000
							)
						});
					}}
				>
					<AppContent />
					<ToastContainer
						notifications={state.toastNotifications}
						onDismiss={(id) => dispatch({ type: 'REMOVE_TOAST', payload: id })}
					/>
				</ErrorBoundary>
			</VSCodeContext.Provider>
		</QueryProvider>
	);
};
