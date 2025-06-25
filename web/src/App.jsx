import { useState, useEffect } from 'react';
import TaskItem from './components/TaskItem';
import './App.css';

function App() {
	const [tasks, setTasks] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [filter, setFilter] = useState('all');

	// Fetch tasks from API
	useEffect(() => {
		const fetchTasks = async () => {
			try {
				const response = await fetch('/api/tasks');
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
				setTasks(data.tasks || []);
			} catch (err) {
				setError(err.message);
				console.error('Failed to fetch tasks:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchTasks();
	}, []);

	// Handle status changes
	const handleStatusChange = async (taskId, newStatus) => {
		try {
			const response = await fetch(`/api/tasks/${taskId}/status`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: newStatus })
			});

			if (!response.ok) {
				throw new Error(`Failed to update task status: ${response.status}`);
			}

			// Update local state
			setTasks((prevTasks) =>
				prevTasks.map((task) =>
					task.id === taskId ? { ...task, status: newStatus } : task
				)
			);
		} catch (err) {
			console.error('Failed to update task status:', err);
			alert('Failed to update task status. Please try again.');
		}
	};

	// Filter tasks based on current filter
	const filteredTasks = tasks.filter((task) => {
		if (filter === 'all') return true;
		return task.status === filter;
	});

	if (loading) {
		return (
			<div className="app">
				<div className="loading">
					<div className="spinner"></div>
					<p>Loading tasks...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="app">
				<div className="error">
					<h2>Error Loading Tasks</h2>
					<p>{error}</p>
					<button onClick={() => window.location.reload()}>Retry</button>
				</div>
			</div>
		);
	}

	return (
		<div className="app">
			<header className="app-header">
				<h1>Task Master</h1>
				<p>Web Interface</p>
			</header>

			<main className="app-main">
				<div className="tasks-container">
					<div className="tasks-header">
						<h2>
							Tasks ({filteredTasks.length}
							{filter !== 'all' ? ` of ${tasks.length}` : ''})
						</h2>

						<div className="filter-controls">
							<label htmlFor="status-filter">Filter by status:</label>
							<select
								id="status-filter"
								value={filter}
								onChange={(e) => setFilter(e.target.value)}
								className="filter-selector"
							>
								<option value="all">All Tasks</option>
								<option value="pending">Pending</option>
								<option value="in-progress">In Progress</option>
								<option value="done">Done</option>
								<option value="deferred">Deferred</option>
								<option value="blocked">Blocked</option>
							</select>
						</div>
					</div>

					{filteredTasks.length === 0 ? (
						<div className="empty-state">
							{tasks.length === 0 ? (
								<p>No tasks found. Start by creating your first task!</p>
							) : (
								<p>
									No tasks match the current filter. Try selecting a different
									status.
								</p>
							)}
						</div>
					) : (
						<div className="tasks-list">
							{filteredTasks.map((task) => (
								<TaskItem
									key={task.id}
									task={task}
									onStatusChange={handleStatusChange}
									onEdit={(task) => console.log('Edit task:', task)}
									onDelete={(taskId) => console.log('Delete task:', taskId)}
								/>
							))}
						</div>
					)}
				</div>
			</main>

			<footer className="app-footer">
				<p>Task Master Web Interface - Real-time task management</p>
			</footer>
		</div>
	);
}

export default App;
