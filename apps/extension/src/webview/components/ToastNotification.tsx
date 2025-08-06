/**
 * Toast Notification Component
 */

import React, { useState, useEffect } from 'react';
import type { ToastNotification as ToastType } from '../types';

interface ToastNotificationProps {
	notification: ToastType;
	onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
	notification,
	onDismiss
}) => {
	const [isVisible, setIsVisible] = useState(true);
	const [progress, setProgress] = useState(100);
	const duration = notification.duration || 5000; // 5 seconds default

	useEffect(() => {
		const progressInterval = setInterval(() => {
			setProgress((prev) => {
				const decrease = (100 / duration) * 100; // Update every 100ms
				return Math.max(0, prev - decrease);
			});
		}, 100);

		const timeoutId = setTimeout(() => {
			setIsVisible(false);
			setTimeout(() => onDismiss(notification.id), 300); // Wait for animation
		}, duration);

		return () => {
			clearInterval(progressInterval);
			clearTimeout(timeoutId);
		};
	}, [notification.id, duration, onDismiss]);

	const getIcon = () => {
		switch (notification.type) {
			case 'success':
				return (
					<svg
						className="w-5 h-5 text-green-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				);
			case 'info':
				return (
					<svg
						className="w-5 h-5 text-blue-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				);
			case 'warning':
				return (
					<svg
						className="w-5 h-5 text-yellow-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.667-2.308-1.667-3.08 0L3.34 19c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				);
			case 'error':
				return (
					<svg
						className="w-5 h-5 text-red-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				);
		}
	};

	const bgColor = {
		success: 'bg-green-900/90',
		info: 'bg-blue-900/90',
		warning: 'bg-yellow-900/90',
		error: 'bg-red-900/90'
	}[notification.type];

	const borderColor = {
		success: 'border-green-600',
		info: 'border-blue-600',
		warning: 'border-yellow-600',
		error: 'border-red-600'
	}[notification.type];

	const progressColor = {
		success: 'bg-green-400',
		info: 'bg-blue-400',
		warning: 'bg-yellow-400',
		error: 'bg-red-400'
	}[notification.type];

	return (
		<div
			className={`${bgColor} ${borderColor} border rounded-lg shadow-lg p-4 mb-2 transition-all duration-300 ${
				isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
			} max-w-sm w-full relative overflow-hidden`}
		>
			<div className="flex items-start">
				<div className="flex-shrink-0">{getIcon()}</div>
				<div className="ml-3 flex-1">
					<h3 className="text-sm font-medium text-white">
						{notification.title}
					</h3>
					<p className="mt-1 text-sm text-gray-300">{notification.message}</p>
				</div>
				<button
					onClick={() => onDismiss(notification.id)}
					className="ml-4 flex-shrink-0 inline-flex text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
				>
					<span className="sr-only">Close</span>
					<svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path
							fillRule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clipRule="evenodd"
						/>
					</svg>
				</button>
			</div>
			{/* Progress bar */}
			<div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700">
				<div
					className={`h-full ${progressColor} transition-all duration-100 ease-linear`}
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
};
