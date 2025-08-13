import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { theme } from '../shared/theme/theme.js';

export function MCPServerForm({ server = null, onSave, onCancel }) {
	const isEditMode = !!server;

	// Form fields
	const [id, setId] = useState(server?.id || '');
	const [name, setName] = useState(server?.name || '');
	const [scriptPath, setScriptPath] = useState(server?.scriptPath || '');
	const [description, setDescription] = useState(server?.description || '');

	// UI state
	const [activeField, setActiveField] = useState('id');
	const [errors, setErrors] = useState({});

	// Field navigation
	const fields = isEditMode
		? ['name', 'scriptPath', 'description']
		: ['id', 'name', 'scriptPath', 'description'];
	const fieldIndex = fields.indexOf(activeField);

	useInput((input, key) => {
		if (key.upArrow) {
			const newIndex = Math.max(0, fieldIndex - 1);
			setActiveField(fields[newIndex]);
		} else if (key.downArrow || key.tab) {
			const newIndex = Math.min(fields.length - 1, fieldIndex + 1);
			setActiveField(fields[newIndex]);
		} else if (key.escape) {
			onCancel();
		} else if (key.ctrl && input === 's') {
			handleSave();
		}
	});

	const validateForm = () => {
		const newErrors = {};

		if (!isEditMode && !id.trim()) {
			newErrors.id = 'Server ID is required';
		} else if (!isEditMode && !/^[a-z0-9-]+$/.test(id)) {
			newErrors.id = 'ID must be lowercase letters, numbers, and hyphens only';
		}

		if (!name.trim()) {
			newErrors.name = 'Server name is required';
		}

		if (!scriptPath.trim()) {
			newErrors.scriptPath = 'Script path is required';
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSave = async () => {
		if (!validateForm()) return;

		const serverData = {
			id: isEditMode ? server.id : id.trim(),
			name: name.trim(),
			scriptPath: scriptPath.trim(),
			description: description.trim(),
			status: 'inactive',
			createdAt: server?.createdAt || new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		try {
			await onSave(serverData);
		} catch (error) {
			setErrors({ submit: error.message });
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color={theme.accent}>
					{isEditMode ? 'Edit MCP Server' : 'Add New MCP Server'}
				</Text>
			</Box>

			{/* ID Field (only for new servers) */}
			{!isEditMode && (
				<>
					<Box marginBottom={1}>
						<Box width={20}>
							<Text color={activeField === 'id' ? theme.accent : theme.text}>
								Server ID:
							</Text>
						</Box>
						<Box flexGrow={1}>
							{activeField === 'id' ? (
								<TextInput
									value={id}
									onChange={setId}
									placeholder="e.g., my-server"
								/>
							) : (
								<Text>
									{id || <Text color={theme.textDim}>e.g., my-server</Text>}
								</Text>
							)}
						</Box>
					</Box>
					{errors.id && <Text color="red"> {errors.id}</Text>}
				</>
			)}

			{/* Name Field */}
			<Box marginBottom={1}>
				<Box width={20}>
					<Text color={activeField === 'name' ? theme.accent : theme.text}>
						Display Name:
					</Text>
				</Box>
				<Box flexGrow={1}>
					{activeField === 'name' ? (
						<TextInput
							value={name}
							onChange={setName}
							placeholder="e.g., My Custom Server"
						/>
					) : (
						<Text>
							{name || (
								<Text color={theme.textDim}>e.g., My Custom Server</Text>
							)}
						</Text>
					)}
				</Box>
			</Box>
			{errors.name && <Text color="red"> {errors.name}</Text>}

			{/* Script Path Field */}
			<Box marginBottom={1}>
				<Box width={20}>
					<Text
						color={activeField === 'scriptPath' ? theme.accent : theme.text}
					>
						Script Path:
					</Text>
				</Box>
				<Box flexGrow={1}>
					{activeField === 'scriptPath' ? (
						<TextInput
							value={scriptPath}
							onChange={setScriptPath}
							placeholder="./path/to/server.js"
						/>
					) : (
						<Text>
							{scriptPath || (
								<Text color={theme.textDim}>./path/to/server.js</Text>
							)}
						</Text>
					)}
				</Box>
			</Box>
			{errors.scriptPath && <Text color="red"> {errors.scriptPath}</Text>}

			{/* Description Field */}
			<Box marginBottom={1}>
				<Box width={20}>
					<Text
						color={activeField === 'description' ? theme.accent : theme.text}
					>
						Description:
					</Text>
				</Box>
				<Box flexGrow={1}>
					{activeField === 'description' ? (
						<TextInput
							value={description}
							onChange={setDescription}
							placeholder="Optional description"
						/>
					) : (
						<Text>
							{description || (
								<Text color={theme.textDim}>Optional description</Text>
							)}
						</Text>
					)}
				</Box>
			</Box>

			{/* Submit Error */}
			{errors.submit && (
				<Box marginTop={1}>
					<Text color="red">Error: {errors.submit}</Text>
				</Box>
			)}

			{/* Help Text */}
			<Box marginTop={2} flexDirection="column">
				<Text color={theme.textDim}>
					↑↓ Navigate fields • Tab: Next field • Enter: Edit field
				</Text>
				<Text color={theme.textDim}>Ctrl+S: Save • Esc: Cancel</Text>
			</Box>
		</Box>
	);
}
