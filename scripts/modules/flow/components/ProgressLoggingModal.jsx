import React, { useState, useEffect } from 'react';
import { BaseModal } from '../features/ui';
import { Box, Text } from 'ink';
import { useKeypress } from '../shared/hooks/useKeypress.js';
import { useComponentTheme } from '../shared/hooks/useTheme.js';

export function ProgressLoggingModal({
	subtask,
	phase = 'implementation',
	onSave,
	onCancel,
	backend
}) {
	const theme = useComponentTheme();
	const [formData, setFormData] = useState({
		whatWorked: [''],
		whatDidntWork: [{ issue: '', reason: '' }],
		codeChanges: [{ file: '', description: '' }],
		decisions: [{ decision: '', reasoning: '' }],
		nextSteps: [''],
		// Exploration phase specific
		filesToModify: [{ path: '', description: '' }],
		approach: '',
		challenges: [''],
		implementationSteps: [''],
		// Completion phase specific
		finalApproach: '',
		keyLearnings: [''],
		codePatterns: [''],
		testing: '',
		documentation: ''
	});

	const [currentSection, setCurrentSection] = useState(0);
	const [loading, setLoading] = useState(false);

	// Define sections based on phase
	const sections = getSectionsForPhase(phase);

	useKeypress('Tab', () => {
		setCurrentSection((prev) => (prev + 1) % sections.length);
	});

	useKeypress('S-Tab', () => {
		setCurrentSection((prev) => (prev - 1 + sections.length) % sections.length);
	});

	useKeypress('Enter', async () => {
		if (currentSection === sections.length - 1) {
			await handleSave();
		}
	});

	useKeypress('Escape', () => {
		onCancel();
	});

	const handleSave = async () => {
		setLoading(true);
		try {
			const progressUpdate = formatProgressUpdate(phase, formData);
			await onSave(progressUpdate);
		} catch (error) {
			console.error('Error saving progress:', error);
		} finally {
			setLoading(false);
		}
	};

	const addArrayItem = (field, defaultValue) => {
		setFormData((prev) => ({
			...prev,
			[field]: [...prev[field], defaultValue]
		}));
	};

	const updateArrayItem = (field, index, value) => {
		setFormData((prev) => ({
			...prev,
			[field]: prev[field].map((item, i) => (i === index ? value : item))
		}));
	};

	const removeArrayItem = (field, index) => {
		setFormData((prev) => ({
			...prev,
			[field]: prev[field].filter((_, i) => i !== index)
		}));
	};

	const renderSection = (section) => {
		switch (section.type) {
			case 'text':
				return (
					<Box flexDirection="column">
						<Text color={theme.accent}>{section.label}:</Text>
						<Box marginLeft={2}>
							<Text>{formData[section.field] || 'Not specified'}</Text>
						</Box>
					</Box>
				);

			case 'array':
				return (
					<Box flexDirection="column">
						<Text color={theme.accent}>{section.label}:</Text>
						{formData[section.field].map((item, index) => (
							<Box key={index} marginLeft={2}>
								<Text>
									• {typeof item === 'string' ? item : JSON.stringify(item)}
								</Text>
							</Box>
						))}
					</Box>
				);

			case 'object-array':
				return (
					<Box flexDirection="column">
						<Text color={theme.accent}>{section.label}:</Text>
						{formData[section.field].map((item, index) => (
							<Box key={index} marginLeft={2} flexDirection="column">
								{Object.entries(item).map(([key, value]) => (
									<Text key={key}>
										• {key}: {value || 'Not specified'}
									</Text>
								))}
							</Box>
						))}
					</Box>
				);

			default:
				return null;
		}
	};

	if (loading) {
		return (
			<BaseModal title="Saving Progress..." onClose={onCancel}>
				<Box justifyContent="center" paddingY={2}>
					<Text color={theme.accent}>Saving progress update...</Text>
				</Box>
			</BaseModal>
		);
	}

	return (
		<BaseModal
			title={`Log ${phase.charAt(0).toUpperCase() + phase.slice(1)} Progress - ${subtask.title}`}
			onClose={onCancel}
		>
			<Box flexDirection="column" paddingY={1}>
				{/* Progress indicator */}
				<Box marginBottom={1}>
					<Text color={theme.textDim}>
						Section {currentSection + 1} of {sections.length} - Use
						Tab/Shift+Tab to navigate
					</Text>
				</Box>

				{/* Current section */}
				<Box
					borderStyle="round"
					borderColor={theme.accent}
					padding={1}
					marginBottom={1}
				>
					{renderSection(sections[currentSection])}
				</Box>

				{/* Instructions */}
				<Box marginBottom={1}>
					<Text color={theme.textDim}>
						{sections[currentSection].instructions}
					</Text>
				</Box>

				{/* Navigation help */}
				<Box flexDirection="row" gap={2}>
					<Text color={theme.textDim}>Tab: Next section</Text>
					<Text color={theme.textDim}>Shift+Tab: Previous</Text>
					<Text color={theme.textDim}>Enter: Save</Text>
					<Text color={theme.textDim}>Esc: Cancel</Text>
				</Box>

				{/* Save button indicator */}
				{currentSection === sections.length - 1 && (
					<Box marginTop={1}>
						<Text color={theme.success}>
							Press Enter to save progress update
						</Text>
					</Box>
				)}
			</Box>
		</BaseModal>
	);
}

