/**
 * Error Boundary Component
 */

import React from 'react';

interface ErrorBoundaryState {
	hasError: boolean;
	error?: Error;
	errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
	children: React.ReactNode;
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error('React Error Boundary caught:', error, errorInfo);

		// Log to extension
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}

		// Send error to extension for centralized handling
		if (window.acquireVsCodeApi) {
			const vscode = window.acquireVsCodeApi();
			vscode.postMessage({
				type: 'reactError',
				data: {
					message: error.message,
					stack: error.stack,
					componentStack: errorInfo.componentStack,
					timestamp: Date.now()
				}
			});
		}
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen flex items-center justify-center bg-vscode-background">
					<div className="max-w-md mx-auto text-center p-6">
						<div className="w-16 h-16 mx-auto mb-4 text-red-400">
							<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z"
								/>
							</svg>
						</div>
						<h2 className="text-xl font-semibold text-vscode-foreground mb-2">
							Something went wrong
						</h2>
						<p className="text-vscode-foreground/70 mb-4">
							The Task Master Kanban board encountered an unexpected error.
						</p>
						<div className="space-y-2">
							<button
								onClick={() =>
									this.setState({
										hasError: false,
										error: undefined,
										errorInfo: undefined
									})
								}
								className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
							>
								Try Again
							</button>
							<button
								onClick={() => window.location.reload()}
								className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors"
							>
								Reload Extension
							</button>
						</div>
						{this.state.error && (
							<details className="mt-4 text-left">
								<summary className="text-sm text-vscode-foreground/50 cursor-pointer">
									Error Details
								</summary>
								<pre className="mt-2 text-xs text-vscode-foreground/70 bg-vscode-input/30 p-2 rounded overflow-auto max-h-32">
									{this.state.error.message}
									{this.state.error.stack && `\n\n${this.state.error.stack}`}
								</pre>
							</details>
						)}
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
