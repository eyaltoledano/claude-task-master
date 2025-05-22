document.addEventListener('DOMContentLoaded', () => {
    const taskListContainer = document.getElementById('task-list-container');

    if (!taskListContainer) {
        console.error('Error: task-list-container element not found.');
        return;
    }

    const displayTasks = (tasks) => {
        taskListContainer.innerHTML = ''; // Clear previous content (e.g., "Loading tasks...")

        if (!tasks || tasks.length === 0) {
            const noTasksMessage = document.createElement('p');
            noTasksMessage.textContent = 'No tasks found.';
            taskListContainer.appendChild(noTasksMessage);
            return;
        }

        const taskListTitle = document.createElement('h2');
        taskListTitle.textContent = 'Tasks';
        taskListContainer.appendChild(taskListTitle);

        const taskList = document.createElement('ul');
        taskList.id = 'tasks'; // For potential styling

        tasks.forEach(task => {
            const listItem = document.createElement('li');

            const title = document.createElement('h3');
            title.textContent = `Task #${task.id}: ${task.title}`;
            listItem.appendChild(title);

            const status = document.createElement('p');
            status.innerHTML = `<strong>Status:</strong> ${task.status || 'N/A'}`;
            listItem.appendChild(status);

            const priority = document.createElement('p');
            priority.innerHTML = `<strong>Priority:</strong> ${task.priority || 'N/A'}`;
            listItem.appendChild(priority);
            
            // Optionally, add description if available and needed
            // if (task.description) {
            //     const description = document.createElement('p');
            //     description.textContent = task.description;
            //     listItem.appendChild(description);
            // }

            taskList.appendChild(listItem);
        });

        taskListContainer.appendChild(taskList);
    };

    const displayError = (errorMessage) => {
        taskListContainer.innerHTML = ''; // Clear previous content
        const errorElement = document.createElement('p');
        errorElement.className = 'error-message'; // For potential styling
        errorElement.textContent = errorMessage;
        taskListContainer.appendChild(errorElement);
    };

    fetch('/api/tasks')
        .then(response => {
            if (!response.ok) {
                // Try to get error details from the server response if available
                return response.json().then(errData => {
                    throw new Error(`HTTP error ${response.status}: ${errData.details || response.statusText}`);
                }).catch(() => {
                    // Fallback if parsing server error fails
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // The listTasks function returns an object with a 'tasks' array
            if (data && data.tasks) {
                displayTasks(data.tasks);
            } else {
                // This case might happen if the server returns a 200 OK but the data is not in the expected format.
                console.error('Received data is not in the expected format:', data);
                displayError('Failed to process tasks: Unexpected data format from server.');
            }
        })
        .catch(error => {
            console.error('Failed to fetch tasks:', error);
            displayError(`Failed to load tasks. ${error.message}. Please check the server console or try again later.`);
        });
});
