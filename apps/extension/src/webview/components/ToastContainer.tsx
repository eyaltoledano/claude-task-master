/**
 * Toast Container Component
 */

import React from 'react';
import { ToastNotification } from './ToastNotification';
import type { ToastNotification as ToastType } from '../types';

interface ToastContainerProps {
	notifications: ToastType[];
	onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
	notifications,
	onDismiss
}) => {
	return (
		<div className="fixed top-4 right-4 z-50 pointer-events-none">
			<div className="flex flex-col items-end pointer-events-auto">
				{notifications.map((notification) => (
					<ToastNotification
						key={notification.id}
						notification={notification}
						onDismiss={onDismiss}
					/>
				))}
			</div>
		</div>
	);
};
