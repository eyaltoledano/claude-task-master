import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const PRDetailsPanel = ({ pr, backend }) => {
	const [details, setDetails] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	useEffect(() => {
		if (!pr) {
			setDetails(null);
			return;
		}

		const fetchDetails = async () => {
			try {
				setLoading(true);
				const prDetails = await backend.getPRDetails(pr.prNumber);
				setDetails(prDetails);
				setError(null);
			} catch (err) {
				setError(`Failed to fetch details for PR #${pr.prNumber}: ${err.message}`);
			} finally {
				setLoading(false);
			}
		};

		fetchDetails();
	}, [pr, backend]);

	if (!pr) {
		return <Text>Select a PR to see details.</Text>;
	}

	if (loading) {
		return <Text>Loading details for PR #{pr.prNumber}...</Text>;
	}

	if (error) {
		return <Text color="red">{error}</Text>;
	}

	if (!details) {
		return <Text>No details available for PR #{pr.prNumber}.</Text>;
	}

	const { config, prStatus, eventLog } = details;

	return (
		<Box flexDirection="column" paddingX={1} width="100%">
			<Text bold>Details for PR #{pr.prNumber}</Text>
			
			<Box marginTop={1} flexDirection="column">
				<Text bold>Status:</Text>
				<Text>  Title: {prStatus?.title || 'N/A'}</Text>
				<Text>  State: {prStatus?.state || 'N/A'}</Text>
				<Text>  Mergeable: {prStatus?.mergeable ? 'Yes' : 'No'}</Text>
				<Text>  Auto-Merge Enabled: {config?.autoMerge ? 'Yes' : 'No'}</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text bold>Checks:</Text>
				{prStatus?.checks?.length > 0 ? (
					prStatus.checks.map(check => (
						<Text key={check.name}>  - {check.name}: {check.status} ({check.conclusion || 'pending'})</Text>
					))
				) : (
					<Text>  No checks found.</Text>
				)}
			</Box>

			<Box marginTop={1} flexDirection="column" flexGrow={1}>
				<Text bold>Event Log:</Text>
				<Box flexDirection="column-reverse">
					{eventLog?.length > 0 ? (
						eventLog.slice(-10).map((event, index) => (
							<Text key={`${event.timestamp}-${event.event}-${index}`}>  {new Date(event.timestamp).toLocaleTimeString()}: {event.event}</Text>
						))
					) : (
						<Text>  No events logged.</Text>
					)}
				</Box>
			</Box>
		</Box>
	);
};

export default PRDetailsPanel; 