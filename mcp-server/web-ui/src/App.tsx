import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faNetworkWired, faBolt, faUserPlus, faTasks,
  faProjectDiagram, faBell,
  faCheckCircle, faFilter, faSort, faSearch
  // Removed faGripLines, faExpand
} from '@fortawesome/free-solid-svg-icons';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Import API services
import { getTasks, TaskSummary } from '@/services/api';

// Import custom components
// Removed ResizablePanel imports

// Import custom styles
import '@/styles/dark-theme.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [taskStats, setTaskStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0
  });
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch tasks from the API
        const fetchedTasks = await getTasks();
        console.log("Fetched tasks:", fetchedTasks);

        // Calculate task statistics
        const total = fetchedTasks.length;
        const completed = fetchedTasks.filter(task => task.status === 'done').length;
        const inProgress = fetchedTasks.filter(task => task.status === 'in-progress').length;
        const pending = fetchedTasks.filter(task => task.status === 'pending').length;

        setTaskStats({
          total,
          completed,
          inProgress,
          pending
        });

        setTasks(fetchedTasks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  // Filter tasks based on status
  const filteredTasks = statusFilter
    ? tasks.filter(task => task.status === statusFilter)
    : tasks;

  // Chart data for task progress
  const taskProgressData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{
      label: 'Completed Tasks',
      data: [
        Math.round(taskStats.completed * 0.25),
        Math.round(taskStats.completed * 0.5),
        Math.round(taskStats.completed * 0.75),
        taskStats.completed
      ],
      borderColor: '#00ff00',
      backgroundColor: 'rgba(0, 255, 0, 0.1)',
      tension: 0.4,
      fill: true,
      borderWidth: 2,
      pointRadius: 0
    }]
  };

  // Chart data for task types
  const taskTypeData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      data: [
        tasks.filter(task => task.priority === 'high').length,
        tasks.filter(task => task.priority === 'medium').length,
        tasks.filter(task => task.priority === 'low').length
      ],
      backgroundColor: [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)'
      ],
      borderWidth: 1
    }]
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right' as const
      }
    },
    cutout: '65%'
  };

  return (
    <div className="container mx-auto px-0 py-2 text-gray-200 brushed-steel">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-green-600 pb-2 mb-4">
        <div className="flex items-center">
          <div className="w-4 h-12 bg-green-500 mr-3"></div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">TASK MASTER</h1>
            <p className="text-xs text-gray-500">TASK MANAGEMENT DASHBOARD</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-xs">
            <span className="text-yellow-400">TOTAL TASKS: </span>
            <span className="text-green-400">{taskStats.total}</span>
          </div>
          <span className="text-gray-500">|</span>
          <div className="text-xs">
            <span className="text-yellow-400">COMPLETED: </span>
            <span className="text-green-400">{taskStats.completed}</span>
          </div>
          <span className="text-gray-500">|</span>
          <div className="text-xs">
            <span className="text-yellow-400">IN PROGRESS: </span>
            <span className="text-green-400">{taskStats.inProgress}</span>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* System Status */}
          <div className="panel">
            <div className="panel-header">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-green-500 mr-2">
                  <FontAwesomeIcon icon={faNetworkWired} className="text-green-500" />
                </div>
                {/* Removed GripLines icon */}
              </div>
            </div>
            <div className="panel-content">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-gray-500">TOTAL TASKS</div>
                  <div className="text-green-400">{taskStats.total}</div>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-gray-500">COMPLETED</div>
                  <div className="text-green-400">{taskStats.completed}</div>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-gray-500">IN PROGRESS</div>
                  <div className="text-green-400">{taskStats.inProgress}</div>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-gray-500">PENDING</div>
                  <div className="text-green-400">{taskStats.pending}</div>
                </div>
              </div>
            </div>
          </div>
          {/* Quick Actions */}
          <div className="panel">
            <div className="panel-header">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faBolt} className="text-green-500 mr-2" />
                <span className="font-bold text-green-400">QUICK ACTIONS</span>
                {/* Removed GripLines icon */}
              </div>
            </div>
            <div className="panel-content">
              <div className="space-y-2">
                <button className="flat-button w-full">
                  <FontAwesomeIcon icon={faUserPlus} className="text-green-400" />
                  <span>CREATE TASK</span>
                </button>
                <button className="flat-button w-full">
                  <FontAwesomeIcon icon={faFilter} className="text-green-400" />
                  <span>FILTER TASKS</span>
                </button>
                <button className="flat-button w-full">
                  <FontAwesomeIcon icon={faSort} className="text-green-400" />
                  <span>SORT TASKS</span>
                </button>
                <button className="flat-button w-full">
                  <FontAwesomeIcon icon={faSearch} className="text-green-400" />
                  <span>SEARCH TASKS</span>
                </button>
              </div>
            </div>
          </div>
          {/* Task Filters */}
          <div className="panel">
            <div className="panel-header">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faFilter} className="text-green-500 mr-2" />
                <span className="font-bold text-green-400">TASK FILTERS</span>
                {/* Removed GripLines icon */}
              </div>
            </div>
            <div className="panel-content">
              <div className="space-y-2">
                <button
                  className={`flat-button w-full ${statusFilter === null ? 'accent-bg' : ''}`}
                  onClick={() => setStatusFilter(null)}
                >
                  <FontAwesomeIcon icon={faTasks} /> ALL TASKS
                </button>
                <button
                  className={`flat-button w-full ${statusFilter === 'done' ? 'accent-bg' : ''}`}
                  onClick={() => setStatusFilter('done')}
                >
                  <FontAwesomeIcon icon={faCheckCircle} /> COMPLETED
                </button>
                <button
                  className={`flat-button w-full ${statusFilter === 'in-progress' ? 'accent-bg' : ''}`}
                  onClick={() => setStatusFilter('in-progress')}
                >
                  <FontAwesomeIcon icon={faProjectDiagram} /> IN PROGRESS
                </button>
                <button
                  className={`flat-button w-full ${statusFilter === 'pending' ? 'accent-bg' : ''}`}
                  onClick={() => setStatusFilter('pending')}
                >
                  <FontAwesomeIcon icon={faBell} /> PENDING
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Task List */}
          <div className="panel flex flex-col flex-grow">
            
            <div className="panel-content flex flex-col flex-grow overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center flex-grow">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
                  <p className="ml-2 text-gray-400">Loading tasks...</p>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center flex-grow text-red-500">
                  <p>Error: {error}</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex items-center justify-center flex-grow text-gray-400">
                  <p>No tasks found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto flex-grow h-0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>TITLE</th>
                        <th>STATUS</th>
                        <th>PRIORITY</th>
                        <th>DEPENDENCIES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => (
                        <tr key={task.id}>
                          <td>{task.id}</td>
                          <td>{task.title}</td>
                          <td>
                            <span className={`status-${task.status}`}>
                              {task.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className={`priority-${task.priority}`}>
                              {task.priority.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {Array.isArray(task.dependencies) && task.dependencies.length > 0
                              ? task.dependencies.join(', ')
                              : 'None'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div> {/* Closing main grid div */}

      {/* Footer */}
      <footer className="mt-8 border-t border-gray-800 pt-4 text-xs text-gray-600 flex justify-between items-center">
        <div>
          <p>TASK MASTER DASHBOARD v1.0</p>
        </div>
        <div>
          <p>STATUS: <span className="text-green-500">OPERATIONAL</span></p>
        </div>
      </footer>
    </div> // Closing container div
  );
}

export default App;
