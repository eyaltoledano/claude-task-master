import { useState } from 'react';
import './TaskItem.css';

function TaskItem({ task, level = 0, onStatusChange, onEdit, onDelete }) {
	const [isExpanded, setIsExpanded] = useState(false);

	const handleStatusChange = (newStatus) => {
		if (onStatusChange) {
			onStatusChange(task.id, newStatus);
		}
	};

	const getStatusColor = (status) => {
		switch (status) {
			case 'done':
				return '#6bcf7f';
			case 'in-progress':
				return '#4dabf7';
			case 'pending':
				return '#ffd93d';
			case 'deferred':
				return '#868e96';
			case 'blocked':
				return '#ff6b6b';
			default:
				return '#868e96';
		}
	};

	const getPriorityColor = (priority) => {
		switch (priority) {
			case 'high':
				return '#ff6b6b';
			case 'medium':
				return '#ffd93d';
			case 'low':
				return '#51cf66';
			default:
				return '#868e96';
		}
	};

	return (
		<div className={`task-item level-${level} status-${task.status}`}>
			<div className="task-header">
				<div className="task-info">
					<span className="task-id">#{task.id}</span>
					<h3 className="task-title">{task.title}</h3>
					<span
						className={`status-badge ${task.status}`}
						style={{ backgroundColor: getStatusColor(task.status) }}
					>
						{task.status}
					</span>
					{task.priority && (
						<span
							className={`priority-badge ${task.priority}`}
							style={{ backgroundColor: getPriorityColor(task.priority) }}
						>
							{task.priority}
						</span>
					)}
				</div>

				<div className="task-actions">
					{task.subtasks && task.subtasks.length > 0 && (
						<button
							className="expand-button"
							onClick={() => setIsExpanded(!isExpanded)}
							aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
						>
							{isExpanded ? '▼' : '▶'} {task.subtasks.length} subtasks
						</button>
					)}

					<select
						value={task.status}
						onChange={(e) => handleStatusChange(e.target.value)}
						className="status-selector"
					>
						<option value="pending">Pending</option>
						<option value="in-progress">In Progress</option>
						<option value="done">Done</option>
						<option value="deferred">Deferred</option>
						<option value="blocked">Blocked</option>
					</select>

					{onEdit && (
						<button
							className="edit-button"
							onClick={() => onEdit(task)}
							aria-label="Edit task"
						>
							✏️
						</button>
					)}

					{onDelete && (
						<button
							className="delete-button"
							onClick={() => onDelete(task.id)}
							aria-label="Delete task"
						>
							🗑️
						</button>
					)}
				</div>
			</div>

			<div className="task-content">
				<p className="task-description">{task.description}</p>

				{task.dependencies && task.dependencies.length > 0 && (
					<div className="dependencies">
						<strong>Dependencies:</strong> {task.dependencies.join(', ')}
					</div>
				)}

				{task.details && (
					<details className="task-details">
						<summary>Implementation Details</summary>
						<div className="details-content">{task.details}</div>
					</details>
				)}

				{task.testStrategy && (
					<details className="test-strategy">
						<summary>Test Strategy</summary>
						<div className="test-strategy-content">{task.testStrategy}</div>
					</details>
				)}
			</div>

			{task.subtasks && task.subtasks.length > 0 && isExpanded && (
				<div className="subtasks">
					<h4>Subtasks</h4>
					{task.subtasks.map((subtask) => (
						<TaskItem
							key={`${task.id}.${subtask.id}`}
							task={{
								...subtask,
								id: `${task.id}.${subtask.id}`
							}}
							level={level + 1}
							onStatusChange={onStatusChange}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export default TaskItem;
