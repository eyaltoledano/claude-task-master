import React, { useState, useCallback, createContext, useContext } from 'react';
import { Box, Text } from 'ink';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
	const [notifications, setNotifications] = useState([]);

	const addNotification = useCallback((message) => {
		const id = Date.now();
		setNotifications((prev) => [...prev, { id, message }]);
		setTimeout(() => {
			setNotifications((prev) => prev.filter((n) => n.id !== id));
		}, 3000); // Notifications disappear after 3 seconds
	}, []);

	return (
		<NotificationContext.Provider value={{ addNotification }}>
			{children}
			<NotificationManager notifications={notifications} />
		</NotificationContext.Provider>
	);
};

const NotificationManager = ({ notifications }) => {
	if (notifications.length === 0) {
		return null;
	}

	return (
		<Box
			position="absolute"
			bottom={0}
			left={0}
			width="100%"
			flexDirection="column-reverse"
		>
			{notifications.map((n) => (
				<Box key={n.id} backgroundColor="gray" paddingX={1}>
					<Text>{n.message}</Text>
				</Box>
			))}
		</Box>
	);
};