function getSectionsForPhase(phase) {
	const commonSections = [
		{
			type: 'array',
			field: 'whatWorked',
			label: 'What Worked',
			instructions: 'List things that worked well during implementation'
		},
		{
			type: 'object-array',
			field: 'whatDidntWork',
			label: "What Didn't Work",
			instructions: 'Document issues encountered and their reasons'
		},
		{
			type: 'object-array',
			field: 'codeChanges',
			label: 'Code Changes Made',
			instructions: 'List files modified and what was changed'
		},
		{
			type: 'object-array',
			field: 'decisions',
			label: 'Decisions Made',
			instructions: 'Document important decisions and their reasoning'
		},
		{
			type: 'array',
			field: 'nextSteps',
			label: 'Next Steps',
			instructions: 'List what needs to be done next'
		}
	];

	const explorationSections = [
		{
			type: 'object-array',
			field: 'filesToModify',
			label: 'Files to Modify',
			instructions: 'List files that need to be changed and why'
		},
		{
			type: 'text',
			field: 'approach',
			label: 'Proposed Approach',
			instructions: 'Describe the overall approach for implementation'
		},
		{
			type: 'array',
			field: 'challenges',
			label: 'Potential Challenges',
			instructions: 'List potential issues or challenges'
		},
		{
			type: 'array',
			field: 'implementationSteps',
			label: 'Implementation Steps',
			instructions: 'Break down the implementation into steps'
		}
	];

	const completionSections = [
		{
			type: 'text',
			field: 'finalApproach',
			label: 'Final Approach Used',
			instructions: 'Describe the final approach that was implemented'
		},
		{
			type: 'array',
			field: 'keyLearnings',
			label: 'Key Learnings',
			instructions: 'List important things learned during implementation'
		},
		{
			type: 'array',
			field: 'codePatterns',
			label: 'Code Patterns Established',
			instructions: 'Document any new code patterns or conventions'
		},
		{
			type: 'text',
			field: 'testing',
			label: 'Testing Completed',
			instructions: 'Describe testing that was performed'
		},
		{
			type: 'text',
			field: 'documentation',
			label: 'Documentation Updated',
			instructions: 'Describe documentation changes made'
		}
	];

	switch (phase) {
		case 'exploration':
			return explorationSections;
		case 'completion':
			return completionSections;
		case 'implementation':
		default:
			return commonSections;
	}
}

function formatProgressUpdate(phase, formData) {
	switch (phase) {
		case 'exploration':
			return `## Exploration Phase

**Files to modify:**
${formData.filesToModify.map((f) => `- ${f.path}: ${f.description}`).join('\n')}

**Proposed approach:**
${formData.approach}

**Potential challenges:**
${formData.challenges.map((c) => `- ${c}`).join('\n')}

**Implementation plan:**
${formData.implementationSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`;

		case 'completion':
			return `## Implementation Complete

**Final approach used:**
${formData.finalApproach}

**Key learnings:**
${formData.keyLearnings.map((learning) => `- ${learning}`).join('\n')}

**Code patterns established:**
${formData.codePatterns.map((pattern) => `- ${pattern}`).join('\n')}

**Testing completed:**
${formData.testing}

**Documentation updated:**
${formData.documentation}`;

		case 'implementation':
		default:
			return `## Implementation Progress

**What worked:**
${formData.whatWorked.map((item) => `- ${item}`).join('\n')}

**What didn't work:**
${formData.whatDidntWork.map((item) => `- ${item.issue}: ${item.reason}`).join('\n')}

**Code changes made:**
${formData.codeChanges.map((change) => `- ${change.file}: ${change.description}`).join('\n')}

**Decisions made:**
${formData.decisions.map((d) => `- ${d.decision}: ${d.reasoning}`).join('\n')}

**Next steps:**
${formData.nextSteps.map((step) => `- ${step}`).join('\n')}`;
	}
}
