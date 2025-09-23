/**
 * Toast notification utilities
 */

import type { ToastNotification, AppAction } from '../types';

let toastIdCounter = 0;

export const createToast = (
	type: ToastNotification['type'],
	title: string,
	message: string,
	duration?: number
): ToastNotification => ({
	id: `toast-${++toastIdCounter}`,
	type,
	title,
	message,
	duration
});

export const showSuccessToast =
	(dispatch: React.Dispatch<AppAction>) =>
	(title: string, message: string, duration?: number) => {
		dispatch({
			type: 'ADD_TOAST',
			payload: createToast('success', title, message, duration)
		});
	};

export const showInfoToast =
	(dispatch: React.Dispatch<AppAction>) =>
	(title: string, message: string, duration?: number) => {
		dispatch({
			type: 'ADD_TOAST',
			payload: createToast('info', title, message, duration)
		});
	};

export const showWarningToast =
	(dispatch: React.Dispatch<AppAction>) =>
	(title: string, message: string, duration?: number) => {
		dispatch({
			type: 'ADD_TOAST',
			payload: createToast('warning', title, message, duration)
		});
	};

export const showErrorToast =
	(dispatch: React.Dispatch<AppAction>) =>
	(title: string, message: string, duration?: number) => {
		dispatch({
			type: 'ADD_TOAST',
			payload: createToast('error', title, message, duration)
		});
	};
