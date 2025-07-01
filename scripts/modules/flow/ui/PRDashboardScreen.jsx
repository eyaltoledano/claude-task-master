import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import PRListComponent from './PRListComponent.jsx';
import PRDetailsPanel from './PRDetailsPanel.jsx';

const PRDashboardScreen = ({ backend }) => {
	const [monitoredPRs, setMonitoredPRs] = useState([]);
	const [selectedPR, setSelectedPR] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchPRs = async () => {
			try {
				setLoading(true);
				const prs = await backend.getAllMonitoredPRs();
				setMonitoredPRs(prs);
				if (prs.length > 0) {
					setSelectedPR(prs[0]);
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
	}, [backend]);

	const handleSelectPR = (pr) => {
		setSelectedPR(pr);
	};

	if (loading) {
		return <Text>Loading PR Dashboard...</Text>;
	}

	if (error) {
		return <Text color="red">{error}</Text>;
	}

	return (
		<Box borderStyle="round" padding={1} flexDirection="column" width="100%">
			<Text bold>PR Monitoring Dashboard</Text>
			<Box marginTop={1} width="100%">
				<Box width="30%" borderStyle="single">
					<PRListComponent
						prs={monitoredPRs}
						selectedPR={selectedPR}
						onSelect={handleSelectPR}
					/>
				</Box>
				<Box flexGrow={1} marginLeft={1} borderStyle="single">
					<PRDetailsPanel pr={selectedPR} backend={backend} />
				</Box>
			</Box>
		</Box>
	);
};

export default PRDashboardScreen; 