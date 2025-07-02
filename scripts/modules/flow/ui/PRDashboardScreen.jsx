import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import PRListComponent from './PRListComponent.jsx';
import PRDetailsPanel from './PRDetailsPanel.jsx';
import PRActionPanel from './PRActionPanel.jsx';
import ConfigurationModal from './ConfigurationModal.jsx';
import CleanupDashboard from './CleanupDashboard.jsx';
import { ConfigurationProvider } from './ConfigurationProvider.jsx';
import {
	NotificationProvider,
	useNotification
} from './NotificationProvider.jsx';

const Dashboard = ({ backend }) => {
	const [monitoredPRs, setMonitoredPRs] = useState([]);
	const [selectedPR, setSelectedPR] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showConfigModal, setShowConfigModal] = useState(false);
	const [showCleanupDashboard, setShowCleanupDashboard] = useState(false);
	const { addNotification } = useNotification();

	useEffect(() => {
		const fetchPRs = async () => {
			try {
				// Don't show loading on subsequent fetches
				if (loading) setLoading(true);
				const prs = await backend.getAllMonitoredPRs();
				setMonitoredPRs(prs);

				if (prs.length > 0 && !selectedPR) {
					setSelectedPR(prs[0]);
				}
				if (prs.length === 0) {
					setSelectedPR(null);
				}
				setError(null);
			} catch (err) {
				setError(`Failed to fetch monitored PRs: ${err.message}`);
			} finally {
				setLoading(false);
			}
		};

		fetchPRs();
		const interval = setInterval(fetchPRs, 5000); // Refresh every 5 seconds

		return () => clearInterval(interval);
	}, [backend, loading, selectedPR]);

	const handleSelectPR = (pr) => {
		setSelectedPR(pr);
	};

	const handleNotification = (message) => {
		addNotification(message);
	};

	const handleOpenConfig = () => {
		setShowConfigModal(true);
	};

	const handleCloseConfig = () => {
		setShowConfigModal(false);
	};

	const handleOpenCleanup = () => {
		setShowCleanupDashboard(true);
	};

	const handleCloseCleanup = () => {
		setShowCleanupDashboard(false);
	};

	if (loading) {
		return <Text>Loading PR Dashboard...</Text>;
	}

	if (error) {
		return <Text color="red">{error}</Text>;
	}

	return (
		<Box
			borderStyle="round"
			padding={1}
			flexDirection="column"
			width="100%"
			height="100%"
		>
			<Text bold>PR Monitoring Dashboard</Text>
			<Box marginTop={1} flexGrow={1}>
				<Box width="30%" borderStyle="single" flexDirection="column">
					<PRListComponent
						prs={monitoredPRs}
						selectedPR={selectedPR}
						onSelect={handleSelectPR}
					/>
				</Box>
				<Box
					flexGrow={1}
					marginLeft={1}
					borderStyle="single"
					flexDirection="column"
				>
					<PRDetailsPanel pr={selectedPR} backend={backend} />
					<PRActionPanel
						pr={selectedPR}
						backend={backend}
						onNotification={handleNotification}
						onOpenConfig={handleOpenConfig}
						onOpenCleanup={handleOpenCleanup}
					/>
				</Box>
			</Box>

			{/* Configuration Modal */}
			{showConfigModal && (
				<Box position="absolute" top={0} left={0} width="100%" height="100%">
					<ConfigurationProvider backend={backend}>
						<ConfigurationModal
							onClose={handleCloseConfig}
							onNotification={handleNotification}
						/>
					</ConfigurationProvider>
				</Box>
			)}

			{/* Cleanup Dashboard */}
			{showCleanupDashboard && (
				<Box position="absolute" top={0} left={0} width="100%" height="100%">
					<CleanupDashboard backend={backend} onBack={handleCloseCleanup} />
				</Box>
			)}
		</Box>
	);
};

const PRDashboardScreen = ({ backend }) => (
	<NotificationProvider>
		<Dashboard backend={backend} />
	</NotificationProvider>
);

export default PRDashboardScreen;
