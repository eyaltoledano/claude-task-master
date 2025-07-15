import React, { useState, useCallback, createContext, useContext } from 'react';
import { Box, Text } from 'ink';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

// Notification channels configuration
const notificationChannels = {
	email: { enabled: true, webhook: process.env.EMAIL_WEBHOOK },
	slack: { enabled: true, webhook: process.env.SLACK_WEBHOOK },
	telegram: { enabled: true, token: process.env.TELEGRAM_TOKEN },
	whatsapp: { enabled: false }, // Phase 4
	sms: { enabled: true, service: 'twilio' }
};

export const NotificationProvider = ({ children }) => {
	const [notifications, setNotifications] = useState([]);
	const [notificationHistory, setNotificationHistory] = useState([]);

	const addNotification = useCallback((message, options = {}) => {
		const id = Date.now();
		const notification = {
			id,
			message,
			type: options.type || 'info',
			channels: options.channels || ['app'], // Default to in-app only
			priority: options.priority || 'normal',
			timestamp: new Date().toISOString(),
			context: options.context || {}
		};

		// Add to active notifications for in-app display
		if (notification.channels.includes('app')) {
			setNotifications((prev) => [...prev, notification]);
			setTimeout(() => {
				setNotifications((prev) => prev.filter((n) => n.id !== id));
			}, options.duration || 3000);
		}

		// Send to external channels
		sendToExternalChannels(notification);

		// Add to history
		setNotificationHistory((prev) => [notification, ...prev.slice(0, 99)]); // Keep last 100
	}, []);

	const sendToExternalChannels = async (notification) => {
		for (const channel of notification.channels) {
			if (channel === 'app') continue; // Already handled

			try {
				switch (channel) {
					case 'email':
						await sendEmailNotification(notification);
						break;
					case 'slack':
						await sendSlackNotification(notification);
						break;
					case 'telegram':
						await sendTelegramNotification(notification);
						break;
					case 'whatsapp':
						await sendWhatsAppNotification(notification);
						break;
					case 'sms':
						await sendSMSNotification(notification);
						break;
				}
			} catch (error) {
				console.error(`Failed to send ${channel} notification:`, error);
			}
		}
	};

	const sendEmailNotification = async (notification) => {
		if (
			!notificationChannels.email.enabled ||
			!notificationChannels.email.webhook
		) {
			return;
		}

		const emailPayload = {
			to: process.env.EMAIL_RECIPIENT || 'dev@taskmaster.ai',
			subject: `Task Master: ${notification.type.toUpperCase()} - ${notification.context.title || 'Notification'}`,
			html: formatEmailMessage(notification),
			priority: notification.priority
		};

		await fetch(notificationChannels.email.webhook, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(emailPayload)
		});
	};

	const sendSlackNotification = async (notification) => {
		if (
			!notificationChannels.slack.enabled ||
			!notificationChannels.slack.webhook
		) {
			return;
		}

		const slackPayload = {
			text: notification.message,
			attachments: [
				{
					color: getSlackColor(notification.type),
					fields: [
						{
							title: 'Type',
							value: notification.type.toUpperCase(),
							short: true
						},
						{
							title: 'Priority',
							value: notification.priority.toUpperCase(),
							short: true
						},
						{
							title: 'Time',
							value: new Date(notification.timestamp).toLocaleString(),
							short: true
						}
					],
					footer: 'Task Master Flow',
					ts: Math.floor(new Date(notification.timestamp).getTime() / 1000)
				}
			]
		};

		if (notification.context.prNumber) {
			slackPayload.attachments[0].fields.push({
				title: 'PR Number',
				value: `#${notification.context.prNumber}`,
				short: true
			});
		}

		await fetch(notificationChannels.slack.webhook, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(slackPayload)
		});
	};

	const sendTelegramNotification = async (notification) => {
		if (
			!notificationChannels.telegram.enabled ||
			!notificationChannels.telegram.token
		) {
			return;
		}

		const chatId = process.env.TELEGRAM_CHAT_ID;
		if (!chatId) return;

		const message = formatTelegramMessage(notification);
		const telegramUrl = `https://api.telegram.org/bot${notificationChannels.telegram.token}/sendMessage`;

		await fetch(telegramUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: chatId,
				text: message,
				parse_mode: 'Markdown',
				disable_web_page_preview: true
			})
		});
	};

	const sendWhatsAppNotification = async (notification) => {
		// Phase 4 implementation placeholder
		console.log('WhatsApp notifications coming in Phase 4');
	};

	const sendSMSNotification = async (notification) => {
		if (!notificationChannels.sms.enabled) {
			return;
		}

		// Twilio SMS implementation
		const accountSid = process.env.TWILIO_ACCOUNT_SID;
		const authToken = process.env.TWILIO_AUTH_TOKEN;
		const fromNumber = process.env.TWILIO_PHONE_NUMBER;
		const toNumber = process.env.SMS_RECIPIENT;

		if (!accountSid || !authToken || !fromNumber || !toNumber) {
			return;
		}

		const smsMessage = `Task Master: ${notification.message}`;

		// Note: In a real implementation, you'd use the Twilio SDK
		// This is a simplified version for demonstration
		console.log('SMS would be sent:', smsMessage);
	};

	const formatEmailMessage = (notification) => {
		return `
			<html>
				<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
					<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
						<h2 style="color: ${getEmailColor(notification.type)};">
							Task Master Notification
						</h2>
						<div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
							<p><strong>Message:</strong> ${notification.message}</p>
							<p><strong>Type:</strong> ${notification.type.toUpperCase()}</p>
							<p><strong>Priority:</strong> ${notification.priority.toUpperCase()}</p>
							<p><strong>Time:</strong> ${new Date(notification.timestamp).toLocaleString()}</p>
							${notification.context.prNumber ? `<p><strong>PR:</strong> #${notification.context.prNumber}</p>` : ''}
						</div>
						<p style="color: #666; font-size: 0.9em;">
							This notification was sent by Task Master Flow automation system.
						</p>
					</div>
				</body>
			</html>
		`;
	};

	const formatTelegramMessage = (notification) => {
		const emoji = getTelegramEmoji(notification.type);
		let message = `${emoji} *Task Master Notification*\n\n`;
		message += `*Message:* ${notification.message}\n`;
		message += `*Type:* ${notification.type.toUpperCase()}\n`;
		message += `*Priority:* ${notification.priority.toUpperCase()}\n`;
		message += `*Time:* ${new Date(notification.timestamp).toLocaleString()}\n`;

		if (notification.context.prNumber) {
			message += `*PR:* #${notification.context.prNumber}\n`;
		}

		return message;
	};

	const getSlackColor = (type) => {
		const colors = {
			success: 'good',
			error: 'danger',
			warning: 'warning',
			info: '#36a64f'
		};
		return colors[type] || '#36a64f';
	};

	const getEmailColor = (type) => {
		const colors = {
			success: '#28a745',
			error: '#dc3545',
			warning: '#ffc107',
			info: '#17a2b8'
		};
		return colors[type] || '#17a2b8';
	};

	const getTelegramEmoji = (type) => {
		const emojis = {
			success: '✅',
			error: '❌',
			warning: '⚠️',
			info: 'ℹ️'
		};
		return emojis[type] || 'ℹ️';
	};

	return (
		<NotificationContext.Provider
			value={{
				addNotification,
				notificationHistory,
				channels: notificationChannels
			}}
		>
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
